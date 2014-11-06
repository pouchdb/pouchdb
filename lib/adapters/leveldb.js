'use strict';

var levelup = require('levelup');
var originalLeveldown = require('leveldown');
var sublevel = require('level-sublevel');
var through = require('through2').obj;

var errors = require('../deps/errors');
var merge = require('../merge');
var utils = require('../utils');
var migrate = require('../deps/migrate');
var vuvuzela = require('vuvuzela');
var Deque = require("double-ended-queue");

var DOC_STORE = 'document-store';
var BY_SEQ_STORE = 'by-sequence';
var ATTACHMENT_STORE = 'attach-store';
var BINARY_STORE = 'attach-binary-store';
var LOCAL_STORE = 'local-store';
var META_STORE = 'meta-store';
var BATCH_SIZE = 50;

// leveldb barks if we try to open a db multiple times
// so we cache opened connections here for initstore()
var dbStores = new utils.Map();

// store the value of update_seq in the by-sequence store the key name will
// never conflict, since the keys in the by-sequence store are integers
var UPDATE_SEQ_KEY = '_local_last_update_seq';
var DOC_COUNT_KEY = '_local_doc_count';
var UUID_KEY = '_local_uuid';

var MD5_PREFIX = 'md5-';

var vuvuEncoding = {
  encode: vuvuzela.stringify,
  decode: vuvuzela.parse,
  buffer: false,
  type: 'cheap-json'
};

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

  var leveldown = opts.db || originalLeveldown;
  if (typeof leveldown.destroy !== 'function') {
    leveldown.destroy = function (name, cb) { cb(); };
  }
  var dbStore;
  if (dbStores.has(leveldown.name)) {
    dbStore = dbStores.get(leveldown.name);
  } else {
    dbStore = new utils.Map();
    dbStores.set(leveldown.name, dbStore);
  }
  if (dbStore.has(name)) {
    db = dbStore.get(name);
    afterDBCreated();
  } else {
    dbStore.set(name, sublevel(levelup(name, opts, function (err) {
      if (err) {
        dbStore.delete(name);
        return callback(err);
      }
      db = dbStore.get(name);
      db._docCountQueue = {
        queue : [],
        running : false,
        docCount : -1
      };
      db._writeQueue = new Deque();
      if (opts.db || opts.noMigrate) {
        afterDBCreated();
      } else {
        migrate.toSublevel(name, db, afterDBCreated);
      }
    })));
  }

  function afterDBCreated() {
    stores.docStore = db.sublevel(DOC_STORE, {valueEncoding: vuvuEncoding});
    stores.bySeqStore = db.sublevel(BY_SEQ_STORE, {valueEncoding: 'json'});
    stores.attachmentStore =
      db.sublevel(ATTACHMENT_STORE, {valueEncoding: 'json'});
    stores.binaryStore = db.sublevel(BINARY_STORE, {valueEncoding: 'binary'});
    stores.localStore = db.sublevel(LOCAL_STORE, {valueEncoding: 'json'});
    stores.metaStore = db.sublevel(META_STORE, {valueEncoding: 'json'});
    migrate.localAndMetaStores(db, stores, function () {
      stores.metaStore.get(UPDATE_SEQ_KEY, function (err, value) {
        if (typeof db._updateSeq === 'undefined') {
          db._updateSeq = value || 0;
        }
        stores.metaStore.get(DOC_COUNT_KEY, function (err, value) {
          db._docCountQueue.docCount = !err ? value : 0;
          countDocs(function (err) { // notify queue that the docCount is ready
            if (err) {
              api.emit('error', err);
            }
            stores.metaStore.get(UUID_KEY, function (err, value) {
              instanceId = !err ? value : utils.uuid();
              stores.metaStore.put(UUID_KEY, instanceId, function (err, value) {
                process.nextTick(function () {
                  callback(null, api);
                });
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
    stores.metaStore.get(DOC_COUNT_KEY, function (err, docCount) {
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
        stores.metaStore.put(DOC_COUNT_KEY, docCount + item.delta, complete);
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
      stores.metaStore.get(UPDATE_SEQ_KEY, function (err, otherUpdateSeq) {
        if (err) {
          otherUpdateSeq = db._updateSeq;
        }

        return callback(null, {
          doc_count: docCount,
          update_seq: otherUpdateSeq
        });
      });
    });
  };

  // all read/write operations to the database are done in a queue,
  // similar to how websql/idb works. this avoids problems such
  // as e.g. compaction needing to have a lock on the database while
  // it updates stuff. in the future we can revisit this.
  function writeLock(fun) {
    return utils.getArguments(function (args) {

      var callback = args[args.length - 1];
      args[args.length - 1] = utils.getArguments(function (cbArgs) {
        callback.apply(null, cbArgs);
        process.nextTick(function () {
          db._writeQueue.shift();
          if (db._writeQueue.length) {
            db._writeQueue.peekFront()();
          }
        });
      });

      db._writeQueue.push(function () {
        fun.apply(null, args);
      });

      if (db._writeQueue.length === 1) {
        db._writeQueue.peekFront()();
      }
    });
  }

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
          data = utils.btoa(attach);
        } else {
          data = utils.createBlob([utils.fixBinary(attach)],
            {type: attachment.content_type});
        }
      } else {
        data = opts.encode ? utils.btoa(attach) : attach;
      }
      callback(null, data);
    });
  };

  api._bulkDocs = writeLock(function (req, opts, callback) {
    var newEdits = opts.new_edits;
    var results = new Array(req.docs.length);
    var lock = new utils.Set();

    // parse the docs and give each a sequence number
    var userDocs = req.docs;
    var info = userDocs.map(function (doc, i) {
      if (doc._id && utils.isLocalId(doc._id)) {
        return doc;
      }
      var newDoc = utils.parseDoc(doc, newEdits);
      newDoc._bulk_seq = i;

      if (newDoc.metadata && !newDoc.metadata.rev_map) {
        newDoc.metadata.rev_map = {};
      }

      return newDoc;
    });
    var current = 0;
    var infoErrors = info.filter(function (doc) {
      return doc.error;
    });

    if (infoErrors.length) {
      return callback(infoErrors[0]);
    }

    // verify any stub attachments as a precondition test

    function verifyAttachment(digest, callback) {
      stores.attachmentStore.get(digest, function (levelErr) {
        if (levelErr) {
          var err = new Error('unknown stub attachment with digest ' + digest);
          err.status = 412;
          callback(err);
        } else {
          callback();
        }
      });
    }

    function verifyAttachments(finish) {
      var digests = [];
      userDocs.forEach(function (doc) {
        if (doc && doc._attachments) {
          Object.keys(doc._attachments).forEach(function (filename) {
            var att = doc._attachments[filename];
            if (att.stub) {
              digests.push(att.digest);
            }
          });
        }
      });
      if (!digests.length) {
        return finish();
      }
      var numDone = 0;
      var err;

      function checkDone() {
        if (++numDone === digests.length) {
          finish(err);
        }
      }
      digests.forEach(function (digest) {
        verifyAttachment(digest, function (attErr) {
          if (attErr && !err) {
            err = attErr;
          }
          checkDone();
        });
      });
    }

    var inProgress = 0;
    function processDocs() {
      var index = current;
      if (inProgress > BATCH_SIZE) {
        return;
      }
      if (index >= info.length) {
        if (inProgress === 0) {
          return complete();
        } else {
          return;
        }
      }
      var currentDoc = info[index];
      current++;
      inProgress++;
      if (currentDoc._id && utils.isLocalId(currentDoc._id)) {
        api[currentDoc._deleted ? '_removeLocalNoLock' : '_putLocalNoLock'](
            currentDoc, function (err, resp) {
          if (err) {
            results[index] = err;
          } else {
            results[index] = {};
          }
          inProgress--;
          processDocs();
        });
        return;
      }

      if (lock.has(currentDoc.metadata.id)) {
        results[index] = makeErr(errors.REV_CONFLICT,
                                 'somebody else is accessing this');
        inProgress--;
        return processDocs();
      }
      lock.add(currentDoc.metadata.id);

      stores.docStore.get(currentDoc.metadata.id, function (err, oldDoc) {
        if (err) {
          if (err.name === 'NotFoundError') {
            insertDoc(currentDoc, index, function () {
              lock.delete(currentDoc.metadata.id);
              inProgress--;
              processDocs();
            });
          } else {
            err.error = true;
            results[index] = err;
            lock.delete(currentDoc.metadata.id);
            inProgress--;
            processDocs();
          }
        } else {
          updateDoc(oldDoc, currentDoc, index, function () {
            lock.delete(currentDoc.metadata.id);
            inProgress--;
            processDocs();
          });
        }
      });

      if (newEdits) {
        processDocs();
      }
    }

    function insertDoc(doc, index, callback) {
      // Can't insert new deleted documents
      if ('was_delete' in opts && utils.isDeleted(doc.metadata)) {
        results[index] = makeErr(errors.MISSING_DOC, doc._bulk_seq);
        return callback();
      }
      writeDoc(doc, index, function (err) {
        if (err) {
          return callback(err);
        }
        if (utils.isDeleted(doc.metadata)) {
          return callback();
        }
        incrementDocCount(1, callback);
      });
    }

    function updateDoc(oldDoc, docInfo, index, callback) {

      if (utils.revExists(oldDoc, docInfo.metadata.rev)) {
        results[index] = docInfo;
        callback();
        return;
      }

      var merged =
        merge.merge(oldDoc.rev_tree, docInfo.metadata.rev_tree[0], 1000);

      var previouslyDeleted = utils.isDeleted(oldDoc);
      var deleted = utils.isDeleted(docInfo.metadata);
      var inConflict = (previouslyDeleted && deleted && newEdits) ||
        (!previouslyDeleted && newEdits && merged.conflicts !== 'new_leaf') ||
        (previouslyDeleted && !deleted && merged.conflicts === 'new_branch');

      if (inConflict) {
        results[index] = makeErr(errors.REV_CONFLICT, docInfo._bulk_seq);
        return callback();
      }
      var newRev = docInfo.metadata.rev;
      docInfo.metadata.rev_tree = merged.tree;
      docInfo.metadata.rev_map = oldDoc.rev_map;

      var delta = 0;
      if (newEdits || merge.winningRev(docInfo.metadata) === newRev) {
        // if newEdits==false and we're pushing existing revisions,
        // then the only thing that matters is whether this revision
        // is the winning one, and thus replaces an old one
        delta = (previouslyDeleted === deleted) ? 0 :
          previouslyDeleted < deleted ? -1 : 1;
      }

      incrementDocCount(delta, function (err) {
        if (err) {
          return callback(err);
        }
        writeDoc(docInfo, index, callback);
      });

    }

    function writeDoc(doc, index, callback2) {
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

      function onMD5Load(doc, key, data, attachmentSaved) {
        return function (result) {
          saveAttachment(doc, MD5_PREFIX + result, key, data, attachmentSaved);
        };
      }

      function onLoadEnd(doc, key, attachmentSaved) {
        return function (data) {
          utils.MD5(data).then(
            onMD5Load(doc, key, data, attachmentSaved)
          );
        };
      }

      for (var i = 0; i < attachments.length; i++) {
        var key = attachments[i];
        var att = doc.data._attachments[key];

        if (att.stub) {
          // still need to update the refs mapping
          var id = doc.data._id;
          var rev = doc.data._rev;
          saveAttachmentRefs(id, rev, att.digest, attachmentSaved);
          continue;
        }
        var data;
        if (typeof att.data === 'string') {
          try {
            data = utils.atob(att.data);
          } catch (e) {
            callback(utils.extend({}, errors.BAD_ARG,
              {reason: "Attachments need to be base64 encoded"}));
            return;
          }
        } else if (!process.browser) {
          data = att.data;
        } else { // browser
          utils.readAsBinaryString(att.data,
            onLoadEnd(doc, key, attachmentSaved));
          continue;
        }
        utils.MD5(data).then(
          onMD5Load(doc, key, data, attachmentSaved)
        );
      }

      function finish() {
        var seq = doc.metadata.rev_map[doc.metadata.rev];
        if (!seq) {
          // check that there aren't any existing revisions with the same
          // reivision id, else we shouldn't increment updateSeq
          seq = ++db._updateSeq;
        }
        doc.metadata.rev_map[doc.metadata.rev] = doc.metadata.seq = seq;
        var seqKey = formatSeq(seq);
        db.emit('pouchdb-id-' + doc.metadata.id, doc);
        db.emit('pouchdb-' + seqKey, doc);
        db.batch([{
          key: seqKey,
          value: doc.data,
          prefix: stores.bySeqStore,
          type: 'put',
          valueEncoding: 'json'
        }, {
          key: doc.metadata.id,
          value: doc.metadata,
          prefix: stores.docStore,
          type: 'put',
          valueEncoding: vuvuEncoding
        }], function (err) {
          if (!err) {
            db.emit('pouchdb-id-' + doc.metadata.id, doc);
            db.emit('pouchdb-' + seqKey, doc);
          }
          return stores.metaStore.put(UPDATE_SEQ_KEY, db._updateSeq,
            function (err) {
            if (err) {
              results[index] = err;
            } else {
              results[index] = doc;
            }
            return callback2();
          });
        });
      }

      if (!attachments.length) {
        finish();
      }
    }
    
    function saveAttachmentRefs(id, rev, digest, callback) {
      stores.attachmentStore.get(digest, function (err, oldAtt) {
        var newAttachment = false;
        if (err) {
          if (err.name !== 'NotFoundError') {
            return callback(err);
          } else {
            newAttachment = true;
          }
        }

        var ref = [id, rev].join('@');
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
          if (err) {
            return callback(err);
          }
          callback(null, newAttachment);
        });
      });
    }

    function saveAttachment(docInfo, digest, key, data, callback) {
      var att = docInfo.data._attachments[key];
      delete att.data;
      att.digest = digest;
      att.length = data.length;
      var id = docInfo.metadata.id;
      var rev = docInfo.metadata.rev;

      saveAttachmentRefs(id, rev, digest, function (err, newAttachment) {
        if (err) {
          return callback(err);
        }
        // do not try to store empty attachments
        if (data.length === 0) {
          return callback(err);
        }
        if (!newAttachment) {
          // small optimization - don't bother writing it again
          return callback(err);
        }
        // doing this in batch causes a test to fail, wtf?
        stores.binaryStore.put(digest, data, function (err) {
          callback(err);
        });
      });
    }

    function complete() {
      results.sort(function (a, b) { return a._bulk_seq - b._bulk_seq; });
      var aresults = results.map(function (result) {
        if (result._bulk_seq) {
          delete result._bulk_seq;
        } else if (!Object.keys(result).length) {
          return {
            ok: true
          };
        }
        if (result.error) {
          return result;
        }

        var metadata = result.metadata;
        var rev = merge.winningRev(metadata);

        return {
          ok: true,
          id: metadata.id,
          rev: rev
        };
      });
      LevelPouch.Changes.notify(name);
      process.nextTick(function () {
        callback(null, aresults);
      });
    }

    function makeErr(err, seq) {
      err._bulk_seq = seq;
      return err;
    }

    verifyAttachments(function (err) {
      if (err) {
        return callback(err);
      }
      processDocs();
    });
  });
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
        dbStore.delete(name);
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

  api._doCompaction = writeLock(function (docId, revs, callback) {
    if (!revs.length) {
      return callback();
    }
    stores.docStore.get(docId, function (err, metadata) {
      if (err) {
        return callback(err);
      }
      var seqs = metadata.rev_map; // map from rev to seq
      merge.traverseRevTree(metadata.rev_tree, function (isLeaf, pos,
                                                         revHash, ctx, opts) {
        var rev = pos + '-' + revHash;
        if (revs.indexOf(rev) !== -1) {
          opts.status = 'missing';
        }
      });
      var batch = [];
      batch.push({
        key: metadata.id,
        value: metadata,
        type: 'put',
        valueEncoding: vuvuEncoding,
        prefix: stores.docStore
      });

      var digestMap = {};
      var numDone = 0;
      var overallErr;
      function checkDone(err) {
        if (err) {
          overallErr = err;
        }
        if (++numDone === revs.length) { // done
          if (overallErr) {
            return callback(err);
          }
          deleteOrphanedAttachments();
        }
      }

      function finish(err) {
        if (err) {
          return callback(err);
        }
        db.batch(batch, callback);
      }

      function deleteOrphanedAttachments() {
        var possiblyOrphanedAttachments = Object.keys(digestMap);
        if (!possiblyOrphanedAttachments.length) {
          return finish();
        }
        var numDone = 0;
        var overallErr;
        function checkDone(err) {
          if (err) {
            overallErr = err;
          }
          if (++numDone === possiblyOrphanedAttachments.length) {
            finish(overallErr);
          }
        }
        var refsToDelete = new utils.Map();
        revs.forEach(function (rev) {
          refsToDelete.set(docId + '@' + rev, true);
        });
        possiblyOrphanedAttachments.forEach(function (digest) {
          stores.attachmentStore.get(digest, function (err, attData) {
            if (err) {
              if (err.name === 'NotFoundError') {
                return checkDone();
              } else {
                return checkDone(err);
              }
            }
            var refs = Object.keys(attData.refs || {}).filter(function (ref) {
              return !refsToDelete.has(ref);
            });
            var newRefs = {};
            refs.forEach(function (ref) {
              newRefs[ref] = true;
            });
            if (refs.length) { // not orphaned
              batch.push({
                key: digest,
                type: 'put',
                valueEncoding: 'json',
                value: {refs: newRefs},
                prefix: stores.attachmentStore
              });
            } else { // orphaned, can safely delete
              batch = batch.concat([{
                key: digest,
                type: 'del',
                prefix: stores.attachmentStore
              }, {
                key: digest,
                type: 'del',
                prefix: stores.binaryStore
              }]);
            }
            checkDone();
          });
        });
      }

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
        stores.bySeqStore.get(formatSeq(seq), function (err, doc) {
          if (err) {
            if (err.name === 'NotFoundError') {
              return checkDone();
            } else {
              return checkDone(err);
            }
          }
          var atts = Object.keys(doc._attachments || {});
          atts.forEach(function (attName) {
            var digest = doc._attachments[attName].digest;
            digestMap[digest] = true;
          });
          checkDone();
        });
      });
    });
  });

  api._getLocal = function (id, callback) {
    stores.localStore.get(id, function (err, doc) {
      if (err) {
        callback(errors.MISSING_DOC);
      } else {
        callback(null, doc);
      }
    });
  };

  api._putLocal = writeLock(function (doc, callback) {
    api._putLocalNoLock(doc, callback);
  });

  // the NoLock version is for use by bulkDocs
  api._putLocalNoLock = function (doc, callback) {
    delete doc._revisions; // ignore this, trust the rev
    var oldRev = doc._rev;
    var id = doc._id;
    stores.localStore.get(id, function (err, resp) {
      if (err) {
        if (oldRev) {
          return callback(errors.REV_CONFLICT);
        }
      }
      if (resp && resp._rev !== oldRev) {
        return callback(errors.REV_CONFLICT);
      }
      if (!oldRev) {
        doc._rev = '0-1';
      } else {
        doc._rev = '0-' + (parseInt(oldRev.split('-')[1], 10) + 1);
      }
      stores.localStore.put(id, doc, function (err) {
        if (err) {
          return callback(err);
        }
        var ret = {ok: true, id: doc._id, rev: doc._rev};
        callback(null, ret);
      });
    });
  };

  api._removeLocal = writeLock(function (doc, callback) {
    api._removeLocalNoLock(doc, callback);
  });

  // the NoLock version is for use by bulkDocs
  api._removeLocalNoLock = function (doc, callback) {
    stores.localStore.get(doc._id, function (err, resp) {
      if (err) {
        return callback(err);
      }
      if (resp._rev !== doc._rev) {
        return callback(errors.REV_CONFLICT);
      }
      stores.localStore.del(doc._id, function (err) {
        if (err) {
          return callback(err);
        }
        var ret = {ok: true, id: doc._id, rev: '0-0'};
        callback(null, ret);
      });
    });
  };
}

LevelPouch.valid = function () {
  return process && !process.browser;
};

// close and delete open leveldb stores
LevelPouch.destroy = utils.toPromise(function (name, opts, callback) {
  opts = utils.clone(opts);

  var leveldown = opts.db || originalLeveldown;
  function callDestroy(name, cb) {
    if (typeof leveldown.destroy === 'function') {
      leveldown.destroy(name, cb);
    } else {
      process.nextTick(callback);
    }
  }

  var dbStore;
  if (dbStores.has(leveldown.name)) {
    dbStore = dbStores.get(leveldown.name);
  } else {
    return callDestroy(name, callback);
  }

  if (dbStore.has(name)) {

    LevelPouch.Changes.removeAllListeners(name);

    dbStore.get(name).close(function () {
      dbStore.delete(name);
      callDestroy(name, callback);
    });
  } else {
    callDestroy(name, callback);
  }
});

LevelPouch.use_prefix = false;

LevelPouch.Changes = new utils.Changes();

module.exports = LevelPouch;
