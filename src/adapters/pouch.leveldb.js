/*
 * A LevelDB adapter for Pouchdb
 * based heavily on the pouch.idb.js IndexedDB adapter
 *
 * John Chesley <john@chesl.es>
 * September 2012
 */

var pouchdir = '../'
  , Pouch = require(pouchdir + 'pouch.js')

var call = Pouch.utils.call;

// TODO: this adds the Math.uuid function used in pouch.utils
// possibly not the best place for it, but it works for now
require(pouchdir + 'deps/uuid.js');

var path = require('path')
  , fs = require('fs')
  , crypto = require('crypto')
  , EventEmitter = require('events').EventEmitter
  , levelup = require('levelup')

var error = function(callback, message) {
  return process.nextTick(function() {
    callback({error: message});
  });
}

var DOC_STORE = 'document-store';
var BY_SEQ_STORE = 'by-sequence';
var ATTACH_STORE = 'attach-store';

// leveldb barks if we try to open a db multiple times
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
  return function(err) {
    call(callback, {
      status: 500,
      error: err,
      reason: err.message,
    });
  }
}

var ViewQuery = function(fun, stores, options) {
  if (!options.complete) {
    return;
  }

  function sum(values) {
    return values.reduce(function(a, b) { return a + b }, 0);
  }

  var results = []
    , current

  var emit = function(key, val) {
    var viewRow = {
      id: current._id,
      key: key,
      value: val
    }
    if (options.include_docs) {
      viewRow.doc = current.doc;
    }
    results.push(viewRow);
  }

  // ugly way to make sure references to 'emit' in map/reduce bind to the above emit
  eval('fun.map = '+fun.map.toString() + ';');
  if (fun.reduce) {
    eval('fun.reduce = '+fun.reduce.toString() + ';');
  }

  var docs = stores[DOC_STORE].readStream()
  docs.on('data', function(data) {
    var metadata = data.value
      , seq = metadata.seq
    stores[BY_SEQ_STORE].get(seq, processDoc);

    function processDoc(err, doc) {
      current = {doc: doc, metadata: metadata};
      current.doc._rev = winningRev(metadata);
      if (options.complete && !isDeleted(current.metadata, current.doc._rev)) {
        fun.map.call(this, current.doc);
      }
    }
  });
  docs.on('error', dbError(options.error));
  docs.on('close', function viewComplete() {
    results.sort(function(a, b) {
      return Pouch.collate(a.key, b.key);
    });
    if (options.descending) {
      results.reverse();
    }
    if (options.reduce === false) {
      return options.complete(null, {rows: results});
    }

    var groups = []
    results.forEach(function(e) {
      var last = groups[groups.length-1] || null;
      if (last && Pouch.collate(last.key[0][0], e.key) === 0) {
        last.key.push([e.key, e.id]);
        last.value.push(e.value);
        return
      }
      groups.push({key: [[e.key, e.id]], value: [e.value]})
    });
    groups.forEach(function(e) {
      e.value = fun.reduce(e.key, e.value) || null;
      e.key = e.key[0][0];
    });
    options.complete(null, {rows: groups});
  });
}

