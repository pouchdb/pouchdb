'use strict';

var path = require('path');
var fs = require('fs');
var crypto = require('crypto');
var EventEmitter = require('events').EventEmitter;

var levelup = require('level');

var errors = require('../deps/errors');
var merge = require('../merge');
var utils = require('../utils');
var call = utils.call;

function error(callback, message) {
  return process.nextTick(function () {
    callback({error: message});
  });
}

var DOC_STORE = 'document-store';
var BY_SEQ_STORE = 'by-sequence';
var ATTACH_STORE = 'attach-store';
var ATTACH_BINARY_STORE = 'attach-binary-store';

// leveldb barks if we try to open a db mZultiple times
// so we cache opened connections here for initstore()
var STORES = {};

// global store of change_emitter objects (one per db name)
// this allows replication to work by providing a db name as the src
var CHANGES = {};

// store the value of update_seq in the by-sequence store the key name will
// never conflict, since the keys in the by-sequence store are integers
var UPDATE_SEQ_KEY = '_local_last_update_seq';
var DOC_COUNT_KEY = '_local_doc_count';

function dbError(callback) {
  return function (err) {
    call(callback, {
      status: 500,
      error: err,
      reason: err.message
    });
  };
}

function LevelPouch(opts, callback) {

  var opened = false;
  var api = {};
  var update_seq = 0;
  var doc_count = 0;
  var stores = {};
  var name = opts.name;
  var uuid;
  var change_emitter = CHANGES[name] || new EventEmitter();

  CHANGES[name] = change_emitter;

  var uuidPath = opts.name + '.uuid';
  if (!fs.existsSync(uuidPath)) {
    uuid = utils.uuid();
    fs.writeFileSync(uuidPath, uuid);
  } else {
    uuid = fs.readFileSync(uuidPath);
  }

  function initstore(store_name, encoding) {

    var dbpath = path.resolve(path.join(opts.name, store_name));
    opts.valueEncoding = encoding || 'json';

    // createIfMissing = true by default
    opts.createIfMissing = opts.createIfMissing === undefined ?
      true : opts.createIfMissing;

    function setup_store(err, ldb) {
      if (stores.err) {
        return;
      }
      if (err) {
        stores.err = err;
        return call(callback, err);
      }

      stores[store_name] = ldb;
      STORES[dbpath] = ldb;

      if (!stores[DOC_STORE] ||
          !stores[BY_SEQ_STORE] ||
          !stores[ATTACH_STORE] ||
          !stores[ATTACH_BINARY_STORE]) {
        return;
      }

      update_seq = doc_count = -1;

      function finish() {
        if (doc_count >= 0 && update_seq >= 0) {
          opened = true;
          process.nextTick(function () { call(callback, null, api); });
        }
      }

      stores[BY_SEQ_STORE].get(DOC_COUNT_KEY, function (err, value) {
        if (!err) {
          doc_count = value;
        }
        else {
          doc_count = 0;
        }
        finish();
      });

      stores[BY_SEQ_STORE].get(UPDATE_SEQ_KEY, function (err, value) {
        if (!err) {
          update_seq = value;
        }
        else {
          update_seq = 0;
        }
        finish();
      });
    }

    if (STORES[dbpath] !== undefined) {
      setup_store(null, STORES[dbpath]);
    }
    else {
      levelup(dbpath, opts, setup_store);
    }
  }

  fs.stat(opts.name, function (err, stats) {
    function initstores() {
      initstore(DOC_STORE, 'json');
      initstore(BY_SEQ_STORE, 'json');
      initstore(ATTACH_STORE, 'json');
      initstore(ATTACH_BINARY_STORE, 'binary');
    }
    if (err && err.code === 'ENOENT') {
      // db directory doesn't exist
      fs.mkdir(opts.name, initstores);
    }
    else if (stats.isDirectory()) {
      initstores();
    }
    else {
      // error
    }
  });

  api.type = function () {
    return 'leveldb';
  };

  // the db's id is just the path to the leveldb directory
  api.id = function () {
    return opts.name;
  };


  api._info = function (callback) {

    stores[BY_SEQ_STORE].get(DOC_COUNT_KEY, function (err, _doc_count) {
      if (err) { _doc_count = doc_count; }

      stores[BY_SEQ_STORE].get(UPDATE_SEQ_KEY, function (err, _update_seq) {
        if (err) { _update_seq = update_seq; }

        return call(callback, null, {
          db_name: opts.name,
          doc_count: _doc_count,
          update_seq: _update_seq
        });
      });
    });
  };

  api._get = function (id, opts, callback) {
    stores[DOC_STORE].get(id, function (err, metadata) {
      if (err || !metadata) {
        return call(callback, errors.MISSING_DOC);
      }
      if (utils.isDeleted(metadata) && !opts.rev) {
        return call(callback, utils.extend({}, errors.MISSING_DOC, {reason: "deleted"}));
      }

      var rev = merge.winningRev(metadata);
      rev = opts.rev ? opts.rev : rev;
      var seq = metadata.rev_map[rev];

      stores[BY_SEQ_STORE].get(seq, function (err, doc) {
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
    var type = attachment.content_type;

    stores[ATTACH_BINARY_STORE].get(digest, function (err, attach) {
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
      stores[DOC_STORE].get(currentDoc.metadata.id, function (err, oldDoc) {
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
        stores[BY_SEQ_STORE].put(DOC_COUNT_KEY, doc_count, function (err) {
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

        stores[BY_SEQ_STORE].put(doc.metadata.seq, doc.data, function (err) {
          stores[DOC_STORE].put(doc.metadata.id, doc.metadata, function (err) {
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
      stores[BY_SEQ_STORE].put(UPDATE_SEQ_KEY, update_seq, function (err) {
        if (err) {
          // TODO: handle error
        }
        return callback();
      });
    }

    function saveAttachment(docInfo, digest, data, callback) {
      stores[ATTACH_STORE].get(digest, function (err, oldAtt) {
        if (err && err.name !== 'NotFoundError') {
          if (false) {
            //console.error(err);
          }
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

        stores[ATTACH_STORE].put(digest, newAtt, function (err) {
          // do not try to store empty attachments
          if (data.length === 0) {
            return callback(err);
          }
          stores[ATTACH_BINARY_STORE].put(digest, data, function (err) {
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
    if ('descending' in opts && opts.descending) {
      readstreamOpts.reverse = true;
    }

    var results = [];
    var resultsMap = {};
    var docstream = stores[DOC_STORE].readStream(readstreamOpts);
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
            doc.doc._attachments[att].stub = true;
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
        stores[BY_SEQ_STORE].get(seq, function (err, data) {
          allDocsInner(metadata, data);
        });
      }
      else {
        allDocsInner(metadata);
      }
    });
    docstream.on('error', function (err) {
      // TODO: handle error
      if (false) {
        //console.error(err);
      }
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

    var descending = opts.descending;
    var results = [];
    var changeListener;
    var last_seq = 0;

    function fetchChanges() {
      var streamOpts = {
        reverse: descending
      };

      if (!streamOpts.reverse) {
        streamOpts.start = opts.since ? opts.since + 1 : 0;
      }

      var changeStream = stores[BY_SEQ_STORE].readStream(streamOpts);
      changeStream
        .on('data', function (data) {
          if (utils.isLocalId(data.key)) {
            return;
          }

          stores[DOC_STORE].get(data.value._id, function (err, metadata) {
            if (utils.isLocalId(metadata.id)) {
              return;
            }

            var mainRev = merge.winningRev(metadata);
            var changeList = [{rev: mainRev}];
            if (opts.style === 'all_docs') {
              changeList = merge.collectLeaves(metadata.rev_tree)
                .map(function (x) { return {rev: x.rev}; });
            }
            var change = {
              id: metadata.id,
              seq: metadata.seq,
              changes: changeList,
              doc: data.value
            };
            change.doc._rev = mainRev;

            if (last_seq < metadata.seq) {
              last_seq = metadata.seq;
            }
            if (utils.isDeleted(metadata, mainRev)) {
              change.deleted = true;
            }
            if (opts.conflicts) {
              change.doc._conflicts = merge.collectConflicts(metadata);
            }

            // Ensure duplicated dont overwrite winning rev
            if (+data.key === metadata.rev_map[change.doc._rev]) {
              results.push(change);
            }
          });
        })
        .on('error', function (err) {
          // TODO: handle errors
          if (false) {
            //console.error(err);
          }
        })
        .on('close', function () {
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
          if (false) {
            //console.log(name + ': Cancel Changes Feed');
          }
          opts.cancelled = true;
          change_emitter.removeListener('change', changeListener);
        }
      };
    }
  };

  api._close = function (callback) {
    if (!opened) {
      return call(callback, errors.NOT_OPEN);
    }

    var dbpath = path.resolve(opts.name);
    var stores = [
      path.join(dbpath, DOC_STORE),
      path.join(dbpath, BY_SEQ_STORE),
      path.join(dbpath, ATTACH_STORE),
      path.join(dbpath, ATTACH_BINARY_STORE)
    ];
    var closed = 0;
    stores.map(function (path) {
      var store = STORES[path];
      if (store) {
        store.close(function () {
          delete STORES[path];

          if (++closed >= stores.length) {
            done();
          }
        });
      }
      else {
        if (++closed >= stores.length) {
          done();
        }
      }
    });

    function done() {
      call(callback, null);
    }
  };

  api._getRevisionTree = function (docId, callback) {
    stores[DOC_STORE].get(docId, function (err, metadata) {
      if (err) {
        call(callback, errors.MISSING_DOC);
      } else {
        call(callback, null, metadata.rev_tree);
      }
    });
  };

  api._doCompaction = function (docId, rev_tree, revs, callback) {
    stores[DOC_STORE].get(docId, function (err, metadata) {
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

      stores[DOC_STORE].put(metadata.id, metadata, function () {
        revs.forEach(function (rev) {
          var seq = seqs[rev];
          if (!seq) {
            done();
            return;
          }

          stores[BY_SEQ_STORE].del(seq, function (err) {
            done();
          });
        });
      });
    });
  };

  return api;
}

LevelPouch.valid = function () {
  return typeof module !== undefined && module.exports;
};

// recursive fs.rmdir for Pouch.destroy. Use with care.
function rmdir(dir, callback) {
  fs.readdir(dir, function rmfiles(err, files) {
    if (err) {
      if (err.code === 'ENOTDIR') {
        return fs.unlink(dir, callback);
      }
      else if (callback) {
        return callback(err);
      }
      else {
        return;
      }
    }
    var count = files.length;
    if (count === 0) {
      return fs.rmdir(dir, callback);
    }
    files.forEach(function (file) {
      var todel = path.join(dir, file);
      rmdir(todel, function (err) {
        count--;
        if (count <= 0) {
          fs.rmdir(dir, callback);
        }
      });
    });
  });
}

// close and delete open leveldb stores
LevelPouch.destroy = function (name, opts, callback) {
  var dbpath = path.resolve(name);
  var stores = [
    path.join(dbpath, DOC_STORE),
    path.join(dbpath, BY_SEQ_STORE),
    path.join(dbpath, ATTACH_STORE),
    path.join(dbpath, ATTACH_BINARY_STORE)
  ];
  var closed = 0;
  stores.map(function (path) {
    var store = STORES[path];
    if (store) {
      store.close(function () {
        delete STORES[path];

        if (++closed >= stores.length) {
          done();
        }
      });
    }
    else {
      if (++closed >= stores.length) {
        done();
      }
    }
  });

  function done() {
    var uuidPath = name + '.uuid';
    if (fs.existsSync(uuidPath)) {
      fs.unlinkSync(uuidPath);
      rmdir(name, function (err) {
        if (err && err.code === 'ENOENT') {
          // TODO: MISSING_DOC name is somewhat misleading in this context
          return call(callback, errors.MISSING_DOC);
        }
        return call(callback, err);
      });
    } else {
      return call(callback, errors.DB_MISSING);
    }
  }
};

LevelPouch.use_prefix = false;

module.exports = LevelPouch;
