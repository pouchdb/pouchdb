/*globals Pouch: true, yankError: false, extend: false, call: false, parseDocId: false, traverseRevTree: false, collectLeaves: false */
/*globals collectConflicts: false, arrayFirst: false, rootToLeaf: false, computeHeight: false */

"use strict";

/*
 * A generic pouch adapter
 */
var PouchAdapter = function(opts, callback) {

  var api = {};

  var customApi = Pouch.adapters[opts.adapter](opts, function(err, db) {
    if (err) {
      if (callback) {
        callback(err);
      }
      return;
    }

    for (var j in api) {
      if (!db.hasOwnProperty(j)) {
        db[j] = api[j];
      }
    }

    // Don't call Pouch.open for ALL_DBS
    // Pouch.open saves the db's name into ALL_DBS
    if (opts.name === Pouch.ALL_DBS) {
      callback(err, db);
    } else {
      Pouch.open(opts, function(err) {
        callback(err, db);
      });
    }
  });

  var auto_compaction = (opts.auto_compaction === true);

  // wraps a callback with a function that runs compaction after each edit
  var autoCompact = function(callback) {
    if (!auto_compaction) {
      return callback;
    }
    return function(err, res) {
      if (err) {
        call(callback, err);
      } else {
        var count = res.length;
        var decCount = function() {
          count--;
          if (!count) {
            call(callback, null, res);
          }
        };
        res.forEach(function(doc) {
          if (doc.ok) {
            // TODO: we need better error handling
            compactDocument(doc.id, 1, decCount);
          } else {
            decCount();
          }
        });
      }
    };
  };

  api.post = function (doc, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    return customApi.bulkDocs({docs: [doc]}, opts,
        autoCompact(yankError(callback)));
  };

  api.put = function(doc, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }

    if (!doc || !('_id' in doc)) {
      return call(callback, Pouch.Errors.MISSING_ID);
    }
    return customApi.bulkDocs({docs: [doc]}, opts,
        autoCompact(yankError(callback)));
  };

  api.putAttachment = function (id, rev, blob, type, callback) {
    if (typeof type === 'function') {
      callback = type;
      type = blob;
      blob = rev;
      rev = null;
    }
    if (typeof type === 'undefined') {
      type = blob;
      blob = rev;
      rev = null;
    }
    id = parseDocId(id);

    function createAttachment(doc) {
      doc._attachments = doc._attachments || {};
      doc._attachments[id.attachmentId] = {
        content_type: type,
        data: blob
      };
      api.put(doc, callback);
    }

    api.get(id.docId, function(err, doc) {
      // create new doc
      if (err && err.error === Pouch.Errors.MISSING_DOC.error) {
        createAttachment({_id: id.docId});
        return;
      }
      if (err) {
        call(callback, err);
        return;
      }

      if (doc._rev !== rev) {
        call(callback, Pouch.Errors.REV_CONFLICT);
        return;
      }

      createAttachment(doc);
    });
  };

  api.removeAttachment = function (id, rev, callback) {
    id = parseDocId(id);
    api.get(id.docId, function(err, obj) {
      if (err) {
        call(callback, err);
        return;
      }

      if (obj._rev !== rev) {
        call(callback, Pouch.Errors.REV_CONFLICT);
        return;
      }

      obj._attachments = obj._attachments || {};
      delete obj._attachments[id.attachmentId];
      api.put(obj, callback);
    });
  };

  api.remove = function (doc, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    if (opts === undefined) {
      opts = {};
    }
    opts.was_delete = true;
    var newDoc = extend(true, {}, doc);
    newDoc._deleted = true;
    return customApi.bulkDocs({docs: [newDoc]}, opts, yankError(callback));
  };

  api.revsDiff = function (req, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    var ids = Object.keys(req);
    var count = 0;
    var missing = {};

    function readDoc(err, doc, id) {
      req[id].map(function(revId) {
        var matches = function(x) { return x.rev !== revId; };
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
  };

  // compact one document and fire callback
  // by compacting we mean removing all revisions which
  // are further from the leaf in revision tree than max_height
  var compactDocument = function(docId, max_height, callback) {
    customApi._getRevisionTree(docId, function(err, rev_tree){
      if (err) {
        return call(callback);
      }
      var height = computeHeight(rev_tree);
      var nonLeaves = [];
      Object.keys(height).forEach(function(rev) {
        if (height[rev] > max_height) {
          nonLeaves.push(rev);
        }
      });
      customApi._removeDocRevisions(docId, nonLeaves, callback);
    });
  };

  // compact the whole database using single document
  // compaction
  api.compact = function(callback) {
    api.allDocs(function(err, res) {
      var count = res.rows.length;
      if (!count) {
        call(callback);
        return;
      }
      res.rows.forEach(function(row) {
        compactDocument(row.key, 0, function() {
          count--;
          if (!count) {
            call(callback);
          }
        });
      });
    });
  };

  /* Begin api wrappers. Specific functionality to storage belongs in the _[method] */
  api.get = function (id, opts, callback) {
    if (!api.taskqueue.ready()) {
      api.taskqueue.addTask('get', arguments);
      return;
    }
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }

    var leaves = [];
    function finishOpenRevs() {
      var result = [];
      var count = leaves.length;
      if (!count) {
        return call(callback, null, result);
      }
      // order with open_revs is unspecified
      leaves.forEach(function(leaf){
        api.get(id, {rev: leaf, revs: opts.revs}, function(err, doc){
          if (!err) {
            result.push({ok: doc});
          } else {
            result.push({missing: leaf});
          }
          count--;
          if(!count) {
            call(callback, null, result);
          }
        });
      });
    }

    if (opts.open_revs) {
      if (opts.open_revs === "all") {
        customApi._getRevisionTree(id, function(err, rev_tree){
          if (err) {
            // if there's no such document we should treat this
            // situation the same way as if revision tree was empty
            rev_tree = [];
          }
          leaves = collectLeaves(rev_tree).map(function(leaf){
            return leaf.rev;
          });
          finishOpenRevs();
        });
      } else {
        if (Array.isArray(opts.open_revs)) {
          leaves = opts.open_revs;
          for (var i = 0; i < leaves.length; i++) {
            var l = leaves[i];
            // looks like it's the only thing couchdb checks
            if (!(typeof(l) === "string" && /^\d+-/.test(l))) {
              return call(callback, Pouch.error(Pouch.Errors.BAD_REQUEST,
                "Invalid rev format" ));
            }
          }
          finishOpenRevs();
        } else {
          return call(callback, Pouch.error(Pouch.Errors.UNKNOWN_ERROR,
            'function_clause'));
        }
      }
      return; // open_revs does not like other options
    }

    id = parseDocId(id);
    if (id.attachmentId !== '') {
      return customApi.getAttachment(id, callback);
    }
    return customApi._get(id, opts, function(result, metadata) {
      if ('error' in result) {
        return call(callback, result);
      }

      var doc = result;
      function finish() {
        call(callback, null, doc);
      }

      if (opts.conflicts) {
        var conflicts = collectConflicts(metadata);
        if (conflicts.length) {
          doc._conflicts = conflicts;
        }
      }

      if (opts.revs || opts.revs_info) {
        var path = arrayFirst(rootToLeaf(metadata.rev_tree), function(arr) {
          return arr.ids.indexOf(doc._rev.split('-')[1]) !== -1;
        });
        path.ids.splice(path.ids.indexOf(doc._rev.split('-')[1]) + 1);
        path.ids.reverse();

        if (opts.revs) {
          doc._revisions = {
            start: (path.pos + path.ids.length) - 1,
            ids: path.ids
          };
        }
        if (opts.revs_info) {
          // TODO: it could be slow to test status like this
          var count = path.ids.length;
          var pos = path.pos + path.ids.length - 1;
          doc._revs_info = [];

          path.ids.forEach(function(hash) {
            var rev = pos + '-' + hash;
            var info = {
              rev: rev,
              status: "available"
            };
            pos--;
            doc._revs_info.push(info);

            api.get(id.docId, {rev: rev}, function(err, ok) {
              if (err) {
                info.status = "missing";
              }
              count--;
              if (!count) {
                finish();
              }
            });
          });
        } else {
          finish();
        }
      } else {
        finish();
      }
      
    });
  };

  api.getAttachment = function(id, opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }
    if (typeof id === 'string') {
      id = parseDocId(id);
    }

    return customApi._getAttachment(id, opts, callback);
  };

  api.allDocs = function(opts, callback) {
    if (!api.taskqueue.ready()) {
      api.taskqueue.addTask('allDocs', arguments);
      return;
    }
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    if ('keys' in opts) {
      if ('startkey' in opts) {
        call(callback, Pouch.error(Pouch.Errors.QUERY_PARSE_ERROR,
          'Query parameter `start_key` is not compatible with multi-get'
        ));
        return;
      }
      if ('endkey' in opts) {
        call(callback, Pouch.error(Pouch.Errors.QUERY_PARSE_ERROR,
          'Query parameter `end_key` is not compatible with multi-get'
        ));
        return;
      }
    }

    return customApi._allDocs(opts, callback);
  };

  api.changes = function(opts) {
    if (!api.taskqueue.ready()) {
      api.taskqueue.addTask('changes', arguments);
      return;
    }
    opts = extend(true, {}, opts);
    return customApi._changes(opts);
  };

  api.close = function(callback) {
    if (!api.taskqueue.ready()) {
      api.taskqueue.addTask('close', arguments);
      return;
    }
    return customApi._close(callback);
  };

  api.info = function(callback) {
    if (!api.taskqueue.ready()) {
      api.taskqueue.addTask('info', arguments);
      return;
    }
    return customApi._info(callback);
  };

  api.id = function() {
    return customApi._id();
  };

  api.type = function() {
    return (typeof customApi._type === 'function') ? customApi._type() : opts.adapter;
  };

  api.bulkDocs = function(req, opts, callback) {
    if (!api.taskqueue.ready()) {
      api.taskqueue.addTask('bulkDocs', arguments);
      return;
    }
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    if (!opts) {
      opts = {};
    } else {
      opts = extend(true, {}, opts);
    }

    if (!req || !req.docs || req.docs.length < 1) {
      return call(callback, Pouch.Errors.MISSING_BULK_DOCS);
    }

    if (!Array.isArray(req.docs)) {
      return call(callback, Pouch.Errors.QUERY_PARSE_ERROR);
    }

    req = extend(true, {}, req);
    if (!('new_edits' in opts)) {
      opts.new_edits = true;
    }

    return customApi._bulkDocs(req, opts, autoCompact(callback));
  };

  /* End Wrappers */
  var taskqueue = {};

  taskqueue.ready = false;
  taskqueue.queue = [];

  api.taskqueue = {};

  api.taskqueue.execute = function (db) {
    if (taskqueue.ready) {
      taskqueue.queue.forEach(function(d) {
        db[d.task].apply(null, d.parameters);
      });
    }
  };

  api.taskqueue.ready = function() {
    if (arguments.length === 0) {
      return taskqueue.ready;
    }
    taskqueue.ready = arguments[0];
  };

  api.taskqueue.addTask = function(task, parameters) {
    taskqueue.queue.push({ task: task, parameters: parameters });
  };

  api.replicate = {};

  api.replicate.from = function (url, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    return Pouch.replicate(url, customApi, opts, callback);
  };

  api.replicate.to = function (dbName, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    return Pouch.replicate(customApi, dbName, opts, callback);
  };

  for (var j in api) {
    if (!customApi.hasOwnProperty(j)) {
      customApi[j] = api[j];
    }
  }

  // Http adapter can skip setup so we force the db to be ready and execute any jobs
  if (opts.skipSetup) {
    api.taskqueue.ready(true);
    api.taskqueue.execute(api);
  }

  return customApi;
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PouchAdapter;
}