LevelPouch = module.exports = function(opts, callback) {
  var api = {}
    , update_seq = 0
    , doc_count = 0
    , stores = {}
    , name = opts.name
    , change_emitter = CHANGES[name] || new EventEmitter();

  CHANGES[name] = change_emitter;

  fs.stat(opts.name, function(err, stats) {
    if (err && err.code == 'ENOENT') {
      // db directory doesn't exist
      fs.mkdir(opts.name, initstores);
    }
    else if (stats.isDirectory()) {
      initstores();
    }
    else {
      // error
    }

    function initstores() {
      initstore(DOC_STORE, 'json');
      initstore(BY_SEQ_STORE, 'json');
      initstore(ATTACH_STORE, 'json');
    }
  });

  function initstore(store_name, encoding) {
    var dbpath = path.resolve(path.join(opts.name, store_name));
    opts.valueEncoding = encoding || 'json';

    // createIfMissing = true by default
    opts.createIfMissing = opts.createIfMissing === undefined ? true : opts.createIfMissing;

    if (STORES[dbpath] !== undefined) {
      setup_store(null, STORES[dbpath]);
    }
    else {
      levelup(dbpath, opts, setup_store);
    }

    function setup_store(err, ldb) {
      if (stores.err) return;
      if (err) {
        stores.err = err;
        return call(callback, err);
      }

      stores[store_name] = ldb;
      STORES[dbpath] = ldb;

      if (!stores[DOC_STORE] ||
          !stores[BY_SEQ_STORE] ||
          !stores[ATTACH_STORE]) {
        return;
      }

      update_seq = doc_count = -1;

      stores[BY_SEQ_STORE].get(DOC_COUNT_KEY, function(err, value) {
        if (!err) {
          doc_count = value;
        }
        else {
          doc_count = 0;
        }
        finish();
      });

      stores[BY_SEQ_STORE].get(UPDATE_SEQ_KEY, function(err, value) {
        if (!err) {
          update_seq = value;
        }
        else {
          update_seq = 0;
        }
        finish();
      });

      function finish() {
        if (doc_count >= 0 && update_seq >= 0) {
          process.nextTick(function() { call(callback, null, api) });
        }
      }
    };
  }

  // the db's id is just the path to the leveldb directory
  api.id = function() {
    return opts.name;
  }

  api.info = function(callback) {
    return call(callback, null, {
      name: opts.name,
      doc_count: doc_count,
      update_seq: update_seq,
    });
  }

  api.get = function(id, opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }

    id = Pouch.utils.parseDocId(id);
    if (id.attachmentId !== '') {
      return api.getAttachment(id, {decode: true}, callback);
    }

    stores[DOC_STORE].get(id.docId, function(err, metadata) {
      if (err || !metadata || (isDeleted(metadata) && !opts.rev)) {
        return call(callback, Pouch.Errors.MISSING_DOC);
      }

      var seq = opts.rev
        ? metadata.rev_map[opts.rev]
        : metadata.seq;

      stores[BY_SEQ_STORE].get(seq, function(err, doc) {
        doc._id = metadata.id;
        doc._rev = Pouch.utils.winningRev(metadata);

        if (opts.revs) {
          var path = Pouch.utils.arrayFirst(
            Pouch.utils.rootToLeaf(metadata.rev_tree),
            function(arr) {
              return arr.ids.indexOf(doc._rev.split('-')[1]) !== -1
            }
          );
          path.ids.reverse();
          doc._revisions = {
            start: (path.pos + path.ids.length) - 1,
            ids: path.ids
          };
        }

        if (opts.revs_info) {
          doc._revs_info = metadata.rev_tree.reduce(function(prev, current) {
            return prev.concat(Pouch.utils.collectRevs(current));
          }, []);
        }

        if (opts.conflicts) {
          var conflicts = Pouch.utils.collectConflicts(metadata.rev_tree);
          if (conflicts.length) {
            doc._conflicts = conflicts;
          }
        }

        if (opts.attachments && doc._attachments) {
          var attachments = Object.keys(doc._attachments);
          var recv = 0;

          attachments.forEach(function(key) {
            api.getAttachment(doc._id + '/' + key, function(err, data) {
              doc._attachments[key].data = data;

              if (++recv === attachments.length) {
                callback(null, doc);
              }
            });
          });
        }
        else {
          if (doc._attachments){
            for (var key in doc._attachments) {
              doc._attachments[key].stub = true;
            }
          }
          callback(null, doc);
        }
      });
    });
  }

  // not technically part of the spec, but if putAttachment has its own method...
  api.getAttachment = function(id, opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }

    id = id.docId ? id : Pouch.utils.parseDocId(id);
    if (id.attachmentId === '') {
      return api.get(id, opts, callback);
    }

    stores[DOC_STORE].get(id.docId, function(err, metadata) {
      if (err) {
        return call(callback, err);
      }
      var seq = metadata.seq;
      stores[BY_SEQ_STORE].get(seq, function(err, doc) {
        if (err) {
          return call(callback, err);
        }
        var digest = doc._attachments[id.attachmentId].digest
          , type = doc._attachments[id.attachmentId].content_type

        stores[ATTACH_STORE].get(digest, function(err, attach) {
          if (err) {
            return call(callback, err);
          }
          var data = opts.decode
            ? Pouch.utils.atob(attach.body.toString())
            : attach.body.toString();

          call(callback, null, data);
        });
      });
    });
  }

  api.put = api.post = function(doc, opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {}
    }
    return api.bulkDocs({docs: [doc]}, opts, Pouch.utils.yankError(callback));
  }

  api.putAttachment = function(id, rev, data, type, callback) {
    id = Pouch.utils.parseDocId(id);

    api.get(id.docId, {attachments: true}, function(err, obj) {
      obj._attachments || (obj._attachments = {});
      obj._attachments[id.attachmentId] = {
        content_type: type,
        data: data instanceof Buffer ? data : Pouch.utils.btoa(data)
      }
      api.put(obj, callback);
    });
  }

  api.remove = function(doc, opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {}
    }
    opts.was_delete = true;
    var newDoc = JSON.parse(JSON.stringify(doc));
    newDoc._deleted = true;
    return api.bulkDocs({docs: [newDoc]}, opts, Pouch.utils.yankError(callback));
  }

  api.removeAttachment = function(id, rev, callback) {
    id = parseDocId(id);
    api.get(id.docId, function(err, obj) {
      if (err) {
        call(callback, err);
        return;
      }

      if (obj._rev != rev) {
        call(callback, Pouch.Errors.REV_CONFLICT);
        return;
      }

      obj._attachments || (obj._attachments = {});
      delete obj._attachments[id.attachmentId];
      api.put(obj, callback);
    });
  };

  api.bulkDocs = function(bulk, opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }
    if (!opts) {
      opts = {};
    }

    if (!bulk || !bulk.docs || bulk.docs.length < 1) {
      return call(callback, Pouch.Errors.MISSING_BULK_DOCS);
    }
    if (!Array.isArray(bulk.docs)) {
      return error(callback, new Error("docs should be an array of documents"));
    }

    var newEdits = opts.new_edits !== undefined ? opts.new_edits : true
      , info = []
      , docs = []
      , results = []

    // parse the docs and give each a sequence number
    var userDocs = JSON.parse(JSON.stringify(bulk.docs));
    info = userDocs.map(function(doc, i) {
      var newDoc = Pouch.utils.parseDoc(doc, newEdits);
      newDoc._bulk_seq = i;
      if (newDoc.metadata && !newDoc.metadata.rev_map) {
        newDoc.metadata.rev_map = {};
      }
      if (doc._deleted) {
        if (!newDoc.metadata.deletions) {
          newDoc.metadata.deletions = {};
        }
        newDoc.metadata.deletions[doc._rev.split('-')[1]] = true;
      }

      return newDoc;
    });

    // group multiple edits to the same document
    info.forEach(function(info) {
      if (info.error) {
        return results.push(info);
      }
      if (!docs.length || info.metadata.id !== docs[docs.length-1].metadata.id) {
        return docs.push(info);
      }
      results.push(makeErr(Pouch.Errors.REV_CONFLICT, info._bulk_seq));
    });

    processDocs();

    function processDocs() {
      if (docs.length === 0) {
        return complete();
      }
      var currentDoc = docs.pop();
      stores[DOC_STORE].get(currentDoc.metadata.id, function(err, oldDoc) {
        if (err && err.name == 'NotFoundError') {
          insertDoc(currentDoc, processDocs);
        }
        else {
          updateDoc(oldDoc, currentDoc, processDocs);
        }
      });
    }

    function insertDoc(doc, callback) {
      // Can't insert new deleted documents
      if ('was_delete' in opts && isDeleted(doc.metadata)) {
        results.push(makeErr(Pouch.Errors.MISSING_DOC, doc._bulk_seq));
        return callback();
      }
      doc_count++;
      writeDoc(doc, function() {
        stores[BY_SEQ_STORE].put(DOC_COUNT_KEY, doc_count, function(err) {
          if (err) {
            // TODO: handle error
          }
          return callback();
        })
      });
    }

    function updateDoc(oldDoc, docInfo, callback) {
      var merged = Pouch.merge(oldDoc.rev_tree, docInfo.metadata.rev_tree[0], 1000);

      var conflict = (isDeleted(oldDoc) && isDeleted(docInfo.metadata)) ||
        (!isDeleted(oldDoc) && newEdits && merged.conflicts !== 'new_leaf');

      if (conflict) {
        results.push(makeErr(Pouch.Errors.REV_CONFLICT, docInfo._bulk_seq));
        return callback();
      }

      docInfo.metadata.rev_tree = merged.tree;
      docInfo.metadata.rev_map = oldDoc.rev_map;
      writeDoc(docInfo, callback);
    }

    function writeDoc(doc, callback) {
      var err = null;
      var recv = 0;

      doc.data._id = doc.metadata.id;

      if (isDeleted(doc.metadata)) {
        doc.data._deleted = true;
      }

      var attachments = doc.data._attachments
        ? Object.keys(doc.data._attachments)
        : [];
      for (var i=0; i<attachments.length; i++) {
        var key = attachments[i];
        if (!doc.data._attachments[key].stub) {
          var data = doc.data._attachments[key].data
          // if data is an object, it's likely to actually be a Buffer that got JSON.stringified
          if (typeof data === 'object') data = new Buffer(data);
          var digest = 'md5-' + crypto.createHash('md5')
                .update(data || '')
                .digest('hex');
          delete doc.data._attachments[key].data;
          doc.data._attachments[key].digest = digest;
          saveAttachment(doc, digest, data, function (err) {
            recv++;
            collectResults(err);
          });
        } else {
          recv++;
          collectResults();
        }
      }

      if(!attachments.length) {
        finish();
      }

      function collectResults(attachmentErr) {
        if (!err) {
          if (attachmentErr) {
            err = attachmentErr;
            call(callback, err);
          } else if (recv == attachments.length) {
            finish();
          }
        }
      }

      function finish() {
        update_seq++;
        doc.metadata.seq = doc.metadata.seq || update_seq;
        doc.metadata.rev_map[doc.metadata.rev] = doc.metadata.seq;

        stores[BY_SEQ_STORE].put(doc.metadata.seq, doc.data, function(err) {
          if (err) {
            return console.error(err);
          }

          stores[DOC_STORE].put(doc.metadata.id, doc.metadata, function(err) {
            results.push(doc);
            return saveUpdateSeq(callback);
          });
        });
      }
    }

    function saveUpdateSeq(callback) {
      stores[BY_SEQ_STORE].put(UPDATE_SEQ_KEY, update_seq, function(err) {
        if (err) {
          // TODO: handle error
        }
        return callback();
      });
    }

    function saveAttachment(docInfo, digest, data, callback) {
      stores[ATTACH_STORE].get(digest, function(err, oldAtt) {
        if (err && err.name !== 'NotFoundError') {
          callback(err);
          return console.error(err);
        }

        var ref = [docInfo.metadata.id, docInfo.metadata.rev].join('@');
        var newAtt = {body: data};

        if (oldAtt) {
          if (oldAtt.refs) {
            // only update references if this attachment already has them
            // since we cannot migrate old style attachments here without
            // doing a full db scan for references
            newAtt.refs = oldAtt.refs;
            newAtt.refs[ref] = true;
          }
        } else {
          newAtt.refs = {}
          newAtt.refs[ref] = true;
        }

        stores[ATTACH_STORE].put(digest, newAtt, function(err) {
          callback(err);
          if (err) {
            return console.error(err);
          }
        });
      });
    }

    function complete() {
      var aresults = [];
      results.sort(function(a, b) { return a._bulk_seq - b._bulk_seq });

      results.forEach(function(result) {
        delete result._bulk_seq;
        if (result.error) {
          return aresults.push(result);
        }
        var metadata = result.metadata
          , rev = Pouch.utils.winningRev(metadata);

        aresults.push({
          ok: true,
          id: metadata.id,
          rev: rev,
        });

        if (/_local/.test(metadata.id)) {
          return;
        }

        var change = {
          id: metadata.id,
          seq: metadata.seq,
          changes: Pouch.utils.collectLeaves(metadata.rev_tree),
          doc: result.data
        }
        change.doc._rev = rev;

        change_emitter.emit('change', change);
      });

      process.nextTick(function() { call(callback, null, aresults); });
    }

    function makeErr(err, seq) {
      err._bulk_seq = seq;
      return err;
    }
  }

  api.allDocs = function(opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }

    var readstreamOpts = {
      reverse: false,
      start: '-1',
    }

    if ('startkey' in opts && opts.startkey)
      readstreamOpts.start = opts.startkey;
    if ('endkey' in opts && opts.endkey)
      readstreamOpts.end = opts.endkey;
    if ('descending' in opts && opts.descending)
      readstreamOpts.reverse = true;

    var results = [];

    var docstream = stores[DOC_STORE].readStream(readstreamOpts);
    docstream.on('data', function(entry) {
      function allDocsInner(metadata, data) {
        if (/_local/.test(metadata.id)) {
          return;
        }
        if (!isDeleted(metadata)) {
          var result = {
            id: metadata.id,
            key: metadata.id,
            value: {
              rev: Pouch.utils.winningRev(metadata)
            }
          };
          if (opts.include_docs) {
            result.doc = data;
            result.doc._rev = result.value.rev;
            if (opts.conflicts) {
              result.doc._conflicts = Pouch.utils.collectConflicts(metadata.rev_tree);
            }
          }
          results.push(result);
        }
      }
      if (opts.include_docs) {
        var seq = entry.value.seq;
        stores[BY_SEQ_STORE].get(seq, function(err, data) {
          allDocsInner(entry.value, data);
        });
      }
      else {
        allDocsInner(entry.value);
      }
    });
    docstream.on('error', function(err) {
      // TODO: handle error
      console.error(err);
    });
    docstream.on('end', function() {
    });
    docstream.on('close', function() {
      return call(callback, null, {
        total_rows: results.length,
        rows: results,
      });
    });
  }

  api.revsDiff = function(req, opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }

    var ids = Object.keys(req)
      , count = 0
      , missing = {};

    function readDoc(err, doc, id) {
      req[id].map(function(revId) {
        var matches = function(x) { return x.rev !== revId };
        if (!doc || doc._revs_info.every(matches)) {
          if (!missing[id]) {
            missing[id] = {missing: []};
          }
          missing[id].missing.push(revId);
        }
      });

      if (++count === ids.length) {
        return call(callback, null, missing);
      }
    }

    ids.map(function(id) {
      api.get(id, {revs_info: true}, function(err, doc) {
        readDoc(err, doc, id);
      });
    });
  }

  api.changes = function(opts, callback) {
    if (opts instanceof Function && callback === undefined) {
      callback = opts;
      opts = {};
    }

    if (callback) {
      opts.complete = callback;
    }
    if (!opts.seq) {
      opts.seq = opts.descending ? update_seq : '0';
    }
    if (opts.since) {
      opts.seq = String(opts.since + 1);
    }

    var descending = 'descending' in opts ? opts.descending : false
      , results = []
      , changeListener

    // fetch a filter from a design doc
    if (opts.filter && typeof opts.filter === 'string') {
      var filtername = opts.filter.split('/');
      api.get('_design/'+filtername[0], function(err, design) {
        var filter = eval('(function() { return ' +
                          design.filters[filtername[1]] + '})()');
        opts.filter = filter;
        fetchChanges();
      });
    }
    else {
      fetchChanges();
    }

    function fetchChanges() {
      var streamOpts = {
        start: opts.seq,
        reverse: descending
      }
      var changeStream = stores[BY_SEQ_STORE].readStream(streamOpts);
      changeStream
        .on('data', function(data) {
          if (/_local/.test(data.key)) {
            return;
          }

          stores[DOC_STORE].get(data.value._id, function(err, metadata) {
            if (/_local/.test(metadata.id)) {
              return;
            }

            var change = {
              id: metadata.id,
              seq: metadata.seq,
              changes: Pouch.utils.collectLeaves(metadata.rev_tree),
              doc: data.value
            };

            change.doc._rev = Pouch.utils.winningRev(metadata);

            if (isDeleted(metadata)) {
              change.deleted = true;
            }
            if (opts.conflicts) {
              change.doc._conflicts = Pouch.utils.collectConflicts(metadata.rev_tree);
            }

            // dedupe changes (TODO: more efficient way to accomplish this?)
            results = results.filter(function(doc) {
              return doc.id !== change.id;
            });
            results.push(change);
          });
        })
        .on('error', function(err) {
          // TODO: handle errors
          console.error(err);
        })
        .on('close', function() {
          changeListener = Pouch.utils.filterChange(opts)
          if (opts.continuous && !opts.cancelled) {
            change_emitter.on('change', changeListener);
          }
          // filters changes in-place, calling opts.onChange on matching changes
          results.map(Pouch.utils.filterChange(opts));
          call(opts.complete, null, {results: results});
        })
    }

    if (opts.continuous) {
      return {
        cancel: function() {
          console.info(name + ': Cancel Changes Feed');
          opts.cancelled = true;
          change_emitter.removeListener('change', changeListener);
        }
      }
    }
  }

  api.query = function(fun, opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }
    if (callback) {
      opts.complete = callback;
    }

    if (typeof fun === 'string') {
      var parts = fun.split('/');
      api.get('_design/'+parts[0], function(err, doc) {
        if (err) {
          return callback(err);
        }
        new ViewQuery({
          map: doc.views[parts[1]].map,
          reduce: doc.views[parts[1]].reduce,
        }, stores, opts);
      });
    }
    else {
      new ViewQuery(fun, stores, opts);
    }
  }

  api.replicate = {}

  api.replicate.from = function(url, opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }
    return Pouch.replicate(url, api, opts, callback);
  }

  api.replicate.to = function(dbname, opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }
    return Pouch.replicate(api, dbname, opts, callback);
  }

  return api;
}

