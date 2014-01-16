/*globals cordova */

"use strict";

var utils = require('./utils');
var merge = require('./merge');
var errors = require('./deps/errors');
var call = utils.call;

/*
 * A generic pouch adapter
 */

// returns first element of arr satisfying callback predicate
function arrayFirst(arr, callback) {
  for (var i = 0; i < arr.length; i++) {
    if (callback(arr[i], i) === true) {
      return arr[i];
    }
  }
  return false;
}

// Wrapper for functions that call the bulkdocs api with a single doc,
// if the first result is an error, return an error
function yankError(callback) {
  return function (err, results) {
    if (err || results[0].error) {
      call(callback, err || results[0]);
    } else {
      call(callback, null, results[0]);
    }
  };
}

// for every node in a revision tree computes its distance from the closest
// leaf
function computeHeight(revs) {
  var height = {};
  var edges = [];
  merge.traverseRevTree(revs, function (isLeaf, pos, id, prnt) {
    var rev = pos + "-" + id;
    if (isLeaf) {
      height[rev] = 0;
    }
    if (prnt !== undefined) {
      edges.push({from: prnt, to: rev});
    }
    return rev;
  });

  edges.reverse();
  edges.forEach(function (edge) {
    if (height[edge.from] === undefined) {
      height[edge.from] = 1 + height[edge.to];
    } else {
      height[edge.from] = Math.min(height[edge.from], 1 + height[edge.to]);
    }
  });
  return height;
}

