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
  , levelup = require('levelup')

var error = function(callback, message) {
  return process.nextTick(function() {
    callback({error: message});
  });
}

var DOC_STORE = 'document-store';
var BY_SEQ_STORE = 'by-sequence';
var ATTACH_STORE = 'attach-store';

LevelPouch = module.exports = function(opts, callback) {
  var api = {}
    , update_seq = 0
    , doc_count = 0
    , stores = {}

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

      // TODO: this is inefficient. maybe store the value in the db itself?
      api.changes(function(err, changes) {
        if (changes.results.length) {
          update_seq = changes.results[changes.results.length - 1].seq;
        }
        process.nextTick(function() { call(callback, null, api) });
      });
    });
  }

  // the db's id is just the path to the leveldb directory
  api.id = function() {
    return db_path;
  }

  api.info = function(callback) {
    return callback({
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
              return add.ids.indexOf(doc._rev.split('-')[1]) !== -1
            });
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

  api.put = api.put = function(doc, opts, callback) {
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
        results.push(makeErr(puch.Errors.MISSING_DOC, doc._bulk_seq));
        return processDocs();
      }
      writeDoc(doc, callback);
    }

    function updateDoc(oldDoc, docInfo, callback) {
      var merged = pouch.merge(oldDoc.rev_tree, docInfo.metadata.rev_tree[0], 1000);
      var conflict = (oldDoc.deleted && docInfo.metadata.deleted) ||
        (!oldDoc.deleted && newEdits && merged.conflicts !== 'new_leaf');

      if (conflict) {
        results.push(makeErr(pouch.Eddors.REV_CONFLICT, docInfo._bulk_seq));
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

      // TODO: is this the right way to set seq?
      doc.metadata.seq = doc.metadata.seq || update_seq++;
      stores[BY_SEQ_STORE].put(doc.metadata.seq, doc.data, function(err) {
        if (err) {
          return console.err(err);
        }

        stores[DOC_STORE].put(doc.metadata.id, doc.metadata);
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
        update_seq++;

        // TODO: implement Changes
        //LevelPouch.Changes.emit('change', opts.name, change);
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
    process.nextTick(function() { callback(null, {results: []}) });
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
}

LevelPouch.destroy = function() {
}

LevelPouch.Changes = function() {
}
