/*
 * A LevelDB adapter for Pouchdb
 * based heavily on the pouch.idb.js IndexedDB adapter
 *
 * John Chesley <john@chesl.es>
 * September 2012
 */

var pouchdir = '../'
  , pouch = require(pouchdir + 'pouch.js')

pouch.utils = require(pouchdir + 'pouch.utils.js')
var call = pouch.utils.call;

// TODO: this adds the Math.uuid function used in pouch.utils
// possibly not the best place for it, but it works for now
require(pouchdir + 'deps/uuid.js');

var path = require('path')
  , fs = require('fs')
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

// store the value of update_seq in the by-sequence store the key name will
// never conflict, since the keys in the by-sequence store are integers
var UPDATE_SEQ_KEY = 'last_update_seq';

LevelPouch = module.exports = function(opts, callback) {
  var api = {}
    , update_seq = 0
    , doc_count = 0
    , stores = {}
    , change_emitter = new EventEmitter();

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
      initstore(ATTACH_STORE, 'base64');
    }
  });

  function initstore(store_name, encoding) {
    var dbpath = path.resolve(path.join(opts.name, store_name));
    opts.encoding = encoding || 'json';

    // createIfMissing = true by default
    opts.createIfMissing = opts.createIfMissing === undefined ? true : opts.createIfMissing;

    levelup(dbpath, opts, function(err, ldb) {
      if (stores.err) return;
      if (err) {
        stores.err = err;
        return callback(err);
      }

      stores[store_name] = ldb;

      if (!stores[DOC_STORE] ||
          !stores[BY_SEQ_STORE] ||
          !stores[ATTACH_STORE]) {
        return;
      }

      stores[BY_SEQ_STORE].get(UPDATE_SEQ_KEY, function(err, value) {
        if (!err) {
          update_seq = value;
        }
        process.nextTick(function() { call(callback, null, api) });
      });
    });
  }

  // the db's id is just the path to the leveldb directory
  api.id = function() {
    return opts.name;
  }

  api.info = function(callback) {
    // TODO: doc_count is never updated
    return callback(null, {
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

    if (pouch.utils.isAttachmentId(id)) {
      return api.getAttachment(id, opts, callback);
    }

    stores[DOC_STORE].get(id, function(err, metadata) {
      if (err || !metadata || (metadata.deleted && !opts.rev)) {
        return call(callback, pouch.Errors.MISSING_DOC);
      }

      stores[BY_SEQ_STORE].get(metadata.seq, function(err, doc) {
        doc._id = metadata.id;
        doc._rev = pouch.utils.winningRev(metadata.rev_tree[0].pos, metadata.rev_tree[0].ids);

        if (opts.revs) {
          var path = pouch.utils.arrayFirst(
            pouch.utils.rootToLeaf(metadata.rev_tree),
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
            return prev.concat(pouch.utils.collectRevs(current));
          }, []);
        }

        if (opts.conflicts) {
          var conflicts = pouch.utils.collectConflicts(metadata.rev_tree);
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
          callback(null, doc);
        }
      });
    });
  }

  // not technically part of the spec, but if putAttachment has its own method...
  api.getAttachment = function(id, opts, callback) {
    var ids = id.split('/')
      , docId = ids[0]
      , attachId = ids[1];

    stores[DOC_STORE].get(docId, function(err, metadata) {
      stores[BY_SEQ_STORE].get(metadata.seq, function(err, doc) {
        var digest = doc._attachments[attachId].digest;
        stores[ATTACH_STORE].get(digest, function(err, attach) {
          call(callback, null, attach.body);
        });
      });
    });
  }

  api.put = api.post = function(doc, opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {}
    }
    return api.bulkDocs({docs: [doc]}, opts, pouch.utils.yankError(callback));
  }

  api.putAttachment = function(id, rev, doc, type, callback) {
    var ids = id.split('/')
      , docId = ids('/')[0]
      , attachId = ids[1];
    api.get(docId, {attachments: true}, function(err, obj) {
      obj._attachments || (obj._attachments = {});
      obj._attachments[attachId] = {
        content_type: type,
        data: doc
      }
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
    return api.bulkDocs({docs: [newDoc]}, opts, pouch.utils.yankError(callback));
  }

  api.bulkDocs = function(bulk, opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }
    if (!opts) {
      opts = {};
    }

    if (!bulk || !bulk.docs || bulk.docs.length < 1) {
      return callback(null, []);
    }
    if (!Array.isArray(bulk.docs)) {
      return error(callback, new Error("docs should be an array of documents"));
    }

    var newEdits = opts.new_edits !== undefined ? opts.new_edits : true
      , info = []
      , docs = []
      , results = []

    // parse the docs and give each a sequence number
    info = bulk.docs.map(function(doc, i) {
      var newDoc = pouch.utils.parseDoc(doc, newEdits);
      newDoc._bulk_seq = i;
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
      results.push(makeErr(pouch.Errors.REV_CONFLICT, info._bulk_seq));
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
      if ('was_delete' in opts && doc.metadata.deleted) {
        results.push(makeErr(pouch.Errors.MISSING_DOC, doc._bulk_seq));
        return processDocs();
      }
      writeDoc(doc, callback);
    }

    function updateDoc(oldDoc, docInfo, callback) {
      var merged = pouch.merge(oldDoc.rev_tree, docInfo.metadata.rev_tree[0], 1000);
      var conflict = (oldDoc.deleted && docInfo.metadata.deleted) ||
        (!oldDoc.deleted && newEdits && merged.conflicts !== 'new_leaf');

      if (conflict) {
        results.push(makeErr(pouch.Errors.REV_CONFLICT, docInfo._bulk_seq));
        return callback();
      }

      docInfo.metadata.rev_tree = merged.tree;
      writeDoc(docInfo, callback);
    }

    function writeDoc(doc, callback) {
      for (var key in doc.data._attachments) {
        if (!doc.data._attachments[key].stub) {
          var data = doc.data._attachments[key].data
            , digest = 'md5-' + crypto.createHash('md5')
                .update(data)
                .digest('hex');
          delete doc.data._attachments[key].data;
          doc.data._attachments[key].digest = digest;
          saveAttachment(digest, data);
        }
      }

      doc.data._id = doc.metadata.id;
      if (doc.metadata.deleted) {
        doc.data._deleted = true;
      }
      results.push(doc);

      update_seq++;
      doc.metadata.seq = doc.metadata.seq || update_seq;

      stores[BY_SEQ_STORE].put(doc.metadata.seq, doc.data, function(err) {
        if (err) {
          return console.err(err);
        }

        stores[DOC_STORE].put(doc.metadata.id, doc.metadata);
        return saveUpdateSeq(callback);
      });
    }

    function saveUpdateSeq(callback) {
      stores[BY_SEQ_STORE].put(UPDATE_SEQ_KEY, update_seq, function(err) {
        if (err) {
          // TODO: handle error
        }
        return callback();
      });
    }

    function saveAttachment(digest, data) {
      stores[ATTACH_STORE].put(digest, data, function(err) {
        if (err) {
          return console.err(err);
        }
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
          , rev = pouch.utils.winningRev(metadata.rev_tree[0].pos, metadata.rev_tree[0].ids);

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
          changes: pouch.utils.collectLeaves(metadata.rev_tree),
          doc: result.data
        }
        change.doc._rev = rev;

        change_emitter.emit('change', change);
      });

      process.nextTick(function() { callback(null, aresults); });
    }

    function makeErr(err, seq) {
      err._bulk_seq = seq;
      return err;
    }
  }

  api.revsDiff = function(req, opts, callback) {
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
      opts.seq = '0';
    }
    if (opts.since) {
      opts.seq = toString.call(opts.since);
    }

    var descending = 'descending' in opts ? opts.descending : false
      , results = []

    // fetch a filter from a design doc
    if (opts.filter && typeof opts.filter === 'string') {
      var filtername = opts.filter.split('/');
      api.get('_design/'+filtername[0], function(err, design) {
        var filter = eval('(function() { return ' + 
                          design.filters[filterName[1]] + '})()');
        opts.filter = filter;
        fetchChanges();
      })
    }
    else {
      fetchChanges();
    }

    function fetchChanges() {
      var changeStream = stores[BY_SEQ_STORE].readStream({start: opts.seq, reverse: descending});
      changeStream
        .on('data', function(data) {
          stores[DOC_STORE].get(data.value._id, function(err, metadata) {
            if (/_local/.test(metadata.id)) {
              return;
            }

            var change = {
              id: metadata.id,
              seq: metadata.seq,
              changes: pouch.utils.collectLeaves(metadata.rev_tree),
              doc: data.value
            };

            change.doc._rev = pouch.utils.winningRev(
                metadata.rev_tree[0].pos,
                metadata.rev_tree[0].ids
              );

            if (metadata.deleted) {
              change.deleted = true;
            }
            if (opts.conflicts) {
              change.doc._conflicts = pouch.utils.collectConflicts(metadata.rev_tree);
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
          console.err(err);
        })
        .on('close', function() {

          if (opts.continuous && !opts.cancelled) {
            change_emitter.on('change', pouch.utils.filterChange(opts));
          }
          results.map(pouch.utils.filterChange(opts));
          call(opts.complete, null, {results: results});
        })
    }
  }

  api.query = function(fun, opts, callback) {
  }

  api.replicate = {}

  api.replicate.from = function(url, opts, callback) {
  }

  api.replicate.to = function(dbname, opts, callback) {
  }

  return api;
}

LevelPouch.valid = function() {
  return true;
}

LevelPouch.destroy = function(name, callback) {
  console.log('delete database: \'%s\'', name);
  rmdir(name, function(err) {
    if (err && err.code === 'ENOENT') {
      // TODO: MISSING_DOC name is somewhat misleading in this context
      return callback(pouch.Errors.MISSING_DOC);
    }
    return callback(err);
  });
}

pouch.adapter('ldb', LevelPouch);

// recursive fs.rmdir for Pouch.destroy. Use with care.
function rmdir(dir, callback) {
  fs.readdir(dir, function rmfiles(err, files) {
    if (err) {
      return err.code == 'ENOTDIR'
        ? fs.unlink(dir, callback)
        : callback(err);
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
