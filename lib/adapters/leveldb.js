'use strict';

var levelup = require('levelup');
var leveldown = require('leveldown');
var sublevel = require('level-sublevel');
var through = require('through2').obj;

var errors = require('../deps/errors');
var merge = require('../merge');
var utils = require('../utils');
var migrate = require('../deps/migrate');

var DOC_STORE = 'document-store';
var BY_SEQ_STORE = 'by-sequence';
var ATTACHMENT_STORE = 'attach-store';
var BINARY_STORE = 'attach-binary-store';

// leveldb barks if we try to open a db multiple times
// so we cache opened connections here for initstore()
var dbStore = {};

// store the value of update_seq in the by-sequence store the key name will
// never conflict, since the keys in the by-sequence store are integers
var UPDATE_SEQ_KEY = '_local_last_update_seq';
var DOC_COUNT_KEY = '_local_doc_count';
var UUID_KEY = '_local_uuid';

function LevelPouch(opts, callback) {
  opts = utils.clone(opts);
  var api = this;
  var instanceId;
  var stores = {};
  var db;
  var name = opts.name;
  if (typeof opts.createIfMissing === 'undefined') {
    opts.createIfMissing = true;
  }

  if (process.browser) {
    leveldown = opts.db || leveldown;
  }
  if (typeof leveldown.destroy !== 'function') {
    leveldown.destroy = function (name, cb) { cb(); };
  }

  if (dbStore[name]) {
    db = dbStore[name];
    afterDBCreated();
  } else {
    dbStore[name] = sublevel(levelup(name, opts, function (err) {
      if (err) {
        delete dbStore[name];
        return callback(err);
      }
      db = dbStore[name];
      db._locks = db._locks || {};
      db._docCountQueue = {
        queue : [],
        running : false,
        docCount : -1
      };
      if (opts.db || opts.noMigrate) {
        afterDBCreated();
      } else {
        migrate(name, db, afterDBCreated);
      }
    }));
  }

  function afterDBCreated() {
    stores.docStore = db.sublevel(DOC_STORE, {valueEncoding: 'json'});
    stores.bySeqStore = db.sublevel(BY_SEQ_STORE, {valueEncoding: 'json'});
    stores.attachmentStore =
      db.sublevel(ATTACHMENT_STORE, {valueEncoding: 'json'});
    stores.binaryStore = db.sublevel(BINARY_STORE, {valueEncoding: 'binary'});
    stores.bySeqStore.get(UPDATE_SEQ_KEY, function (err, value) {
      if (typeof db._updateSeq === 'undefined') {
        db._updateSeq = value || 0;
      }
      stores.bySeqStore.get(DOC_COUNT_KEY, function (err, value) {
        db._docCountQueue.docCount = !err ? value : 0;
        countDocs(function (err) { // notify queue that the docCount is ready
          if (err) {
            api.emit('error', err);
          }
          stores.bySeqStore.get(UUID_KEY, function (err, value) {
            instanceId = !err ? value : utils.uuid();
            stores.bySeqStore.put(UUID_KEY, instanceId, function (err, value) {
              process.nextTick(function () {
                callback(null, api);
              });
            });
          });
        });
      });
    });
  }

  function countDocs(callback) {
    if (db._docCountQueue.running || !db._docCountQueue.queue.length ||
      db._docCountQueue.docCount === -1) {
      return incrementDocCount(0, callback); // wait for fresh data
    }
    return db._docCountQueue.docCount; // use cached value
  }

  function applyNextDocCountDelta() {
    if (db._docCountQueue.running || !db._docCountQueue.queue.length ||
      db._docCountQueue.docCount === -1) {
      return;
    }
    db._docCountQueue.running = true;
    var item = db._docCountQueue.queue.shift();
    if (db.isClosed()) {
      return item.callback(new Error('database is closed'));
    }
    stores.bySeqStore.get(DOC_COUNT_KEY, function (err, docCount) {
      docCount = !err ? docCount : 0;

      function complete(err) {
        db._docCountQueue.docCount = docCount;
        item.callback(err, docCount);
        db._docCountQueue.running = false;
        applyNextDocCountDelta();
      }

      if (item.delta === 0) {
        complete();
      } else {
        stores.bySeqStore.put(DOC_COUNT_KEY, docCount + item.delta, complete);
      }
    });
  }

  function incrementDocCount(delta, callback) {
    db._docCountQueue.queue.push({delta : delta, callback : callback});
    applyNextDocCountDelta();
  }

  api.type = function () {
    return 'leveldb';
  };

  api._id = function (callback) {
    callback(null, instanceId);
  };

  api._info = function (callback) {
    countDocs(function (err, docCount) {
      if (err) {
        return callback(err);
      }
      stores.bySeqStore.get(UPDATE_SEQ_KEY, function (err, otherUpdateSeq) {
        if (err) {
          otherUpdateSeq = db._updateSeq;
        }

        return callback(null, {
          db_name: opts.name,
          doc_count: docCount,
          update_seq: otherUpdateSeq
        });
      });
    });
  };

  function formatSeq(n) {
    return ('0000000000000000' + n).slice(-16);
  }

  function parseSeq(s) {
    return parseInt(s, 10);
  }

  function makeDoc(rawDoc, callback) {
    var doc = rawDoc.data;
    doc._id = rawDoc.metadata.id;
    if ('_rev' in doc) {
      if (doc._rev !== rawDoc.metadata.rev) {
        return callback(new Error('wrong doc returned'));
      }
    } else {
      // we didn't always store rev
      doc._rev = rawDoc.metadata.rev;
    }
    callback(null, {doc: doc, metadata: rawDoc.metadata});
  }

  api._get = function (id, opts, callback) {
    opts = utils.clone(opts);
    var docChanged = [];

    function didDocChange(doc) {
      docChanged.push(doc);
    }

    db.on('pouchdb-id-' + id, didDocChange);

    stores.docStore.get(id, function (err, metadata) {
      db.removeListener('pouchdb-id-' + id, didDocChange);
      
      if (err || !metadata) {
        return callback(errors.MISSING_DOC);
      }

      if (utils.isDeleted(metadata) && !opts.rev) {
        return callback(errors.error(errors.MISSING_DOC, "deleted"));
      }

      var updated;

      function ifUpdate(doc) {
        updated = doc;
      }

      var rev = merge.winningRev(metadata);
      rev = opts.rev ? opts.rev : rev;

      var seq = metadata.rev_map[rev];

      var anyChanged = docChanged.filter(function (doc) {
        return doc.metadata.seq === seq;
      });

      if (anyChanged.length) {
        return makeDoc(anyChanged.pop(), callback);
      }

      db.on('pouchdb-' + seq, ifUpdate);

      stores.bySeqStore.get(formatSeq(seq), function (err, doc) {
        db.removeListener('pouchdb-' + seq, ifUpdate);
        if (updated) {
          return makeDoc(updated, callback);

        }

        if (!doc) {
          return callback(errors.MISSING_DOC);
        }
        if ('_id' in doc && doc._id !== metadata.id) {
          // this failing implies something very wrong
          return callback(new Error('wrong doc returned'));
        }
        doc._id = metadata.id;
        if ('_rev' in doc) {
          if (doc._rev !== rev) {
            // this failing implies something very wrong
            return callback(new Error('wrong doc returned'));
          }
        } else {
          // we didn't always store this
          doc._rev = rev;
        }
        return callback(null, {doc: doc, metadata: metadata});
      });
    });
  };

  // not technically part of the spec, but if putAttachment has its own
  // method...
  api._getAttachment = function (attachment, opts, callback) {
    var digest = attachment.digest;

    stores.binaryStore.get(digest, function (err, attach) {
      var data;

      if (err && err.name === 'NotFoundError') {
        // Empty attachment
        data = opts.encode ? '' : process.browser ?
          utils.createBlob([''], {type: attachment.content_type}) :
          new Buffer('');
        return callback(null, data);
      }

      if (err) {
        return callback(err);
      }

      if (process.browser) {
        if (opts.encode) {
          data = utils.btoa(global.unescape(attach));
        } else {
          data = utils.createBlob([utils.fixBinary(global.unescape(attach))],
            {type: attachment.content_type});
        }
      } else {
        data = opts.encode ? utils.btoa(attach) : attach;
      }
      callback(null, data);
    });
  };

  api.lock = function (id) {
    if (id in db._locks) {
      return false;
    } else {
      db._locks[id] = true;
      return true;
    }
  };

  api.unlock = function (id) {
    delete db._locks[id];
    return true;
  };

  api._bulkDocs = function (req, opts, callback) {
    var newEdits = opts.new_edits;
    var info = [];
    var results = [];

    // parse the docs and give each a sequence number
    var userDocs = req.docs;
    info = userDocs.map(function (doc, i) {
      var newDoc = utils.parseDoc(doc, newEdits);
      newDoc._bulk_seq = i;

      if (newDoc.metadata && !newDoc.metadata.rev_map) {
        newDoc.metadata.rev_map = {};
      }

      return newDoc;
    });

    var infoErrors = info.filter(function (doc) {
      return doc.error;
    });

    if (infoErrors.length) {
      return callback(infoErrors[0]);
    }

    function processDocs() {
      if (info.length === 0) {
        return complete();
      }
      var currentDoc = info.shift();
      stores.docStore.get(currentDoc.metadata.id, function (err, oldDoc) {
        if (!api.lock(currentDoc.metadata.id)) {
          results.push(makeErr(errors.REV_CONFLICT,
            'someobody else is accessing this'));
          return processDocs();
        }
        if (err) {
          if (err.name === 'NotFoundError') {
            insertDoc(currentDoc, function () {
              api.unlock(currentDoc.metadata.id);
              processDocs();
            });
          } else {
            err.error = true;
            results.push(err);
            api.unlock(currentDoc.metadata.id);
            processDocs();
          }
        } else {
          updateDoc(oldDoc, currentDoc, function () {
            api.unlock(currentDoc.metadata.id);
            processDocs();
          });
        }
      });
    }

    function insertDoc(doc, callback) {
      // Can't insert new deleted documents
      if ('was_delete' in opts && utils.isDeleted(doc.metadata)) {
        results.push(makeErr(errors.MISSING_DOC, doc._bulk_seq));
        return callback();
      }
      writeDoc(doc, function (err) {
        if (err) {
          return callback(err);
        }
        if (utils.isDeleted(doc.metadata) || utils.isLocalId(doc.metadata.id)) {
          return callback();
        }
        incrementDocCount(1, callback);
      });
    }

    function updateDoc(oldDoc, docInfo, callback) {
      var merged =
        merge.merge(oldDoc.rev_tree, docInfo.metadata.rev_tree[0], 1000);

      var conflict = (utils.isDeleted(oldDoc) &&
                      utils.isDeleted(docInfo.metadata) &&
                      newEdits) ||
        (!utils.isDeleted(oldDoc) &&
         newEdits && merged.conflicts !== 'new_leaf');


      if (conflict) {
        results.push(makeErr(errors.REV_CONFLICT, docInfo._bulk_seq));
        return callback();
      }
      docInfo.metadata.rev_tree = merged.tree;
      docInfo.metadata.rev_map = oldDoc.rev_map;
      var delta = 0;
      if (!utils.isLocalId(docInfo.metadata.id)) {
        var oldDeleted = utils.isDeleted(oldDoc);
        var newDeleted = utils.isDeleted(docInfo.metadata);
        delta = (oldDeleted === newDeleted) ? 0 :
          oldDeleted < newDeleted ? -1 : 1;
      }
      incrementDocCount(delta, function (err) {
        if (err) {
          return callback(err);
        }
        writeDoc(docInfo, callback);
      });

    }

    function writeDoc(doc, callback2) {
      var err = null;
      var recv = 0;

      doc.data._id = doc.metadata.id;
      doc.data._rev = doc.metadata.rev;

      if (utils.isDeleted(doc.metadata)) {
        doc.data._deleted = true;
      }

      var attachments = doc.data._attachments ?
        Object.keys(doc.data._attachments) :
        [];

      function collectResults(attachmentErr) {
        if (!err) {
          if (attachmentErr) {
            err = attachmentErr;
            callback2(err);
          } else if (recv === attachments.length) {
            finish();
          }
        }
      }

      function attachmentSaved(err) {
        recv++;
        collectResults(err);
      }

      function onLoadEnd(e) {
        var myData = global.escape(
          utils.arrayBufferToBinaryString(e.target.result));
        var myDigest = 'md5-' + utils.MD5(myData);
        saveAttachment(doc, myDigest, key, myData, attachmentSaved);
      }

      for (var i = 0; i < attachments.length; i++) {
        var key = attachments[i];

        if (doc.data._attachments[key].stub) {
          recv++;
          collectResults();
          continue;
        }
        var att = doc.data._attachments[key];
        var digest;
        var data;
        if (typeof att.data === 'string') {
          try {
            data = utils.atob(att.data);
            if (process.browser) {
              data = global.escape(data);
            }
          } catch (e) {
            callback(utils.extend({}, errors.BAD_ARG,
              {reason: "Attachments need to be base64 encoded"}));
            return;
          }
          digest = (process.browser ? 'md5-' : '') + utils.MD5(data || '');
        } else if (!process.browser) {
          data = att.data;
          digest = utils.MD5(data || '');
        } else { // browser
          var reader = new FileReader();
          reader.onloadend = onLoadEnd;
          reader.readAsArrayBuffer(att.data);
          return;
        }
        saveAttachment(doc, digest, key, data, attachmentSaved);
      }

      function finish() {
        db._updateSeq++;
        doc.metadata.seq = doc.metadata.seq || db._updateSeq;
        doc.metadata.rev_map[doc.metadata.rev] = doc.metadata.seq;
        var seq = formatSeq(doc.metadata.seq);
        db.emit('pouchdb-id-' + doc.metadata.id, doc);
        db.emit('pouchdb-' + seq, doc);
        db.batch([{
          key: seq,
          value: doc.data,
          prefix: stores.bySeqStore,
          type: 'put',
          valueEncoding: 'json'
        }, {
          key: doc.metadata.id,
          value: doc.metadata,
          prefix: stores.docStore,
          type: 'put',
          valueEncoding: 'json'
        }], function (err) {
          if (!err) {
            db.emit('pouchdb-id-' + doc.metadata.id, doc);
            db.emit('pouchdb-' + seq, doc);
          }
          return stores.bySeqStore.put(UPDATE_SEQ_KEY, db._updateSeq,
            function (err) {
            if (err) {
              results.push(err);
            } else {
              results.push(doc);
            }
            return callback2();
          });
        });
      }

      if (!attachments.length) {
        finish();
      }
    }

    function saveAttachment(docInfo, digest, key, data, callback) {
      delete docInfo.data._attachments[key].data;
      docInfo.data._attachments[key].digest = digest;
      stores.attachmentStore.get(digest, function (err, oldAtt) {
        if (err && err.name !== 'NotFoundError') {
          return callback(err);
        }

        var ref = [docInfo.metadata.id, docInfo.metadata.rev].join('@');
        var newAtt = {};

        if (oldAtt) {
          if (oldAtt.refs) {
            // only update references if this attachment already has them
            // since we cannot migrate old style attachments here without
            // doing a full db scan for references
            newAtt.refs = oldAtt.refs;
            newAtt.refs[ref] = true;
          }
        } else {
          newAtt.refs = {};
          newAtt.refs[ref] = true;
        }

        stores.attachmentStore.put(digest, newAtt, function (err) {
          // do not try to store empty attachments
          if (data.length === 0) {
            return callback(err);
          }
          // doing this in batch causes a test to fail, wtf?
          stores.binaryStore.put(digest, data, function (err) {
            callback(err);
          });
        });
      });
    }

    function complete() {
      var aresults = [];
      results.sort(function (a, b) { return a._bulk_seq - b._bulk_seq; });

      results.forEach(function (result) {
        delete result._bulk_seq;
        if (result.error) {
          return aresults.push(result);
        }
        var metadata = result.metadata;
        var rev = merge.winningRev(metadata);

        aresults.push({
          ok: true,
          id: metadata.id,
          rev: rev
        });

        if (utils.isLocalId(metadata.id)) {
          return;
        }
      });
      LevelPouch.Changes.notify(name);
      process.nextTick(function () { callback(null, aresults); });
    }

    function makeErr(err, seq) {
      err._bulk_seq = seq;
      return err;
    }

    processDocs();
  };

  api._allDocs = function (opts, callback) {
    opts = utils.clone(opts);
    countDocs(function (err, docCount) {
      if (err) {
        return callback(err);
      }
      var readstreamOpts = {};
      var skip = opts.skip || 0;
      if (opts.startkey) {
        readstreamOpts.start = opts.startkey;
      }
      if (opts.endkey) {
        readstreamOpts.end = opts.endkey;
      }
      if (opts.key) {
        readstreamOpts.start = readstreamOpts.end = opts.key;
      }
      if (opts.descending) {
        readstreamOpts.reverse = true;
        // switch start and ends
        var tmp = readstreamOpts.start;
        readstreamOpts.start = readstreamOpts.end;
        readstreamOpts.end = tmp;
      }
      var limit;
      if (typeof opts.limit === 'number') {
        limit = opts.limit;
      } else {
        limit = -1;
      }
      if (limit === 0 ||
          ('start' in readstreamOpts && 'end' in readstreamOpts &&
          readstreamOpts.start > readstreamOpts.end)) {
        // should return 0 results when start is greater than end.
        // normally level would "fix" this for us by reversing the order,
        // so short-circuit instead
        return callback(null, {
          total_rows: docCount,
          offset: opts.skip,
          rows: []
        });
      }
      var results = [];
      var docstream = stores.docStore.readStream(readstreamOpts);

      var throughStream = through(function (entry, _, next) {
        if (!utils.isDeleted(entry.value)) {
          if (skip-- > 0) {
            next();
            return;
          } else if (limit-- === 0) {
            docstream.unpipe();
            docstream.destroy();
            next();
            return;
          }
        } else if (opts.deleted !== 'ok') {
          next();
          return;
        }
        function allDocsInner(metadata, data) {
          if (utils.isLocalId(metadata.id)) {
            next();
            return;
          }
          var doc = {
            id: metadata.id,
            key: metadata.id,
            value: {
              rev: merge.winningRev(metadata)
            }
          };
          if (opts.include_docs) {
            doc.doc = data;
            doc.doc._rev = doc.value.rev;
            if (opts.conflicts) {
              doc.doc._conflicts = merge.collectConflicts(metadata);
            }
            for (var att in doc.doc._attachments) {
              if (doc.doc._attachments.hasOwnProperty(att)) {
                doc.doc._attachments[att].stub = true;
              }
            }
          }
          if (opts.inclusive_end === false && metadata.id === opts.endkey) {
            return next();
          } else if (utils.isDeleted(metadata)) {
            if (opts.deleted === 'ok') {
              doc.value.deleted = true;
              doc.doc = null;
            } else {
              return next();
            }
          }
          results.push(doc);
          next();
        }
        var metadata = entry.value;
        if (opts.include_docs) {
          var seq = metadata.rev_map[merge.winningRev(metadata)];
          stores.bySeqStore.get(formatSeq(seq), function (err, data) {
            allDocsInner(metadata, data);
          });
        }
        else {
          allDocsInner(metadata);
        }
      }, function (next) {
        callback(null, {
          total_rows: docCount,
          offset: opts.skip,
          rows: results
        });
        next();
      }).on('unpipe', function () {
        throughStream.end();
      });

      docstream.on('error', callback);
      
      docstream.pipe(throughStream);
    });
  };

  api._changes = function (opts) {
    opts = utils.clone(opts);

    if (opts.continuous) {
      var id = name + ':' + utils.uuid();
      LevelPouch.Changes.addListener(name, id, api, opts);
      LevelPouch.Changes.notify(name);
      return {
        cancel: function () {
          LevelPouch.Changes.removeListener(name, id);
        }
      };
    }

    var descending = opts.descending;
    var results = [];
    var last_seq = 0;
    var called = 0;
    var streamOpts = {
      reverse: descending
    };
    var limit;
    if ('limit' in opts && opts.limit > 0) {
      limit = opts.limit;
    }
    if (!streamOpts.reverse) {
      streamOpts.start = formatSeq(opts.since ? opts.since + 1 : 0);
    }
    var filter = utils.filterChange(opts);
    var returnDocs;
    if ('returnDocs' in opts) {
      returnDocs = opts.returnDocs;
    } else {
      returnDocs = true;
    }

    function complete() {
      opts.done = true;
      if (returnDocs && opts.limit) {
        if (opts.limit < results.length) {
          results.length = opts.limit;
        }
      }
      changeStream.unpipe(throughStream);
      changeStream.destroy();
      if (!opts.continuous && !opts.cancelled) {
        opts.complete(null, {results: results, last_seq: last_seq});
      }
    }
    var changeStream = stores.bySeqStore.readStream(streamOpts);
    var throughStream = through(function (data, _, next) {
      if (limit && called >= limit) {
        complete();
        return next();
      }
      if (opts.cancelled || opts.done) {
        return next();
      }
      if (utils.isLocalId(data.key)) {
        return next();
      }

      stores.docStore.get(data.value._id, function (err, metadata) {
        if (opts.cancelled || opts.done || db.isClosed() ||
            utils.isLocalId(metadata.id)) {
          return next();
        }
        var doc = data.value;
        doc._rev = merge.winningRev(metadata);
        var change = opts.processChange(doc, metadata, opts);
        change.seq = metadata.seq;

        if (last_seq < metadata.seq) {
          last_seq = metadata.seq;
        }

        // Ensure duplicated dont overwrite winning rev
        if (parseSeq(data.key) === metadata.rev_map[change.doc._rev] &&
            filter(change)) {
          called++;

          utils.call(opts.onChange, change);

          if (returnDocs) {
            results.push(change);
          }
        }
        next();
      });
    }, function (next) {
      if (opts.cancelled) {
        return next();
      }
      if (returnDocs && opts.limit) {
        if (opts.limit < results.length) {
          results.length = opts.limit;
        }
      }

      next();
    }).on('unpipe', function () {
      throughStream.end();
      complete();
    });
    changeStream.pipe(throughStream);
    return {
      cancel: function () {
        opts.cancelled = true;
        complete();
      }
    };
  };

  api._close = function (callback) {
    if (db.isClosed()) {
      return callback(errors.NOT_OPEN);
    }
    db.close(function (err) {
      if (err) {
        callback(err);
      } else {
        delete dbStore[name];
        callback();
      }
    });
  };

  api._getRevisionTree = function (docId, callback) {
    stores.docStore.get(docId, function (err, metadata) {
      if (err) {
        callback(errors.MISSING_DOC);
      } else {
        callback(null, metadata.rev_tree);
      }
    });
  };

  api._doCompaction = function (docId, rev_tree, revs, callback) {
    stores.docStore.get(docId, function (err, metadata) {
      if (err) {
        return callback(err);
      }
      var seqs = metadata.rev_map; // map from rev to seq
      metadata.rev_tree = rev_tree;
      if (!revs.length) {
        callback();
      }
      var batch = [];
      batch.push({
        key: metadata.id,
        value: metadata,
        type: 'put',
        valueEncoding: 'json',
        prefix: stores.docStore
      });
      revs.forEach(function (rev) {
        var seq = seqs[rev];
        if (!seq) {
          return;
        }
        batch.push({
          key: formatSeq(seq),
          type: 'del',
          prefix: stores.bySeqStore
        });
      });
      db.batch(batch, callback);
    });
  };
}

LevelPouch.valid = function () {
  return process && !process.browser;
};

// close and delete open leveldb stores
LevelPouch.destroy = utils.toPromise(function (name, opts, callback) {
  opts = utils.clone(opts);

  if (process.browser) {
    leveldown = opts.db || leveldown;
  }
  if (dbStore[name]) {

    LevelPouch.Changes.removeAllListeners(name);

    dbStore[name].close(function () {
      delete dbStore[name];
      leveldown.destroy(name, callback);
    });
  } else {
    leveldown.destroy(name, callback);
  }
});

LevelPouch.use_prefix = false;

LevelPouch.Changes = new utils.Changes();

module.exports = LevelPouch;
