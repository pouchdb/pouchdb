/*globals Pouch: true, yankError: false, extend: false, call: false, parseDocId: false, traverseRevTree: false */
/*globals arrayFirst: false, rootToLeaf: false, computeHeight: false */
/*globals cordova, isCordova */

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
    if (opts.name === Pouch.prefix + Pouch.ALL_DBS) {
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
    if (typeof doc !== 'object' || Array.isArray(doc)) {
      return call(callback, Pouch.Errors.NOT_AN_OBJECT);
    }
    return customApi.bulkDocs({docs: [doc]}, opts,
        autoCompact(yankError(callback)));
  };

  api.put = function(doc, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    if (typeof doc !== 'object') {
      return call(callback, Pouch.Errors.NOT_AN_OBJECT);
    }
    if (!('_id' in doc)) {
      return call(callback, Pouch.Errors.MISSING_ID);
    }
    return customApi.bulkDocs({docs: [doc]}, opts,
        autoCompact(yankError(callback)));
  };

  api.putAttachment = function (docId, attachmentId, rev, blob, type, callback) {
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

    function createAttachment(doc) {
      doc._attachments = doc._attachments || {};
      doc._attachments[attachmentId] = {
        content_type: type,
        data: blob
      };
      api.put(doc, callback);
    }

    api.get(docId, function(err, doc) {
      // create new doc
      if (err && err.error === Pouch.Errors.MISSING_DOC.error) {
        createAttachment({_id: docId});
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

  api.removeAttachment = function (docId, attachmentId, rev, callback) {
    api.get(docId, function(err, obj) {
      if (err) {
        call(callback, err);
        return;
      }
      if (obj._rev !== rev) {
        call(callback, Pouch.Errors.REV_CONFLICT);
        return;
      }
      if (!obj._attachments) {
        return call(callback, null);
      }
      delete obj._attachments[attachmentId];
      if (Object.keys(obj._attachments).length === 0){
        delete obj._attachments;
      }
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
    var newDoc = {_id: doc._id, _rev: doc._rev};
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
      var candidates = [];
      var revs = [];
      Object.keys(height).forEach(function(rev) {
        if (height[rev] > max_height) {
          candidates.push(rev);
        }
      });

      Pouch.merge.traverseRevTree(rev_tree, function(isLeaf, pos, revHash, ctx, opts) {
        var rev = pos + '-' + revHash;
        if (opts.status === 'available' && candidates.indexOf(rev) !== -1) {
          opts.status = 'missing';
          revs.push(rev);
        }
      });
      customApi._doCompaction(docId, rev_tree, revs, callback);
    });
  };

  // compact the whole database using single document
  // compaction
  api.compact = function(callback) {
    api.changes({complete: function(err, res) {
      if (err) {
        call(callback); // TODO: silently fail
        return;
      }
      var count = res.results.length;
      if (!count) {
        call(callback);
        return;
      }
      res.results.forEach(function(row) {
        compactDocument(row.id, 0, function() {
          count--;
          if (!count) {
            call(callback);
          }
        });
      });
    }});
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
          leaves = Pouch.merge.collectLeaves(rev_tree).map(function(leaf){
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

    return customApi._get(id, opts, function(err, result) {
      if (err) {
        return call(callback, err);
      }

      var doc = result.doc;
      var metadata = result.metadata;
      var ctx = result.ctx;

      if (opts.conflicts) {
        var conflicts = Pouch.merge.collectConflicts(metadata);
        if (conflicts.length) {
          doc._conflicts = conflicts;
        }
      }

      if (opts.revs || opts.revs_info) {
        var paths = rootToLeaf(metadata.rev_tree);
        var path = arrayFirst(paths, function(arr) {
          return arr.ids.map(function(x) { return x.id; })
            .indexOf(doc._rev.split('-')[1]) !== -1;
        });

        path.ids.splice(path.ids.map(function(x) {return x.id;})
                        .indexOf(doc._rev.split('-')[1]) + 1);
        path.ids.reverse();

        if (opts.revs) {
          doc._revisions = {
            start: (path.pos + path.ids.length) - 1,
            ids: path.ids.map(function(rev) {
              return rev.id;
            })
          };
        }
        if (opts.revs_info) {
          var pos =  path.pos + path.ids.length;
          doc._revs_info = path.ids.map(function(rev) {
            pos--;
            return {
              rev: pos + '-' + rev.id,
              status: rev.opts.status
            };
          });
        }
      }

      if (opts.local_seq) {
        doc._local_seq = result.metadata.seq;
      }

      if (opts.attachments && doc._attachments) {
        var attachments = doc._attachments;
        var count = Object.keys(attachments).length;
        if (count === 0) {
          return call(callback, null, doc);
        }
        Object.keys(attachments).forEach(function(key) {
          customApi._getAttachment(attachments[key], {encode: true, ctx: ctx}, function(err, data) {
            doc._attachments[key].data = data;
            if (!--count){
              call(callback, null, doc);
            }
          });
        });
      } else {
        if (doc._attachments){
          for (var key in doc._attachments) {
            doc._attachments[key].stub = true;
          }
        }
        call(callback, null, doc);
      }
    });
  };

  api.getAttachment = function(docId, attachmentId, opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }
    customApi._get(docId, opts, function(err, res) {
      if (err) {
        return call(callback, err);
      }
      if (res.doc._attachments && res.doc._attachments[attachmentId]) {
        opts.ctx = res.ctx;
        customApi._getAttachment(res.doc._attachments[attachmentId], opts, callback);
      } else {
        return call(callback, Pouch.Errors.MISSING_DOC);
      }
    });
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

    if (!opts.since) {
      opts.since = 0;
    }

    if (!('descending' in opts)) {
      opts.descending = false;
    }

    // 0 and 1 should return 1 document
    opts.limit = opts.limit === 0 ? 1 : opts.limit;
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

    for (var i = 0; i < req.docs.length; ++i) {
      if (typeof req.docs[i] !== 'object' || Array.isArray(req.docs[i])) {
        return call(callback, Pouch.Errors.NOT_AN_OBJECT);
      }
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

  if (isCordova()){
    //to inform websql adapter that we can use api
    cordova.fireWindowEvent(opts.name + "_pouch", {});
  }
  return customApi;
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PouchAdapter;
}