module.exports = function (Pouch) {
  return function (opts, callback) {
    var api = {};

    var customApi = Pouch.adapters[opts.adapter](opts, function (err, db) {
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
        Pouch.open(opts, function (err) {
          callback(err, db);
        });
      }
    });

    var auto_compaction = (opts.auto_compaction === true);

    // wraps a callback with a function that runs compaction after each edit
    function autoCompact(callback) {
      if (!auto_compaction) {
        return callback;
      }
      return function (err, res) {
        if (err) {
          call(callback, err);
        } else {
          var count = res.length;
          var decCount = function () {
            count--;
            if (!count) {
              call(callback, null, res);
            }
          };
          res.forEach(function (doc) {
            if (doc.ok) {
              // TODO: we need better error handling
              compactDocument(doc.id, 1, decCount);
            } else {
              decCount();
            }
          });
        }
      };
    }

    api.post = utils.toPromise(function (doc, opts, callback) {
      if (typeof opts === 'function') {
        callback = opts;
        opts = {};
      }
      if (typeof doc !== 'object' || Array.isArray(doc)) {
        return call(callback, errors.NOT_AN_OBJECT);
      }
      return customApi.bulkDocs({docs: [doc]}, opts,
          autoCompact(yankError(callback)));
    });

    api.put = utils.toPromise(function (doc, opts, callback) {
      if (typeof opts === 'function') {
        callback = opts;
        opts = {};
      }
      if (typeof doc !== 'object') {
        return call(callback, errors.NOT_AN_OBJECT);
      }
      if (!utils.isValidId(doc._id)) {
        return call(callback, errors.MISSING_ID);
      }
      return customApi.bulkDocs({docs: [doc]}, opts,
          autoCompact(yankError(callback)));
    });

    api.putAttachment = utils.toPromise(function (docId, attachmentId, rev, blob, type, callback) {
      if (!api.taskqueue.ready()) {
        api.taskqueue.addTask('putAttachment', arguments);
        return;
      }
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

      api.get(docId, function (err, doc) {
        // create new doc
        if (err && err.error === errors.MISSING_DOC.error) {
          createAttachment({_id: docId});
          return;
        }
        if (err) {
          call(callback, err);
          return;
        }

        if (doc._rev !== rev) {
          call(callback, errors.REV_CONFLICT);
          return;
        }

        createAttachment(doc);
      });
    });

    api.removeAttachment = utils.toPromise(function (docId, attachmentId, rev, callback) {
      api.get(docId, function (err, obj) {
        if (err) {
          call(callback, err);
          return;
        }
        if (obj._rev !== rev) {
          call(callback, errors.REV_CONFLICT);
          return;
        }
        if (!obj._attachments) {
          return call(callback, null);
        }
        delete obj._attachments[attachmentId];
        if (Object.keys(obj._attachments).length === 0) {
          delete obj._attachments;
        }
        api.put(obj, callback);
      });
    });

    api.remove = utils.toPromise(function (doc, opts, callback) {
      if (typeof opts === 'function') {
        callback = opts;
        opts = {};
      }
      if (opts === undefined) {
        opts = {};
      }
      opts = utils.extend(true, {}, opts);
      opts.was_delete = true;
      var newDoc = {_id: doc._id, _rev: doc._rev};
      newDoc._deleted = true;
      return customApi.bulkDocs({docs: [newDoc]}, opts, yankError(callback));
    });

    api.revsDiff = utils.toPromise(function (req, opts, callback) {
      if (typeof opts === 'function') {
        callback = opts;
        opts = {};
      }
      opts = utils.extend(true, {}, opts);
      var ids = Object.keys(req);
      var count = 0;
      var missing = {};

      function addToMissing(id, revId) {
        if (!missing[id]) {
          missing[id] = {missing: []};
        }
        missing[id].missing.push(revId);
      }

      function processDoc(id, rev_tree) {
        // Is this fast enough? Maybe we should switch to a set simulated by a map
        var missingForId = req[id].slice(0);
        merge.traverseRevTree(rev_tree, function (isLeaf, pos, revHash, ctx,
          opts) {
            var rev = pos + '-' + revHash;
            var idx = missingForId.indexOf(rev);
            if (idx === -1) {
              return;
            }

            missingForId.splice(idx, 1);
            if (opts.status !== 'available') {
              addToMissing(id, rev);
            }
          });

        // Traversing the tree is synchronous, so now `missingForId` contains
        // revisions that were not found in the tree
        missingForId.forEach(function (rev) {
          addToMissing(id, rev);
        });
      }

      ids.map(function (id) {
        customApi._getRevisionTree(id, function (err, rev_tree) {
          if (err && err.name === 'not_found' && err.message === 'missing') {
            missing[id] = {missing: req[id]};
          } else if (err) {
            return call(callback, err);
          } else {
            processDoc(id, rev_tree);
          }

          if (++count === ids.length) {
            return call(callback, null, missing);
          }
        });
      });
    });

    // compact one document and fire callback
    // by compacting we mean removing all revisions which
    // are further from the leaf in revision tree than max_height
    function compactDocument(docId, max_height, callback) {
      customApi._getRevisionTree(docId, function (err, rev_tree) {
        if (err) {
          return call(callback);
        }
        var height = computeHeight(rev_tree);
        var candidates = [];
        var revs = [];
        Object.keys(height).forEach(function (rev) {
          if (height[rev] > max_height) {
            candidates.push(rev);
          }
        });

        merge.traverseRevTree(rev_tree, function (isLeaf, pos, revHash, ctx, opts) {
          var rev = pos + '-' + revHash;
          if (opts.status === 'available' && candidates.indexOf(rev) !== -1) {
            opts.status = 'missing';
            revs.push(rev);
          }
        });
        customApi._doCompaction(docId, rev_tree, revs, callback);
      });
    }

    // compact the whole database using single document
    // compaction
    api.compact = utils.toPromise(function (opts, callback) {
      if (typeof opts === 'function') {
        callback = opts;
        opts = {};
      }
      api.changes({complete: function (err, res) {
        if (err) {
          call(callback); // TODO: silently fail
          return;
        }
        var count = res.results.length;
        if (!count) {
          call(callback);
          return;
        }
        res.results.forEach(function (row) {
          compactDocument(row.id, 0, function () {
            count--;
            if (!count) {
              call(callback);
            }
          });
        });
      }});
    });

    /* Begin api wrappers. Specific functionality to storage belongs in the _[method] */
    api.get = utils.toPromise(function (id, opts, callback) {
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
        leaves.forEach(function (leaf) {
          api.get(id, {rev: leaf, revs: opts.revs}, function (err, doc) {
            if (!err) {
              result.push({ok: doc});
            } else {
              result.push({missing: leaf});
            }
            count--;
            if (!count) {
              call(callback, null, result);
            }
          });
        });
      }

      if (opts.open_revs) {
        if (opts.open_revs === "all") {
          customApi._getRevisionTree(id, function (err, rev_tree) {
            if (err) {
              // if there's no such document we should treat this
              // situation the same way as if revision tree was empty
              rev_tree = [];
            }
            leaves = merge.collectLeaves(rev_tree).map(function (leaf) {
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
                return call(callback, errors.error(errors.BAD_REQUEST,
                  "Invalid rev format"));
              }
            }
            finishOpenRevs();
          } else {
            return call(callback, errors.error(errors.UNKNOWN_ERROR,
              'function_clause'));
          }
        }
        return; // open_revs does not like other options
      }

      return customApi._get(id, opts, function (err, result) {
        opts = utils.extend(true, {}, opts);
        if (err) {
          return call(callback, err);
        }

        var doc = result.doc;
        var metadata = result.metadata;
        var ctx = result.ctx;

        if (opts.conflicts) {
          var conflicts = merge.collectConflicts(metadata);
          if (conflicts.length) {
            doc._conflicts = conflicts;
          }
        }

        if (opts.revs || opts.revs_info) {
          var paths = merge.rootToLeaf(metadata.rev_tree);
          var path = arrayFirst(paths, function (arr) {
            return arr.ids.map(function (x) { return x.id; })
              .indexOf(doc._rev.split('-')[1]) !== -1;
          });

          path.ids.splice(path.ids.map(function (x) {return x.id; })
                          .indexOf(doc._rev.split('-')[1]) + 1);
          path.ids.reverse();

          if (opts.revs) {
            doc._revisions = {
              start: (path.pos + path.ids.length) - 1,
              ids: path.ids.map(function (rev) {
                return rev.id;
              })
            };
          }
          if (opts.revs_info) {
            var pos =  path.pos + path.ids.length;
            doc._revs_info = path.ids.map(function (rev) {
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
          Object.keys(attachments).forEach(function (key) {
            customApi._getAttachment(attachments[key], {encode: true, ctx: ctx}, function (err, data) {
              doc._attachments[key].data = data;
              if (!--count) {
                call(callback, null, doc);
              }
            });
          });
        } else {
          if (doc._attachments) {
            for (var key in doc._attachments) {
              doc._attachments[key].stub = true;
            }
          }
          call(callback, null, doc);
        }
      });
    });

    api.getAttachment = utils.toPromise(function (docId, attachmentId, opts, callback) {
      if (!api.taskqueue.ready()) {
        api.taskqueue.addTask('getAttachment', arguments);
        return;
      }
      if (opts instanceof Function) {
        callback = opts;
        opts = {};
      }
      opts = utils.extend(true, {}, opts);
      customApi._get(docId, opts, function (err, res) {
        if (err) {
          return call(callback, err);
        }
        if (res.doc._attachments && res.doc._attachments[attachmentId]) {
          opts.ctx = res.ctx;
          customApi._getAttachment(res.doc._attachments[attachmentId], opts, callback);
        } else {
          return call(callback, errors.MISSING_DOC);
        }
      });
    });

    api.allDocs = utils.toPromise(function (opts, callback) {
      if (!api.taskqueue.ready()) {
        api.taskqueue.addTask('allDocs', arguments);
        return;
      }
      if (typeof opts === 'function') {
        callback = opts;
        opts = {};
      }
      opts = utils.extend(true, {}, opts);
      if ('keys' in opts) {
        if ('startkey' in opts) {
          call(callback, errors.error(errors.QUERY_PARSE_ERROR,
            'Query parameter `start_key` is not compatible with multi-get'
          ));
          return;
        }
        if ('endkey' in opts) {
          call(callback, errors.error(errors.QUERY_PARSE_ERROR,
            'Query parameter `end_key` is not compatible with multi-get'
          ));
          return;
        }
      }
      if (typeof opts.skip === 'undefined') {
        opts.skip = 0;
      }

      return customApi._allDocs(opts, callback);
    });

    function processChange(doc, metadata, opts) {
      var changeList = [{rev: doc._rev}];
      if (opts.style === 'all_docs') {
        changeList = merge.collectLeaves(metadata.rev_tree)
        .map(function (x) { return {rev: x.rev}; });
      }
      var change = {
        id: metadata.id,
        changes: changeList,
        doc: doc
      };

      if (utils.isDeleted(metadata, doc._rev)) {
        change.deleted = true;
      }
      if (opts.conflicts) {
        change.doc._conflicts = merge.collectConflicts(metadata);
        if (!change.doc._conflicts.length) {
          delete change.doc._conflicts;
        }
      }
      return change;
    }
    api.changes = function (opts) {
      if (!api.taskqueue.ready()) {
        var task = api.taskqueue.addTask('changes', arguments);
        return {
          cancel: function () {
            if (task.task) {
              return task.task.cancel();
            }
            if (Pouch.DEBUG) {
              //console.log('Cancel Changes Feed');
            }
            task.parameters[0].aborted = true;
          }
        };
      }
      opts = utils.extend(true, {}, opts);
      opts.processChange = processChange;

      if (!opts.since) {
        opts.since = 0;
      }
      if (opts.since === 'latest') {
        var changes;
        api.info(function (err, info) {
          if (!opts.aborted) {
            opts.since = info.update_seq  - 1;
            api.changes(opts);
          }
        });
        // Return a method to cancel this method from processing any more
        return {
          cancel: function () {
            if (changes) {
              return changes.cancel();
            }
            if (Pouch.DEBUG) {
              //console.log('Cancel Changes Feed');
            }
            opts.aborted = true;
          }
        };
      }

      if (opts.filter && typeof opts.filter === 'string') {
        if (opts.filter === '_view') {
          if (opts.view && typeof opts.view === 'string') {
            // fetch a view from a design doc, make it behave like a filter
            var viewName = opts.view.split('/');
            api.get('_design/' + viewName[0], function (err, ddoc) {
              if (ddoc && ddoc.views && ddoc.views[viewName[1]]) {
                /*jshint evil: true */
                var filter = eval('(function () {' + 
                                  '  return function (doc) {' + 
                                  '    var emitted = false;' + 
                                  '    var emit = function (a, b) {' + 
                                  '      emitted = true;' + 
                                  '    };' + 
                                  '    var view = ' + ddoc.views[viewName[1]].map + ';' + 
                                  '    view(doc);' + 
                                  '    if (emitted) {' + 
                                  '      return true;' + 
                                  '    }' + 
                                  '  }' + 
                                  '})()');
                if (!opts.aborted) {
                  opts.filter = filter;
                  api.changes(opts);
                }
              } else {
                var msg = ddoc.views ? 'missing json key: ' + viewName[1] :
                  'missing json key: views';
                err = err || errors.error(errors.MISSING_DOC, msg);
                utils.call(opts.complete, err);
              }
            });
          } else {
            var err = errors.error(errors.BAD_REQUEST,
                                  '`view` filter parameter is not provided.');
            utils.call(opts.complete, err);
          }
        } else {
          // fetch a filter from a design doc
          var filterName = opts.filter.split('/');
          api.get('_design/' + filterName[0], function (err, ddoc) {
            if (ddoc && ddoc.filters && ddoc.filters[filterName[1]]) {
              /*jshint evil: true */
              var filter = eval('(function () { return ' +
                                ddoc.filters[filterName[1]] + ' })()');
              if (!opts.aborted) {
                opts.filter = filter;
                api.changes(opts);
              }
            } else {
              var msg = (ddoc && ddoc.filters) ? 'missing json key: ' + filterName[1]
                : 'missing json key: filters';
              err = err || errors.error(errors.MISSING_DOC, msg);
              utils.call(opts.complete, err);
            }
          });
        }
        // Return a method to cancel this method from processing any more
        return {
          cancel: function () {
            if (Pouch.DEBUG) {
              console.log('Cancel Changes Feed');
            }
            opts.aborted = true;
          }
        };
      }

      if (!('descending' in opts)) {
        opts.descending = false;
      }

      // 0 and 1 should return 1 document
      opts.limit = opts.limit === 0 ? 1 : opts.limit;
      return customApi._changes(opts);
    };

    api.close = utils.toPromise(function (callback) {
      if (!api.taskqueue.ready()) {
        api.taskqueue.addTask('close', arguments);
        return;
      }
      return customApi._close(callback);
    });

    api.info = utils.toPromise(function (callback) {
      if (!api.taskqueue.ready()) {
        api.taskqueue.addTask('info', arguments);
        return;
      }
      return customApi._info(callback);
    });

    api.id = function () {
      return customApi._id();
    };

    api.type = function () {
      return (typeof customApi._type === 'function') ? customApi._type() : opts.adapter;
    };

    api.bulkDocs = utils.toPromise(function (req, opts, callback) {
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
        opts = utils.extend(true, {}, opts);
      }

      if (!req || !req.docs || req.docs.length < 1) {
        return call(callback, errors.MISSING_BULK_DOCS);
      }

      if (!Array.isArray(req.docs)) {
        return call(callback, errors.QUERY_PARSE_ERROR);
      }

      for (var i = 0; i < req.docs.length; ++i) {
        if (typeof req.docs[i] !== 'object' || Array.isArray(req.docs[i])) {
          return call(callback, errors.NOT_AN_OBJECT);
        }
      }

      req = utils.extend(true, {}, req);
      if (!('new_edits' in opts)) {
        opts.new_edits = true;
      }

      return customApi._bulkDocs(req, opts, autoCompact(callback));
    });

    /* End Wrappers */
    var taskqueue = {};

    taskqueue.ready = false;
    taskqueue.queue = [];

    api.taskqueue = {};

    api.taskqueue.execute = function (db) {
      if (taskqueue.ready) {
        taskqueue.queue.forEach(function (d) {
          d.task = db[d.name].apply(null, d.parameters);
        });
      }
    };

    api.taskqueue.ready = function () {
      if (arguments.length === 0) {
        return taskqueue.ready;
      }
      taskqueue.ready = arguments[0];
    };

    api.taskqueue.addTask = function (name, parameters) {
      var task = { name: name, parameters: parameters };
      taskqueue.queue.push(task);
      return task;
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

    if (utils.isCordova()) {
      //to inform websql adapter that we can use api
      cordova.fireWindowEvent(opts.name + "_pouch", {});
    }
    return customApi;
  };
};
