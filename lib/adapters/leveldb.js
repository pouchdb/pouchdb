'use strict';

var crypto = require('crypto');
var EventEmitter = require('events').EventEmitter;

var levelup = require('levelup');
var leveldown = require("leveldown");
var sublevel = require('level-sublevel');

var errors = require('../deps/errors');
var merge = require('../merge');
var utils = require('../utils');
var migrate = require('../deps/migrate');
var call = utils.call;

var docStore = 'document-store';
var bySeqStore = 'by-sequence';
var attachmentStore = 'attach-store';
var binaryStore = 'attach-binary-store';

// leveldb barks if we try to open a db multiple times
// so we cache opened connections here for initstore()
var dbStore = {};

// global store of change_emitter objects (one per db name)
// this allows replication to work by providing a db name as the src
var changeEmitters = {};

// store the value of update_seq in the by-sequence store the key name will
// never conflict, since the keys in the by-sequence store are integers
var UPDATE_SEQ_KEY = '_local_last_update_seq';
var DOC_COUNT_KEY = '_local_doc_count';
var UUID_KEY = '_local_uuid';

function LevelPouch(opts, callback) {
  opts = utils.extend(true, {}, opts);
  var api = {};
  var instanceId;
  var update_seq = 0;
  var doc_count = 0;
  var stores = {};
  var db;
  var name = opts.name;
  var change_emitter = changeEmitters[name] || new EventEmitter();
  if (typeof opts.createIfMissing === 'undefined') {
    opts.createIfMissing = true;
  }
  changeEmitters[name] = change_emitter;

  
  if (dbStore[name]) {
    db = dbStore[name];
    withDB();
  } else {
    dbStore[name] = sublevel(levelup(name, opts, function (err) {
      if (err) {
        return callback(err);
      }
      db = dbStore[name];
      if (opts.db || opts.noMigrate) {
        withDB();
      } else {
        migrate(name, db, withDB);
      }
    }));
  }

  function withDB() {
    update_seq = doc_count = -1;
    stores[docStore] = db.sublevel(docStore, {valueEncoding: 'json'});
    stores[bySeqStore] = db.sublevel(bySeqStore, {valueEncoding: 'json'});
    stores[attachmentStore] = db.sublevel(attachmentStore, {valueEncoding: 'json'});
    stores[binaryStore] = db.sublevel(binaryStore, {valueEncoding: 'binary'});
    stores[bySeqStore].get(UPDATE_SEQ_KEY, function (err, value) {
      update_seq = !err ? value : 0;
      stores[bySeqStore].get(DOC_COUNT_KEY, function (err, value) {
        doc_count = !err ? value : 0;
        stores[bySeqStore].get(UUID_KEY, function (err, value) {
          instanceId = !err ? value : utils.uuid();
          stores[bySeqStore].get(UUID_KEY, function (err, value) {
            process.nextTick(function () {
              callback(null, api);
            });
          });
        });
      });
    });
  }

  api.type = function () {
    return 'leveldb';
  };

  api._id = function (callback) {
    callback(null, instanceId);
  };

  api._info = function (callback) {

    stores[bySeqStore].get(DOC_COUNT_KEY, function (err, _doc_count) {
      if (err) { _doc_count = doc_count; }

      stores[bySeqStore].get(UPDATE_SEQ_KEY, function (err, _update_seq) {
        if (err) { _update_seq = update_seq; }

        return call(callback, null, {
          db_name: opts.name,
          doc_count: _doc_count,
          update_seq: _update_seq
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

  api._get = function (id, opts, callback) {
    opts = utils.extend(true, {}, opts);
    stores[docStore].get(id, function (err, metadata) {
      if (err || !metadata) {
        return call(callback, errors.MISSING_DOC);
      }
      if (utils.isDeleted(metadata) && !opts.rev) {
        return call(callback, errors.error(errors.MISSING_DOC, "deleted"));
      }

      var rev = merge.winningRev(metadata);
      rev = opts.rev ? opts.rev : rev;
      var seq = metadata.rev_map[rev];

      stores[bySeqStore].get(formatSeq(seq), function (err, doc) {
        if (!doc) {
          return call(callback, errors.MISSING_DOC);
        }

        doc._id = metadata.id;
        doc._rev = rev;

        return call(callback, null, {doc: doc, metadata: metadata});
      });
    });
  };

  // not technically part of the spec, but if putAttachment has its own method...
  api._getAttachment = function (attachment, opts, callback) {
    var digest = attachment.digest;

    stores[binaryStore].get(digest, function (err, attach) {
      var data;

      if (err && err.name === 'NotFoundError') {
        // Empty attachment
        data = opts.encode ? '' : new Buffer('');
        return call(callback, null, data);
      }

      if (err) {
        return call(callback, err);
      }

      data = opts.encode ? utils.btoa(attach) : attach;
      call(callback, null, data);
    });
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
      return call(callback, infoErrors[0]);
    }

    function processDocs() {
      if (info.length === 0) {
        return complete();
      }
      var currentDoc = info.shift();
      stores[docStore].get(currentDoc.metadata.id, function (err, oldDoc) {
        if (err && err.name === 'NotFoundError') {
          insertDoc(currentDoc, processDocs);
        }
        else {
          updateDoc(oldDoc, currentDoc, processDocs);
        }
      });
    }

    function insertDoc(doc, callback) {
      // Can't insert new deleted documents
      if ('was_delete' in opts && utils.isDeleted(doc.metadata)) {
        results.push(makeErr(errors.MISSING_DOC, doc._bulk_seq));
        return callback();
      }
      doc_count++;
      writeDoc(doc, function () {
        stores[bySeqStore].put(DOC_COUNT_KEY, doc_count, function (err) {
          if (err) {
            // TODO: handle error
          }
          return callback();
        });
      });
    }

    function updateDoc(oldDoc, docInfo, callback) {
      var merged = merge.merge(oldDoc.rev_tree, docInfo.metadata.rev_tree[0], 1000);

      var conflict = (utils.isDeleted(oldDoc) &&
                      utils.isDeleted(docInfo.metadata)) ||
        (!utils.isDeleted(oldDoc) &&
         newEdits && merged.conflicts !== 'new_leaf');

      if (conflict) {
        results.push(makeErr(errors.REV_CONFLICT, docInfo._bulk_seq));
        return callback();
      }

      docInfo.metadata.rev_tree = merged.tree;
      docInfo.metadata.rev_map = oldDoc.rev_map;
      writeDoc(docInfo, callback);
    }

    function writeDoc(doc, callback2) {
      var err = null;
      var recv = 0;

      doc.data._id = doc.metadata.id;

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
            call(callback2, err);
          } else if (recv === attachments.length) {
            finish();
          }
        }
      }

      function attachmentSaved(err) {
        recv++;
        collectResults(err);
      }

      for (var i = 0; i < attachments.length; i++) {
        var key = attachments[i];
        if (!doc.data._attachments[key].stub) {
          var data = doc.data._attachments[key].data;
          // if data is a string, it's likely to actually be base64 encoded
          if (typeof data === 'string') {
            try {
              data = utils.atob(data);
            } catch (e) {
              call(callback, utils.extend({}, errors.BAD_ARG, {reason: "Attachments need to be base64 encoded"}));
              return;
            }
          }
          var digest = 'md5-' + crypto.createHash('md5')
                .update(data || '')
                .digest('hex');
          delete doc.data._attachments[key].data;
          doc.data._attachments[key].digest = digest;
          saveAttachment(doc, digest, data, attachmentSaved);
        } else {
          recv++;
          collectResults();
        }
      }

      function finish() {
        update_seq++;
        doc.metadata.seq = doc.metadata.seq || update_seq;
        doc.metadata.rev_map[doc.metadata.rev] = doc.metadata.seq;

        stores[bySeqStore].put(formatSeq(doc.metadata.seq), doc.data, function (err) {
          stores[docStore].put(doc.metadata.id, doc.metadata, function (err) {
            results.push(doc);
            return saveUpdateSeq(callback2);
          });
        });
      }

      if (!attachments.length) {
        finish();
      }
    }

    function saveUpdateSeq(callback) {
      stores[bySeqStore].put(UPDATE_SEQ_KEY, update_seq, function (err) {
        if (err) {
          // TODO: handle error
        }
        return callback();
      });
    }

    function saveAttachment(docInfo, digest, data, callback) {
      stores[attachmentStore].get(digest, function (err, oldAtt) {
        if (err && err.name !== 'NotFoundError') {
          return call(callback, err);
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

        stores[attachmentStore].put(digest, newAtt, function (err) {
          // do not try to store empty attachments
          if (data.length === 0) {
            return callback(err);
          }
          stores[binaryStore].put(digest, data, function (err) {
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

        var change = {
          id: metadata.id,
          seq: metadata.seq,
          changes: merge.collectLeaves(metadata.rev_tree),
          doc: result.data
        };
        change.doc._rev = rev;

        change_emitter.emit('change', change);
      });

      process.nextTick(function () { call(callback, null, aresults); });
    }

    function makeErr(err, seq) {
      err._bulk_seq = seq;
      return err;
    }

    processDocs();
  };

  api._allDocs = function (opts, callback) {

    var readstreamOpts = {
      reverse: false,
      start: '-1'
    };

    if ('startkey' in opts && opts.startkey) {
      readstreamOpts.start = opts.startkey;
    }
    if ('endkey' in opts && opts.endkey) {
      readstreamOpts.end = opts.endkey;
    }
    if ('key' in opts && opts.key) {
      readstreamOpts.start = readstreamOpts.end = opts.key;
    }
    if ('descending' in opts && opts.descending) {
      readstreamOpts.reverse = true;
    }

    var results = [];
    var resultsMap = {};
    var docstream = stores[docStore].readStream(readstreamOpts);
    docstream.on('data', function (entry) {
      function allDocsInner(metadata, data) {
        if (utils.isLocalId(metadata.id)) {
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
        if ('keys' in opts) {
          if (opts.keys.indexOf(metadata.id) > -1) {
            if (utils.isDeleted(metadata)) {
              doc.value.deleted = true;
              doc.doc = null;
            }
            resultsMap[doc.id] = doc;
          }
        } else {
          if (!utils.isDeleted(metadata)) {
            results.push(doc);
          }
        }
      }
      var metadata = entry.value;
      if (opts.include_docs) {
        var seq = metadata.rev_map[merge.winningRev(metadata)];
        stores[bySeqStore].get(formatSeq(seq), function (err, data) {
          allDocsInner(metadata, data);
        });
      }
      else {
        allDocsInner(metadata);
      }
    });
    docstream.on('error', function (err) {
    });
    docstream.on('end', function () {
    });
    docstream.on('close', function () {
      if ('keys' in opts) {
        opts.keys.forEach(function (key) {
          if (key in resultsMap) {
            results.push(resultsMap[key]);
          } else {
            results.push({"key": key, "error": "not_found"});
          }
        });
        if (opts.descending) {
          results.reverse();
        }
      }
      return call(callback, null, {
        total_rows: results.length,
        offset: opts.skip,
        rows: ('limit' in opts) ? results.slice(opts.skip, opts.limit + opts.skip) :
          (opts.skip > 0) ? results.slice(opts.skip) : results
      });
    });
  };

  api._changes = function (opts) {
    opts = utils.extend(true, {}, opts);
    var descending = opts.descending;
    var results = [];
    var changeListener;
    var last_seq = 0;

    function fetchChanges() {
      var streamOpts = {
        reverse: descending
      };

      if (!streamOpts.reverse) {
        streamOpts.start = formatSeq(opts.since ? opts.since + 1 : 0);
      }

      var changeStream = stores[bySeqStore].readStream(streamOpts);
      changeStream
        .on('data', function (data) {
          if (opts.cancelled) {
            return;
          }
          if (utils.isLocalId(data.key)) {
            return;
          }

          stores[docStore].get(data.value._id, function (err, metadata) {
            if (utils.isLocalId(metadata.id)) {
              return;
            }

            var doc = data.value;
            doc._rev = merge.winningRev(metadata);
            var change = opts.processChange(doc, metadata, opts);
            change.seq = metadata.seq;

            if (last_seq < metadata.seq) {
              last_seq = metadata.seq;
            }

            // Ensure duplicated dont overwrite winning rev
            if (parseSeq(data.key) === metadata.rev_map[change.doc._rev]) {
              results.push(change);
            }
          });
        })
        .on('error', function (err) {})
        .on('close', function () {
          if (opts.cancelled) {
            return;
          }
          var filter = utils.filterChange(opts);
          changeListener = function (change) {
            if (filter(change)) {
              call(opts.onChange, change);
            }
          };
          if (opts.continuous && !opts.cancelled) {
            change_emitter.on('change', changeListener);
          }
          results = results.sort(function (a, b) {
            if (descending) {
              return b.seq - a.seq;
            } else {
              return a.seq - b.seq;
            }
          });
          utils.processChanges(opts, results, last_seq);
        });
    }

    fetchChanges();

    if (opts.continuous) {
      return {
        cancel: function () {
          utils.call(opts.complete, null, {status: 'cancelled'});
          opts.complete = null;
          opts.cancelled = true;
          if (changeListener) {
            change_emitter.removeListener('change', changeListener);
          }
        }
      };
    }
  };

  api._close = function (callback) {
    if (db.isClosed()) {
      return call(callback, errors.NOT_OPEN);
    }
    db.close(callback);
  };

  api._getRevisionTree = function (docId, callback) {
    stores[docStore].get(docId, function (err, metadata) {
      if (err) {
        call(callback, errors.MISSING_DOC);
      } else {
        call(callback, null, metadata.rev_tree);
      }
    });
  };

  api._doCompaction = function (docId, rev_tree, revs, callback) {
    stores[docStore].get(docId, function (err, metadata) {
      var seqs = metadata.rev_map; // map from rev to seq
      metadata.rev_tree = rev_tree;

      var count = revs.length;
      function done() {
        count--;
        if (!count) {
          callback();
        }
      }

      if (!count) {
        callback();
      }

      stores[docStore].put(metadata.id, metadata, function () {
        revs.forEach(function (rev) {
          var seq = seqs[rev];
          if (!seq) {
            done();
            return;
          }

          stores[bySeqStore].del(formatSeq(seq), function (err) {
            done();
          });
        });
      });
    });
  };
  api.destroy = utils.toPromise(function (opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    if (db.isClosed()) {
      leveldown.destroy(name, callback);
    } else {
      db.close(function (err) {
        if (err) {
          return callback(err);
        }
        leveldown.destroy(name, callback);
      });
    }
  });
  return api;
}

LevelPouch.valid = function () {
  return process && !process.browser;
};

// close and delete open leveldb stores
LevelPouch.destroy = utils.toPromise(function (name, opts, callback) {
  opts = utils.extend(true, {}, opts);
  if (dbStore[name]) {
    dbStore[name].close(function () {
      delete dbStore[name];
      leveldown.destroy(name, callback);
    });
  } else {
    leveldown.destroy(name, callback);
  }
});

LevelPouch.use_prefix = false;

module.exports = LevelPouch;