LevelPouch.valid = function() {
  return true;
}

// close and delete open leveldb stores
LevelPouch.destroy = function(name, callback) {
  var dbpath = path.resolve(name);
  var stores = [
    path.join(dbpath, DOC_STORE),
    path.join(dbpath, BY_SEQ_STORE),
    path.join(dbpath, ATTACH_STORE),
  ];
  var closed = 0;
  stores.map(function(path) {
    var store = STORES[path]
    if (store) {
      store.close(function() {
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
    rmdir(name, function(err) {
      if (err && err.code === 'ENOENT') {
        // TODO: MISSING_DOC name is somewhat misleading in this context
        return call(callback, Pouch.Errors.MISSING_DOC);
      }
      return call(callback, err);
    });
  }

}

Pouch.adapter('ldb', LevelPouch);
Pouch.adapter('leveldb', LevelPouch);

// recursive fs.rmdir for Pouch.destroy. Use with care.
function rmdir(dir, callback) {
  fs.readdir(dir, function rmfiles(err, files) {
    if (err) {
      if (err.code == 'ENOTDIR') {
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
    if (count == 0) {
      return fs.rmdir(dir, callback);
    }
    files.forEach(function(file) {
      var todel = path.join(dir, file);
      rmdir(todel, function(err) {
        count--;
        if (count <= 0) {
          fs.rmdir(dir, callback);
        }
      });
    })
  });
}
