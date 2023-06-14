import { a as adapterFun, b as bulkGet, p as pick } from './bulkGetShim-75479c95.js';
import EE from 'node:events';
import { i as immediate, h as hasLocalStorage } from './functionName-4d6db487.js';
import { c as clone } from './clone-f35bcc51.js';
import { g as guardedConsole } from './guardedConsole-f54e5a40.js';
import { createError, MISSING_DOC, UNKNOWN_ERROR, NOT_AN_OBJECT, REV_CONFLICT, INVALID_ID, INVALID_REV, QUERY_PARSE_ERROR, MISSING_BULK_DOCS, BAD_REQUEST } from './pouchdb-errors.browser.js';
import { l as listenerCount, i as invalidIdError, r as rev, v as v4 } from './rev-d51344b8.js';
import { i as isRemote } from './isRemote-f9121da9.js';
import { u as upsert } from './upsert-331b6913.js';
import { o as once } from './toPromise-06b5d6a8.js';
import './spark-md5-2c57e5fc.js';
import { a as collectLeaves, c as collectConflicts } from './collectConflicts-6afe46fc.js';
import { i as isDeleted, a as isLocalId } from './isLocalId-d067de54.js';
import { t as traverseRevTree, r as rootToLeaf } from './rootToLeaf-f8d0e78a.js';
import { f as findPathToLeaf } from './findPathToLeaf-7e69c93c.js';
import { fetch } from './pouchdb-fetch.browser.js';
import applyChangesFilterPlugin from './pouchdb-changes-filter.browser.js';
import './_commonjsHelpers-24198af3.js';
import './__node-resolve_empty-b1d43ca8.js';
import './stringMd5-browser-5aecd2bd.js';
import './normalizeDdocFunctionName-ea3481cf.js';
import './pouchdb-selector-core.browser.js';
import './index-3a476dad.js';
import './scopeEval-ff3a416d.js';

function tryCatchInChangeListener(self, change, pending, lastSeq) {
  // isolate try/catches to avoid V8 deoptimizations
  try {
    self.emit('change', change, pending, lastSeq);
  } catch (e) {
    guardedConsole('error', 'Error in .on("change", function):', e);
  }
}

function processChange(doc, metadata, opts) {
  var changeList = [{rev: doc._rev}];
  if (opts.style === 'all_docs') {
    changeList = collectLeaves(metadata.rev_tree)
    .map(function (x) { return {rev: x.rev}; });
  }
  var change = {
    id: metadata.id,
    changes: changeList,
    doc: doc
  };

  if (isDeleted(metadata, doc._rev)) {
    change.deleted = true;
  }
  if (opts.conflicts) {
    change.doc._conflicts = collectConflicts(metadata);
    if (!change.doc._conflicts.length) {
      delete change.doc._conflicts;
    }
  }
  return change;
}

class Changes extends EE {
  constructor(db, opts, callback) {
    super();
    this.db = db;
    opts = opts ? clone(opts) : {};
    var complete = opts.complete = once((err, resp) => {
      if (err) {
        if (listenerCount(this, 'error') > 0) {
          this.emit('error', err);
        }
      } else {
        this.emit('complete', resp);
      }
      this.removeAllListeners();
      db.removeListener('destroyed', onDestroy);
    });
    if (callback) {
      this.on('complete', function (resp) {
        callback(null, resp);
      });
      this.on('error', callback);
    }
    const onDestroy = () => {
      this.cancel();
    };
    db.once('destroyed', onDestroy);
  
    opts.onChange = (change, pending, lastSeq) => {
      /* istanbul ignore if */
      if (this.isCancelled) {
        return;
      }
      tryCatchInChangeListener(this, change, pending, lastSeq);
    };
  
    var promise = new Promise(function (fulfill, reject) {
      opts.complete = function (err, res) {
        if (err) {
          reject(err);
        } else {
          fulfill(res);
        }
      };
    });
    this.once('cancel', function () {
      db.removeListener('destroyed', onDestroy);
      opts.complete(null, {status: 'cancelled'});
    });
    this.then = promise.then.bind(promise);
    this['catch'] = promise['catch'].bind(promise);
    this.then(function (result) {
      complete(null, result);
    }, complete);
  
  
  
    if (!db.taskqueue.isReady) {
      db.taskqueue.addTask((failed) => {
        if (failed) {
          opts.complete(failed);
        } else if (this.isCancelled) {
          this.emit('cancel');
        } else {
          this.validateChanges(opts);
        }
      });
    } else {
      this.validateChanges(opts);
    }
  }

  cancel() {
    this.isCancelled = true;
    if (this.db.taskqueue.isReady) {
      this.emit('cancel');
    }
  }

  validateChanges(opts) {
    var callback = opts.complete;
  
    /* istanbul ignore else */
    if (PouchDB$1._changesFilterPlugin) {
      PouchDB$1._changesFilterPlugin.validate(opts, (err) => {
        if (err) {
          return callback(err);
        }
        this.doChanges(opts);
      });
    } else {
      this.doChanges(opts);
    }
  }

  doChanges(opts) {
    var callback = opts.complete;
  
    opts = clone(opts);
    if ('live' in opts && !('continuous' in opts)) {
      opts.continuous = opts.live;
    }
    opts.processChange = processChange;
  
    if (opts.since === 'latest') {
      opts.since = 'now';
    }
    if (!opts.since) {
      opts.since = 0;
    }
    if (opts.since === 'now') {
      this.db.info().then((info) => {
        /* istanbul ignore if */
        if (this.isCancelled) {
          callback(null, {status: 'cancelled'});
          return;
        }
        opts.since = info.update_seq;
        this.doChanges(opts);
      }, callback);
      return;
    }
  
    /* istanbul ignore else */
    if (PouchDB$1._changesFilterPlugin) {
      PouchDB$1._changesFilterPlugin.normalize(opts);
      if (PouchDB$1._changesFilterPlugin.shouldFilter(this, opts)) {
        return PouchDB$1._changesFilterPlugin.filter(this, opts);
      }
    } else {
      ['doc_ids', 'filter', 'selector', 'view'].forEach(function (key) {
        if (key in opts) {
          guardedConsole('warn',
            'The "' + key + '" option was passed in to changes/replicate, ' +
            'but pouchdb-changes-filter plugin is not installed, so it ' +
            'was ignored. Please install the plugin to enable filtering.'
          );
        }
      });
    }
  
    if (!('descending' in opts)) {
      opts.descending = false;
    }
  
    // 0 and 1 should return 1 document
    opts.limit = opts.limit === 0 ? 1 : opts.limit;
    opts.complete = callback;
    var newPromise = this.db._changes(opts);
    /* istanbul ignore else */
    if (newPromise && typeof newPromise.cancel === 'function') {
      const cancel = this.cancel;
      this.cancel = (...args) => {
        newPromise.cancel();
        cancel.apply(this, args);
      };
    }
  }
}

/*
 * A generic pouch adapter
 */

function compare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

// Wrapper for functions that call the bulkdocs api with a single doc,
// if the first result is an error, return an error
function yankError(callback, docId) {
  return function (err, results) {
    if (err || (results[0] && results[0].error)) {
      err = err || results[0];
      err.docId = docId;
      callback(err);
    } else {
      callback(null, results.length ? results[0]  : results);
    }
  };
}

// clean docs given to us by the user
function cleanDocs(docs) {
  for (var i = 0; i < docs.length; i++) {
    var doc = docs[i];
    if (doc._deleted) {
      delete doc._attachments; // ignore atts for deleted docs
    } else if (doc._attachments) {
      // filter out extraneous keys from _attachments
      var atts = Object.keys(doc._attachments);
      for (var j = 0; j < atts.length; j++) {
        var att = atts[j];
        doc._attachments[att] = pick(doc._attachments[att],
          ['data', 'digest', 'content_type', 'length', 'revpos', 'stub']);
      }
    }
  }
}

// compare two docs, first by _id then by _rev
function compareByIdThenRev(a, b) {
  var idCompare = compare(a._id, b._id);
  if (idCompare !== 0) {
    return idCompare;
  }
  var aStart = a._revisions ? a._revisions.start : 0;
  var bStart = b._revisions ? b._revisions.start : 0;
  return compare(aStart, bStart);
}

// for every node in a revision tree computes its distance from the closest
// leaf
function computeHeight(revs) {
  var height = {};
  var edges = [];
  traverseRevTree(revs, function (isLeaf, pos, id, prnt) {
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

function allDocsKeysParse(opts) {
  var keys =  ('limit' in opts) ?
    opts.keys.slice(opts.skip, opts.limit + opts.skip) :
    (opts.skip > 0) ? opts.keys.slice(opts.skip) : opts.keys;
  opts.keys = keys;
  opts.skip = 0;
  delete opts.limit;
  if (opts.descending) {
    keys.reverse();
    opts.descending = false;
  }
}

// all compaction is done in a queue, to avoid attaching
// too many listeners at once
function doNextCompaction(self) {
  var task = self._compactionQueue[0];
  var opts = task.opts;
  var callback = task.callback;
  self.get('_local/compaction').catch(function () {
    return false;
  }).then(function (doc) {
    if (doc && doc.last_seq) {
      opts.last_seq = doc.last_seq;
    }
    self._compact(opts, function (err, res) {
      /* istanbul ignore if */
      if (err) {
        callback(err);
      } else {
        callback(null, res);
      }
      immediate(function () {
        self._compactionQueue.shift();
        if (self._compactionQueue.length) {
          doNextCompaction(self);
        }
      });
    });
  });
}

function appendPurgeSeq(db, docId, rev) {
  return db.get('_local/purges').then(function (doc) {
    const purgeSeq = doc.purgeSeq + 1;
    doc.purges.push({
      docId,
      rev,
      purgeSeq,
    });
    if (doc.purges.length > self.purged_infos_limit) {
      doc.purges.splice(0, doc.purges.length - self.purged_infos_limit);
    }
    doc.purgeSeq = purgeSeq;
    return doc;
  }).catch(function (err) {
    if (err.status !== 404) {
      throw err;
    }
    return {
      _id: '_local/purges',
      purges: [{
        docId,
        rev,
        purgeSeq: 0,
      }],
      purgeSeq: 0,
    };
  }).then(function (doc) {
    return db.put(doc);
  });
}

function attachmentNameError(name) {
  if (name.charAt(0) === '_') {
    return name + ' is not a valid attachment name, attachment ' +
      'names cannot start with \'_\'';
  }
  return false;
}

class AbstractPouchDB extends EE {
  _setup() {
    this.post = adapterFun('post', function (doc, opts, callback) {
      if (typeof opts === 'function') {
        callback = opts;
        opts = {};
      }
      if (typeof doc !== 'object' || Array.isArray(doc)) {
        return callback(createError(NOT_AN_OBJECT));
      }
      this.bulkDocs({docs: [doc]}, opts, yankError(callback, doc._id));
    }).bind(this);

    this.put = adapterFun('put', function (doc, opts, cb) {
      if (typeof opts === 'function') {
        cb = opts;
        opts = {};
      }
      if (typeof doc !== 'object' || Array.isArray(doc)) {
        return cb(createError(NOT_AN_OBJECT));
      }
      invalidIdError(doc._id);
      if (isLocalId(doc._id) && typeof this._putLocal === 'function') {
        if (doc._deleted) {
          return this._removeLocal(doc, cb);
        } else {
          return this._putLocal(doc, cb);
        }
      }

      const putDoc = (next) => {
        if (typeof this._put === 'function' && opts.new_edits !== false) {
          this._put(doc, opts, next);
        } else {
          this.bulkDocs({docs: [doc]}, opts, yankError(next, doc._id));
        }
      };

      if (opts.force && doc._rev) {
        transformForceOptionToNewEditsOption();
        putDoc(function (err) {
          var result = err ? null : {ok: true, id: doc._id, rev: doc._rev};
          cb(err, result);
        });
      } else {
        putDoc(cb);
      }

      function transformForceOptionToNewEditsOption() {
        var parts = doc._rev.split('-');
        var oldRevId = parts[1];
        var oldRevNum = parseInt(parts[0], 10);

        var newRevNum = oldRevNum + 1;
        var newRevId = rev();

        doc._revisions = {
          start: newRevNum,
          ids: [newRevId, oldRevId]
        };
        doc._rev = newRevNum + '-' + newRevId;
        opts.new_edits = false;
      }
    }).bind(this);

    this.putAttachment = adapterFun('putAttachment', function (docId, attachmentId, rev, blob, type) {
      var api = this;
      if (typeof type === 'function') {
        type = blob;
        blob = rev;
        rev = null;
      }
      // Lets fix in https://github.com/pouchdb/pouchdb/issues/3267
      /* istanbul ignore if */
      if (typeof type === 'undefined') {
        type = blob;
        blob = rev;
        rev = null;
      }
      if (!type) {
        guardedConsole('warn', 'Attachment', attachmentId, 'on document', docId, 'is missing content_type');
      }

      function createAttachment(doc) {
        var prevrevpos = '_rev' in doc ? parseInt(doc._rev, 10) : 0;
        doc._attachments = doc._attachments || {};
        doc._attachments[attachmentId] = {
          content_type: type,
          data: blob,
          revpos: ++prevrevpos
        };
        return api.put(doc);
      }

      return api.get(docId).then(function (doc) {
        if (doc._rev !== rev) {
          throw createError(REV_CONFLICT);
        }

        return createAttachment(doc);
      }, function (err) {
        // create new doc
        /* istanbul ignore else */
        if (err.reason === MISSING_DOC.message) {
          return createAttachment({_id: docId});
        } else {
          throw err;
        }
      });
    }).bind(this);

    this.removeAttachment = adapterFun('removeAttachment', function (docId, attachmentId, rev, callback) {
      this.get(docId, (err, obj) => {
        /* istanbul ignore if */
        if (err) {
          callback(err);
          return;
        }
        if (obj._rev !== rev) {
          callback(createError(REV_CONFLICT));
          return;
        }
        /* istanbul ignore if */
        if (!obj._attachments) {
          return callback();
        }
        delete obj._attachments[attachmentId];
        if (Object.keys(obj._attachments).length === 0) {
          delete obj._attachments;
        }
        this.put(obj, callback);
      });
    }).bind(this);

    this.remove = adapterFun('remove', function (docOrId, optsOrRev, opts, callback) {
      var doc;
      if (typeof optsOrRev === 'string') {
        // id, rev, opts, callback style
        doc = {
          _id: docOrId,
          _rev: optsOrRev
        };
        if (typeof opts === 'function') {
          callback = opts;
          opts = {};
        }
      } else {
        // doc, opts, callback style
        doc = docOrId;
        if (typeof optsOrRev === 'function') {
          callback = optsOrRev;
          opts = {};
        } else {
          callback = opts;
          opts = optsOrRev;
        }
      }
      opts = opts || {};
      opts.was_delete = true;
      var newDoc = {_id: doc._id, _rev: (doc._rev || opts.rev)};
      newDoc._deleted = true;
      if (isLocalId(newDoc._id) && typeof this._removeLocal === 'function') {
        return this._removeLocal(doc, callback);
      }
      this.bulkDocs({docs: [newDoc]}, opts, yankError(callback, newDoc._id));
    }).bind(this);

    this.revsDiff = adapterFun('revsDiff', function (req, opts, callback) {
      if (typeof opts === 'function') {
        callback = opts;
        opts = {};
      }
      var ids = Object.keys(req);

      if (!ids.length) {
        return callback(null, {});
      }

      var count = 0;
      var missing = new Map();

      function addToMissing(id, revId) {
        if (!missing.has(id)) {
          missing.set(id, {missing: []});
        }
        missing.get(id).missing.push(revId);
      }

      function processDoc(id, rev_tree) {
        // Is this fast enough? Maybe we should switch to a set simulated by a map
        var missingForId = req[id].slice(0);
        traverseRevTree(rev_tree, function (isLeaf, pos, revHash, ctx,
          opts) {
            var rev = pos + '-' + revHash;
            var idx = missingForId.indexOf(rev);
            if (idx === -1) {
              return;
            }

            missingForId.splice(idx, 1);
            /* istanbul ignore if */
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
        this._getRevisionTree(id, function (err, rev_tree) {
          if (err && err.status === 404 && err.message === 'missing') {
            missing.set(id, {missing: req[id]});
          } else if (err) {
            /* istanbul ignore next */
            return callback(err);
          } else {
            processDoc(id, rev_tree);
          }

          if (++count === ids.length) {
            // convert LazyMap to object
            var missingObj = {};
            missing.forEach(function (value, key) {
              missingObj[key] = value;
            });
            return callback(null, missingObj);
          }
        });
      }, this);
    }).bind(this);

    // _bulk_get API for faster replication, as described in
    // https://github.com/apache/couchdb-chttpd/pull/33
    // At the "abstract" level, it will just run multiple get()s in
    // parallel, because this isn't much of a performance cost
    // for local databases (except the cost of multiple transactions, which is
    // small). The http adapter overrides this in order
    // to do a more efficient single HTTP request.
    this.bulkGet = adapterFun('bulkGet', function (opts, callback) {
      bulkGet(this, opts, callback);
    }).bind(this);

    // compact one document and fire callback
    // by compacting we mean removing all revisions which
    // are further from the leaf in revision tree than max_height
    this.compactDocument = adapterFun('compactDocument', function (docId, maxHeight, callback) {
      this._getRevisionTree(docId, (err, revTree) => {
        /* istanbul ignore if */
        if (err) {
          return callback(err);
        }
        var height = computeHeight(revTree);
        var candidates = [];
        var revs = [];
        Object.keys(height).forEach(function (rev) {
          if (height[rev] > maxHeight) {
            candidates.push(rev);
          }
        });

        traverseRevTree(revTree, function (isLeaf, pos, revHash, ctx, opts) {
          var rev = pos + '-' + revHash;
          if (opts.status === 'available' && candidates.indexOf(rev) !== -1) {
            revs.push(rev);
          }
        });
        this._doCompaction(docId, revs, callback);
      });
    }).bind(this);

    // compact the whole database using single document
    // compaction
    this.compact = adapterFun('compact', function (opts, callback) {
      if (typeof opts === 'function') {
        callback = opts;
        opts = {};
      }

      opts = opts || {};

      this._compactionQueue = this._compactionQueue || [];
      this._compactionQueue.push({opts: opts, callback: callback});
      if (this._compactionQueue.length === 1) {
        doNextCompaction(this);
      }
    }).bind(this);

    /* Begin api wrappers. Specific functionality to storage belongs in the _[method] */
    this.get = adapterFun('get', function (id, opts, cb) {
      if (typeof opts === 'function') {
        cb = opts;
        opts = {};
      }
      if (typeof id !== 'string') {
        return cb(createError(INVALID_ID));
      }
      if (isLocalId(id) && typeof this._getLocal === 'function') {
        return this._getLocal(id, cb);
      }
      var leaves = [];

      const finishOpenRevs = () => {
        var result = [];
        var count = leaves.length;
        /* istanbul ignore if */
        if (!count) {
          return cb(null, result);
        }

        // order with open_revs is unspecified
        leaves.forEach((leaf) => {
          this.get(id, {
            rev: leaf,
            revs: opts.revs,
            latest: opts.latest,
            attachments: opts.attachments,
            binary: opts.binary
          }, function (err, doc) {
            if (!err) {
              // using latest=true can produce duplicates
              var existing;
              for (var i = 0, l = result.length; i < l; i++) {
                if (result[i].ok && result[i].ok._rev === doc._rev) {
                  existing = true;
                  break;
                }
              }
              if (!existing) {
                result.push({ok: doc});
              }
            } else {
              result.push({missing: leaf});
            }
            count--;
            if (!count) {
              cb(null, result);
            }
          });
        });
      };

      if (opts.open_revs) {
        if (opts.open_revs === "all") {
          this._getRevisionTree(id, function (err, rev_tree) {
            /* istanbul ignore if */
            if (err) {
              return cb(err);
            }
            leaves = collectLeaves(rev_tree).map(function (leaf) {
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
              if (!(typeof (l) === "string" && /^\d+-/.test(l))) {
                return cb(createError(INVALID_REV));
              }
            }
            finishOpenRevs();
          } else {
            return cb(createError(UNKNOWN_ERROR, 'function_clause'));
          }
        }
        return; // open_revs does not like other options
      }

      return this._get(id, opts, (err, result) => {
        if (err) {
          err.docId = id;
          return cb(err);
        }

        var doc = result.doc;
        var metadata = result.metadata;
        var ctx = result.ctx;

        if (opts.conflicts) {
          var conflicts = collectConflicts(metadata);
          if (conflicts.length) {
            doc._conflicts = conflicts;
          }
        }

        if (isDeleted(metadata, doc._rev)) {
          doc._deleted = true;
        }

        if (opts.revs || opts.revs_info) {
          var splittedRev = doc._rev.split('-');
          var revNo       = parseInt(splittedRev[0], 10);
          var revHash     = splittedRev[1];

          var paths = rootToLeaf(metadata.rev_tree);
          var path = null;

          for (var i = 0; i < paths.length; i++) {
            var currentPath = paths[i];
            var hashIndex = currentPath.ids.map(function (x) { return x.id; })
              .indexOf(revHash);
            var hashFoundAtRevPos = hashIndex === (revNo - 1);

            if (hashFoundAtRevPos || (!path && hashIndex !== -1)) {
              path = currentPath;
            }
          }

          /* istanbul ignore if */
          if (!path) {
            err = new Error('invalid rev tree');
            err.docId = id;
            return cb(err);
          }

          var indexOfRev = path.ids.map(function (x) { return x.id; })
            .indexOf(doc._rev.split('-')[1]) + 1;
          var howMany = path.ids.length - indexOfRev;
          path.ids.splice(indexOfRev, howMany);
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

        if (opts.attachments && doc._attachments) {
          var attachments = doc._attachments;
          var count = Object.keys(attachments).length;
          if (count === 0) {
            return cb(null, doc);
          }
          Object.keys(attachments).forEach((key) => {
            this._getAttachment(doc._id, key, attachments[key], {
              // Previously the revision handling was done in adapter.js
              // getAttachment, however since idb-next doesnt we need to
              // pass the rev through
              rev: doc._rev,
              binary: opts.binary,
              ctx: ctx
            }, function (err, data) {
              var att = doc._attachments[key];
              att.data = data;
              delete att.stub;
              delete att.length;
              if (!--count) {
                cb(null, doc);
              }
            });
          });
        } else {
          if (doc._attachments) {
            for (var key in doc._attachments) {
              /* istanbul ignore else */
              if (Object.prototype.hasOwnProperty.call(doc._attachments, key)) {
                doc._attachments[key].stub = true;
              }
            }
          }
          cb(null, doc);
        }
      });
    }).bind(this);

    // TODO: I dont like this, it forces an extra read for every
    // attachment read and enforces a confusing api between
    // adapter.js and the adapter implementation
    this.getAttachment = adapterFun('getAttachment', function (docId, attachmentId, opts, callback) {
      if (opts instanceof Function) {
        callback = opts;
        opts = {};
      }
      this._get(docId, opts, (err, res) => {
        if (err) {
          return callback(err);
        }
        if (res.doc._attachments && res.doc._attachments[attachmentId]) {
          opts.ctx = res.ctx;
          opts.binary = true;
          this._getAttachment(docId, attachmentId,
                              res.doc._attachments[attachmentId], opts, callback);
        } else {
          return callback(createError(MISSING_DOC));
        }
      });
    }).bind(this);

    this.allDocs = adapterFun('allDocs', function (opts, callback) {
      if (typeof opts === 'function') {
        callback = opts;
        opts = {};
      }
      opts.skip = typeof opts.skip !== 'undefined' ? opts.skip : 0;
      if (opts.start_key) {
        opts.startkey = opts.start_key;
      }
      if (opts.end_key) {
        opts.endkey = opts.end_key;
      }
      if ('keys' in opts) {
        if (!Array.isArray(opts.keys)) {
          return callback(new TypeError('options.keys must be an array'));
        }
        var incompatibleOpt =
          ['startkey', 'endkey', 'key'].filter(function (incompatibleOpt) {
          return incompatibleOpt in opts;
        })[0];
        if (incompatibleOpt) {
          callback(createError(QUERY_PARSE_ERROR,
            'Query parameter `' + incompatibleOpt +
            '` is not compatible with multi-get'
          ));
          return;
        }
        if (!isRemote(this)) {
          allDocsKeysParse(opts);
          if (opts.keys.length === 0) {
            return this._allDocs({limit: 0}, callback);
          }
        }
      }

      return this._allDocs(opts, callback);
    }).bind(this);

    this.close = adapterFun('close', function (callback) {
      this._closed = true;
      this.emit('closed');
      return this._close(callback);
    }).bind(this);

    this.info = adapterFun('info', function (callback) {
      this._info((err, info) => {
        if (err) {
          return callback(err);
        }
        // assume we know better than the adapter, unless it informs us
        info.db_name = info.db_name || this.name;
        info.auto_compaction = !!(this.auto_compaction && !isRemote(this));
        info.adapter = this.adapter;
        callback(null, info);
      });
    }).bind(this);

    this.id = adapterFun('id', function (callback) {
      return this._id(callback);
    }).bind(this);

    this.bulkDocs = adapterFun('bulkDocs', function (req, opts, callback) {
      if (typeof opts === 'function') {
        callback = opts;
        opts = {};
      }

      opts = opts || {};

      if (Array.isArray(req)) {
        req = {
          docs: req
        };
      }

      if (!req || !req.docs || !Array.isArray(req.docs)) {
        return callback(createError(MISSING_BULK_DOCS));
      }

      for (var i = 0; i < req.docs.length; ++i) {
        if (typeof req.docs[i] !== 'object' || Array.isArray(req.docs[i])) {
          return callback(createError(NOT_AN_OBJECT));
        }
      }

      var attachmentError;
      req.docs.forEach(function (doc) {
        if (doc._attachments) {
          Object.keys(doc._attachments).forEach(function (name) {
            attachmentError = attachmentError || attachmentNameError(name);
            if (!doc._attachments[name].content_type) {
              guardedConsole('warn', 'Attachment', name, 'on document', doc._id, 'is missing content_type');
            }
          });
        }
      });

      if (attachmentError) {
        return callback(createError(BAD_REQUEST, attachmentError));
      }

      if (!('new_edits' in opts)) {
        if ('new_edits' in req) {
          opts.new_edits = req.new_edits;
        } else {
          opts.new_edits = true;
        }
      }

      var adapter = this;
      if (!opts.new_edits && !isRemote(adapter)) {
        // ensure revisions of the same doc are sorted, so that
        // the local adapter processes them correctly (#2935)
        req.docs.sort(compareByIdThenRev);
      }

      cleanDocs(req.docs);

      // in the case of conflicts, we want to return the _ids to the user
      // however, the underlying adapter may destroy the docs array, so
      // create a copy here
      var ids = req.docs.map(function (doc) {
        return doc._id;
      });

      this._bulkDocs(req, opts, function (err, res) {
        if (err) {
          return callback(err);
        }
        if (!opts.new_edits) {
          // this is what couch does when new_edits is false
          res = res.filter(function (x) {
            return x.error;
          });
        }
        // add ids for error/conflict responses (not required for CouchDB)
        if (!isRemote(adapter)) {
          for (var i = 0, l = res.length; i < l; i++) {
            res[i].id = res[i].id || ids[i];
          }
        }

        callback(null, res);
      });
    }).bind(this);

    this.registerDependentDatabase = adapterFun('registerDependentDatabase', function (dependentDb, callback) {
      var dbOptions = clone(this.__opts);
      if (this.__opts.view_adapter) {
        dbOptions.adapter = this.__opts.view_adapter;
      }

      var depDB = new this.constructor(dependentDb, dbOptions);

      function diffFun(doc) {
        doc.dependentDbs = doc.dependentDbs || {};
        if (doc.dependentDbs[dependentDb]) {
          return false; // no update required
        }
        doc.dependentDbs[dependentDb] = true;
        return doc;
      }
      upsert(this, '_local/_pouch_dependentDbs', diffFun).then(function () {
        callback(null, {db: depDB});
      }).catch(callback);
    }).bind(this);

    this.destroy = adapterFun('destroy', function (opts, callback) {

      if (typeof opts === 'function') {
        callback = opts;
        opts = {};
      }

      var usePrefix = 'use_prefix' in this ? this.use_prefix : true;

      const destroyDb = () => {
        // call destroy method of the particular adaptor
        this._destroy(opts, (err, resp) => {
          if (err) {
            return callback(err);
          }
          this._destroyed = true;
          this.emit('destroyed');
          callback(null, resp || { 'ok': true });
        });
      };

      if (isRemote(this)) {
        // no need to check for dependent DBs if it's a remote DB
        return destroyDb();
      }

      this.get('_local/_pouch_dependentDbs', (err, localDoc) => {
        if (err) {
          /* istanbul ignore if */
          if (err.status !== 404) {
            return callback(err);
          } else { // no dependencies
            return destroyDb();
          }
        }
        var dependentDbs = localDoc.dependentDbs;
        var PouchDB = this.constructor;
        var deletedMap = Object.keys(dependentDbs).map((name) => {
          // use_prefix is only false in the browser
          /* istanbul ignore next */
          var trueName = usePrefix ?
            name.replace(new RegExp('^' + PouchDB.prefix), '') : name;
          return new PouchDB(trueName, this.__opts).destroy();
        });
        Promise.all(deletedMap).then(destroyDb, callback);
      });
    }).bind(this);
  }

  _compact(opts, callback) {
    var changesOpts = {
      return_docs: false,
      last_seq: opts.last_seq || 0
    };
    var promises = [];

    var taskId;
    var compactedDocs = 0;

    const onChange = (row) => {
      this.activeTasks.update(taskId, {
        completed_items: ++compactedDocs
      });
      promises.push(this.compactDocument(row.id, 0));
    };
    const onError = (err) => {
      this.activeTasks.remove(taskId, err);
      callback(err);
    };
    const onComplete = (resp) => {
      var lastSeq = resp.last_seq;
      Promise.all(promises).then(() => {
        return upsert(this, '_local/compaction', (doc) => {
          if (!doc.last_seq || doc.last_seq < lastSeq) {
            doc.last_seq = lastSeq;
            return doc;
          }
          return false; // somebody else got here first, don't update
        });
      }).then(() => {
        this.activeTasks.remove(taskId);
        callback(null, {ok: true});
      }).catch(onError);
    };

    this.info().then((info) => {
      taskId = this.activeTasks.add({
        name: 'database_compaction',
        total_items: info.update_seq - changesOpts.last_seq,
      });

      this.changes(changesOpts)
        .on('change', onChange)
        .on('complete', onComplete)
        .on('error', onError);
    });
  }

  changes(opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }

    opts = opts || {};

    // By default set return_docs to false if the caller has opts.live = true,
    // this will prevent us from collecting the set of changes indefinitely
    // resulting in growing memory
    opts.return_docs = ('return_docs' in opts) ? opts.return_docs : !opts.live;

    return new Changes(this, opts, callback);
  }

  type() {
    return (typeof this._type === 'function') ? this._type() : this.adapter;
  }
}

// The abstract purge implementation expects a doc id and the rev of a leaf node in that doc.
// It will return errors if the rev doesn’t exist or isn’t a leaf.
AbstractPouchDB.prototype.purge = adapterFun('_purge', function (docId, rev, callback) {
  if (typeof this._purge === 'undefined') {
    return callback(createError(UNKNOWN_ERROR, 'Purge is not implemented in the ' + this.adapter + ' adapter.'));
  }
  var self = this;

  self._getRevisionTree(docId, (error, revs) => {
    if (error) {
      return callback(error);
    }
    if (!revs) {
      return callback(createError(MISSING_DOC));
    }
    let path;
    try {
      path = findPathToLeaf(revs, rev);
    } catch (error) {
      return callback(error.message || error);
    }
    self._purge(docId, path, (error, result) => {
      if (error) {
        return callback(error);
      } else {
        appendPurgeSeq(self, docId, rev).then(function () {
          return callback(null, result);
        });
      }
    });
  });
});

class TaskQueue {
  constructor() {
    this.isReady = false;
    this.failed = false;
    this.queue = [];
  }

  execute() {
    var fun;
    if (this.failed) {
      while ((fun = this.queue.shift())) {
        fun(this.failed);
      }
    } else {
      while ((fun = this.queue.shift())) {
        fun();
      }
    }
  }

  fail(err) {
    this.failed = err;
    this.execute();
  }

  ready(db) {
    this.isReady = true;
    this.db = db;
    this.execute();
  }

  addTask(fun) {
    this.queue.push(fun);
    if (this.failed) {
      this.execute();
    }
  }
}

const getParseAdapter = (PouchDB) => function parseAdapter(name, opts) {
  var match = name.match(/([a-z-]*):\/\/(.*)/);
  if (match) {
    // the http adapter expects the fully qualified name
    return {
      name: /https?/.test(match[1]) ? match[1] + '://' + match[2] : match[2],
      adapter: match[1]
    };
  }

  var adapters = PouchDB.adapters;
  var preferredAdapters = PouchDB.preferredAdapters;
  var prefix = PouchDB.prefix;
  var adapterName = opts.adapter;

  if (!adapterName) { // automatically determine adapter
    for (var i = 0; i < preferredAdapters.length; ++i) {
      adapterName = preferredAdapters[i];
      // check for browsers that have been upgraded from websql-only to websql+idb
      /* istanbul ignore if */
      if (adapterName === 'idb' && 'websql' in adapters &&
          hasLocalStorage() && localStorage['_pouch__websqldb_' + prefix + name]) {
        // log it, because this can be confusing during development
        guardedConsole('log', 'PouchDB is downgrading "' + name + '" to WebSQL to' +
          ' avoid data loss, because it was already opened with WebSQL.');
        continue; // keep using websql to avoid user data loss
      }
      break;
    }
  }

  var adapter = adapters[adapterName];

  // if adapter is invalid, then an error will be thrown later
  var usePrefix = (adapter && 'use_prefix' in adapter) ?
    adapter.use_prefix : true;

  return {
    name: usePrefix ? (prefix + name) : name,
    adapter: adapterName
  };
};

function inherits(A, B) {
  A.prototype = Object.create(B.prototype, {
    constructor: { value: A }
  });
}

function createClass(parent, init) {
  let klass = function (...args) {
    if (!(this instanceof klass)) {
      return new klass(...args);
    }
    init.apply(this, args);
  };
  inherits(klass, parent);
  return klass;
}

// OK, so here's the deal. Consider this code:
//     var db1 = new PouchDB('foo');
//     var db2 = new PouchDB('foo');
//     db1.destroy();
// ^ these two both need to emit 'destroyed' events,
// as well as the PouchDB constructor itself.
// So we have one db object (whichever one got destroy() called on it)
// responsible for emitting the initial event, which then gets emitted
// by the constructor, which then broadcasts it to any other dbs
// that may have been created with the same name.
function prepareForDestruction(self) {

  function onDestroyed(from_constructor) {
    self.removeListener('closed', onClosed);
    if (!from_constructor) {
      self.constructor.emit('destroyed', self.name);
    }
  }

  function onClosed() {
    self.removeListener('destroyed', onDestroyed);
    self.constructor.emit('unref', self);
  }

  self.once('destroyed', onDestroyed);
  self.once('closed', onClosed);
  self.constructor.emit('ref', self);
}

class PouchInternal extends AbstractPouchDB {
  constructor(name, opts) {
    super();
    this._setup(name, opts);
  }

  _setup(name, opts) {
    super._setup();
    opts = opts || {};

    if (name && typeof name === 'object') {
      opts = name;
      name = opts.name;
      delete opts.name;
    }

    if (opts.deterministic_revs === undefined) {
      opts.deterministic_revs = true;
    }

    this.__opts = opts = clone(opts);

    this.auto_compaction = opts.auto_compaction;
    this.purged_infos_limit = opts.purged_infos_limit || 1000;
    this.prefix = PouchDB.prefix;

    if (typeof name !== 'string') {
      throw new Error('Missing/invalid DB name');
    }

    var prefixedName = (opts.prefix || '') + name;
    var backend = parseAdapter(prefixedName, opts);

    opts.name = backend.name;
    opts.adapter = opts.adapter || backend.adapter;

    this.name = name;
    this._adapter = opts.adapter;
    PouchDB.emit('debug', ['adapter', 'Picked adapter: ', opts.adapter]);

    if (!PouchDB.adapters[opts.adapter] ||
        !PouchDB.adapters[opts.adapter].valid()) {
      throw new Error('Invalid Adapter: ' + opts.adapter);
    }

    if (opts.view_adapter) {
      if (!PouchDB.adapters[opts.view_adapter] ||
          !PouchDB.adapters[opts.view_adapter].valid()) {
        throw new Error('Invalid View Adapter: ' + opts.view_adapter);
      }
    }

    this.taskqueue = new TaskQueue();

    this.adapter = opts.adapter;

    PouchDB.adapters[opts.adapter].call(this, opts, (err) => {
      if (err) {
        return this.taskqueue.fail(err);
      }
      prepareForDestruction(this);

      this.emit('created', this);
      PouchDB.emit('created', this.name);
      this.taskqueue.ready(this);
    });
  }
}

const PouchDB = createClass(PouchInternal, function (name, opts) {
  PouchInternal.prototype._setup.call(this, name, opts);
});

const parseAdapter = getParseAdapter(PouchDB);

var PouchDB$1 = PouchDB;

class ActiveTasks {
  constructor() {
    this.tasks = {};
  }

  list() {
    return Object.values(this.tasks);
  }

  add(task) {
    const id = v4();
    this.tasks[id] = {
      id,
      name: task.name,
      total_items: task.total_items,
      created_at: new Date().toJSON()
    };
    return id;
  }

  get(id) {
    return this.tasks[id];
  }

  /* eslint-disable no-unused-vars */
  remove(id, reason) {
    delete this.tasks[id];
    return this.tasks;
  }

  update(id, updatedTask) {
    const task = this.tasks[id];
    if (typeof task !== 'undefined') {
      const mergedTask = {
        id: task.id,
        name: task.name,
        created_at: task.created_at,
        total_items: updatedTask.total_items || task.total_items,
        completed_items: updatedTask.completed_items || task.completed_items,
        updated_at: new Date().toJSON()
      };
      this.tasks[id] = mergedTask;
    }
    return this.tasks;
  }
}

// 'use strict'; is default when ESM


PouchDB$1.adapters = {};
PouchDB$1.preferredAdapters = [];

PouchDB$1.prefix = '_pouch_';

var eventEmitter = new EE();

function setUpEventEmitter(Pouch) {
  Object.keys(EE.prototype).forEach(function (key) {
    if (typeof EE.prototype[key] === 'function') {
      Pouch[key] = eventEmitter[key].bind(eventEmitter);
    }
  });

  // these are created in constructor.js, and allow us to notify each DB with
  // the same name that it was destroyed, via the constructor object
  var destructListeners = Pouch._destructionListeners = new Map();

  Pouch.on('ref', function onConstructorRef(db) {
    if (!destructListeners.has(db.name)) {
      destructListeners.set(db.name, []);
    }
    destructListeners.get(db.name).push(db);
  });

  Pouch.on('unref', function onConstructorUnref(db) {
    if (!destructListeners.has(db.name)) {
      return;
    }
    var dbList = destructListeners.get(db.name);
    var pos = dbList.indexOf(db);
    if (pos < 0) {
      /* istanbul ignore next */
      return;
    }
    dbList.splice(pos, 1);
    if (dbList.length > 1) {
      /* istanbul ignore next */
      destructListeners.set(db.name, dbList);
    } else {
      destructListeners.delete(db.name);
    }
  });

  Pouch.on('destroyed', function onConstructorDestroyed(name) {
    if (!destructListeners.has(name)) {
      return;
    }
    var dbList = destructListeners.get(name);
    destructListeners.delete(name);
    dbList.forEach(function (db) {
      db.emit('destroyed',true);
    });
  });
}

setUpEventEmitter(PouchDB$1);

PouchDB$1.adapter = function (id, obj, addToPreferredAdapters) {
  /* istanbul ignore else */
  if (obj.valid()) {
    PouchDB$1.adapters[id] = obj;
    if (addToPreferredAdapters) {
      PouchDB$1.preferredAdapters.push(id);
    }
  }
};

PouchDB$1.plugin = function (obj) {
  if (typeof obj === 'function') { // function style for plugins
    obj(PouchDB$1);
  } else if (typeof obj !== 'object' || Object.keys(obj).length === 0) {
    throw new Error('Invalid plugin: got "' + obj + '", expected an object or a function');
  } else {
    Object.keys(obj).forEach(function (id) { // object style for plugins
      PouchDB$1.prototype[id] = obj[id];
    });
  }
  if (this.__defaults) {
    PouchDB$1.__defaults = Object.assign({}, this.__defaults);
  }
  return PouchDB$1;
};

PouchDB$1.defaults = function (defaultOpts) {
  let PouchWithDefaults = createClass(PouchDB$1, function (name, opts) {
    opts = opts || {};

    if (name && typeof name === 'object') {
      opts = name;
      name = opts.name;
      delete opts.name;
    }

    opts = Object.assign({}, PouchWithDefaults.__defaults, opts);
    PouchDB$1.call(this, name, opts);
  });

  PouchWithDefaults.preferredAdapters = PouchDB$1.preferredAdapters.slice();
  Object.keys(PouchDB$1).forEach(function (key) {
    if (!(key in PouchWithDefaults)) {
      PouchWithDefaults[key] = PouchDB$1[key];
    }
  });

  // make default options transitive
  // https://github.com/pouchdb/pouchdb/issues/5922
  PouchWithDefaults.__defaults = Object.assign({}, this.__defaults, defaultOpts);

  return PouchWithDefaults;
};

PouchDB$1.fetch = function (url, opts) {
  return fetch(url, opts);
};

PouchDB$1.prototype.activeTasks = PouchDB$1.activeTasks = new ActiveTasks();

// managed automatically by set-version.js
var version = "7.0.0-prerelease";

// TODO: remove from pouchdb-core (breaking)
PouchDB$1.plugin(applyChangesFilterPlugin);

PouchDB$1.version = version;

export { PouchDB$1 as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG91Y2hkYi1jb3JlLmJyb3dzZXIuanMiLCJzb3VyY2VzIjpbIi4uL3BhY2thZ2VzL3BvdWNoZGItY29yZS9zcmMvY2hhbmdlcy5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItY29yZS9zcmMvYWRhcHRlci5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItY29yZS9zcmMvdGFza3F1ZXVlLmpzIiwiLi4vcGFja2FnZXMvcG91Y2hkYi1jb3JlL3NyYy9wYXJzZUFkYXB0ZXIuanMiLCIuLi9wYWNrYWdlcy9wb3VjaGRiLWNvcmUvc3JjL3V0aWxzLmpzIiwiLi4vcGFja2FnZXMvcG91Y2hkYi1jb3JlL3NyYy9jb25zdHJ1Y3Rvci5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItY29yZS9zcmMvYWN0aXZlLXRhc2tzLmpzIiwiLi4vcGFja2FnZXMvcG91Y2hkYi1jb3JlL3NyYy9zZXR1cC5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItY29yZS9zcmMvdmVyc2lvbi5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItY29yZS9zcmMvaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcbiAgY2xvbmUsXG4gIGxpc3RlbmVyQ291bnQsXG4gIG9uY2UsXG4gIGd1YXJkZWRDb25zb2xlXG59IGZyb20gJ3BvdWNoZGItdXRpbHMnO1xuaW1wb3J0IHtcbiAgaXNEZWxldGVkLFxuICBjb2xsZWN0TGVhdmVzLFxuICBjb2xsZWN0Q29uZmxpY3RzXG59IGZyb20gJ3BvdWNoZGItbWVyZ2UnO1xuaW1wb3J0IGV2ZW50cyBmcm9tICdub2RlOmV2ZW50cyc7XG5cbmltcG9ydCBQb3VjaERCIGZyb20gJy4vc2V0dXAnO1xuXG5mdW5jdGlvbiB0cnlDYXRjaEluQ2hhbmdlTGlzdGVuZXIoc2VsZiwgY2hhbmdlLCBwZW5kaW5nLCBsYXN0U2VxKSB7XG4gIC8vIGlzb2xhdGUgdHJ5L2NhdGNoZXMgdG8gYXZvaWQgVjggZGVvcHRpbWl6YXRpb25zXG4gIHRyeSB7XG4gICAgc2VsZi5lbWl0KCdjaGFuZ2UnLCBjaGFuZ2UsIHBlbmRpbmcsIGxhc3RTZXEpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgZ3VhcmRlZENvbnNvbGUoJ2Vycm9yJywgJ0Vycm9yIGluIC5vbihcImNoYW5nZVwiLCBmdW5jdGlvbik6JywgZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcHJvY2Vzc0NoYW5nZShkb2MsIG1ldGFkYXRhLCBvcHRzKSB7XG4gIHZhciBjaGFuZ2VMaXN0ID0gW3tyZXY6IGRvYy5fcmV2fV07XG4gIGlmIChvcHRzLnN0eWxlID09PSAnYWxsX2RvY3MnKSB7XG4gICAgY2hhbmdlTGlzdCA9IGNvbGxlY3RMZWF2ZXMobWV0YWRhdGEucmV2X3RyZWUpXG4gICAgLm1hcChmdW5jdGlvbiAoeCkgeyByZXR1cm4ge3JldjogeC5yZXZ9OyB9KTtcbiAgfVxuICB2YXIgY2hhbmdlID0ge1xuICAgIGlkOiBtZXRhZGF0YS5pZCxcbiAgICBjaGFuZ2VzOiBjaGFuZ2VMaXN0LFxuICAgIGRvYzogZG9jXG4gIH07XG5cbiAgaWYgKGlzRGVsZXRlZChtZXRhZGF0YSwgZG9jLl9yZXYpKSB7XG4gICAgY2hhbmdlLmRlbGV0ZWQgPSB0cnVlO1xuICB9XG4gIGlmIChvcHRzLmNvbmZsaWN0cykge1xuICAgIGNoYW5nZS5kb2MuX2NvbmZsaWN0cyA9IGNvbGxlY3RDb25mbGljdHMobWV0YWRhdGEpO1xuICAgIGlmICghY2hhbmdlLmRvYy5fY29uZmxpY3RzLmxlbmd0aCkge1xuICAgICAgZGVsZXRlIGNoYW5nZS5kb2MuX2NvbmZsaWN0cztcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGNoYW5nZTtcbn1cblxuY2xhc3MgQ2hhbmdlcyBleHRlbmRzIGV2ZW50cyB7XG4gIGNvbnN0cnVjdG9yKGRiLCBvcHRzLCBjYWxsYmFjaykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5kYiA9IGRiO1xuICAgIG9wdHMgPSBvcHRzID8gY2xvbmUob3B0cykgOiB7fTtcbiAgICB2YXIgY29tcGxldGUgPSBvcHRzLmNvbXBsZXRlID0gb25jZSgoZXJyLCByZXNwKSA9PiB7XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIGlmIChsaXN0ZW5lckNvdW50KHRoaXMsICdlcnJvcicpID4gMCkge1xuICAgICAgICAgIHRoaXMuZW1pdCgnZXJyb3InLCBlcnIpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmVtaXQoJ2NvbXBsZXRlJywgcmVzcCk7XG4gICAgICB9XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygpO1xuICAgICAgZGIucmVtb3ZlTGlzdGVuZXIoJ2Rlc3Ryb3llZCcsIG9uRGVzdHJveSk7XG4gICAgfSk7XG4gICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICB0aGlzLm9uKCdjb21wbGV0ZScsIGZ1bmN0aW9uIChyZXNwKSB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3ApO1xuICAgICAgfSk7XG4gICAgICB0aGlzLm9uKCdlcnJvcicsIGNhbGxiYWNrKTtcbiAgICB9XG4gICAgY29uc3Qgb25EZXN0cm95ID0gKCkgPT4ge1xuICAgICAgdGhpcy5jYW5jZWwoKTtcbiAgICB9O1xuICAgIGRiLm9uY2UoJ2Rlc3Ryb3llZCcsIG9uRGVzdHJveSk7XG4gIFxuICAgIG9wdHMub25DaGFuZ2UgPSAoY2hhbmdlLCBwZW5kaW5nLCBsYXN0U2VxKSA9PiB7XG4gICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICAgIGlmICh0aGlzLmlzQ2FuY2VsbGVkKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHRyeUNhdGNoSW5DaGFuZ2VMaXN0ZW5lcih0aGlzLCBjaGFuZ2UsIHBlbmRpbmcsIGxhc3RTZXEpO1xuICAgIH07XG4gIFxuICAgIHZhciBwcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24gKGZ1bGZpbGwsIHJlamVjdCkge1xuICAgICAgb3B0cy5jb21wbGV0ZSA9IGZ1bmN0aW9uIChlcnIsIHJlcykge1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZnVsZmlsbChyZXMpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH0pO1xuICAgIHRoaXMub25jZSgnY2FuY2VsJywgZnVuY3Rpb24gKCkge1xuICAgICAgZGIucmVtb3ZlTGlzdGVuZXIoJ2Rlc3Ryb3llZCcsIG9uRGVzdHJveSk7XG4gICAgICBvcHRzLmNvbXBsZXRlKG51bGwsIHtzdGF0dXM6ICdjYW5jZWxsZWQnfSk7XG4gICAgfSk7XG4gICAgdGhpcy50aGVuID0gcHJvbWlzZS50aGVuLmJpbmQocHJvbWlzZSk7XG4gICAgdGhpc1snY2F0Y2gnXSA9IHByb21pc2VbJ2NhdGNoJ10uYmluZChwcm9taXNlKTtcbiAgICB0aGlzLnRoZW4oZnVuY3Rpb24gKHJlc3VsdCkge1xuICAgICAgY29tcGxldGUobnVsbCwgcmVzdWx0KTtcbiAgICB9LCBjb21wbGV0ZSk7XG4gIFxuICBcbiAgXG4gICAgaWYgKCFkYi50YXNrcXVldWUuaXNSZWFkeSkge1xuICAgICAgZGIudGFza3F1ZXVlLmFkZFRhc2soKGZhaWxlZCkgPT4ge1xuICAgICAgICBpZiAoZmFpbGVkKSB7XG4gICAgICAgICAgb3B0cy5jb21wbGV0ZShmYWlsZWQpO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuaXNDYW5jZWxsZWQpIHtcbiAgICAgICAgICB0aGlzLmVtaXQoJ2NhbmNlbCcpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMudmFsaWRhdGVDaGFuZ2VzKG9wdHMpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy52YWxpZGF0ZUNoYW5nZXMob3B0cyk7XG4gICAgfVxuICB9XG5cbiAgY2FuY2VsKCkge1xuICAgIHRoaXMuaXNDYW5jZWxsZWQgPSB0cnVlO1xuICAgIGlmICh0aGlzLmRiLnRhc2txdWV1ZS5pc1JlYWR5KSB7XG4gICAgICB0aGlzLmVtaXQoJ2NhbmNlbCcpO1xuICAgIH1cbiAgfVxuXG4gIHZhbGlkYXRlQ2hhbmdlcyhvcHRzKSB7XG4gICAgdmFyIGNhbGxiYWNrID0gb3B0cy5jb21wbGV0ZTtcbiAgXG4gICAgLyogaXN0YW5idWwgaWdub3JlIGVsc2UgKi9cbiAgICBpZiAoUG91Y2hEQi5fY2hhbmdlc0ZpbHRlclBsdWdpbikge1xuICAgICAgUG91Y2hEQi5fY2hhbmdlc0ZpbHRlclBsdWdpbi52YWxpZGF0ZShvcHRzLCAoZXJyKSA9PiB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmRvQ2hhbmdlcyhvcHRzKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRvQ2hhbmdlcyhvcHRzKTtcbiAgICB9XG4gIH1cblxuICBkb0NoYW5nZXMob3B0cykge1xuICAgIHZhciBjYWxsYmFjayA9IG9wdHMuY29tcGxldGU7XG4gIFxuICAgIG9wdHMgPSBjbG9uZShvcHRzKTtcbiAgICBpZiAoJ2xpdmUnIGluIG9wdHMgJiYgISgnY29udGludW91cycgaW4gb3B0cykpIHtcbiAgICAgIG9wdHMuY29udGludW91cyA9IG9wdHMubGl2ZTtcbiAgICB9XG4gICAgb3B0cy5wcm9jZXNzQ2hhbmdlID0gcHJvY2Vzc0NoYW5nZTtcbiAgXG4gICAgaWYgKG9wdHMuc2luY2UgPT09ICdsYXRlc3QnKSB7XG4gICAgICBvcHRzLnNpbmNlID0gJ25vdyc7XG4gICAgfVxuICAgIGlmICghb3B0cy5zaW5jZSkge1xuICAgICAgb3B0cy5zaW5jZSA9IDA7XG4gICAgfVxuICAgIGlmIChvcHRzLnNpbmNlID09PSAnbm93Jykge1xuICAgICAgdGhpcy5kYi5pbmZvKCkudGhlbigoaW5mbykgPT4ge1xuICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICAgICAgaWYgKHRoaXMuaXNDYW5jZWxsZWQpIHtcbiAgICAgICAgICBjYWxsYmFjayhudWxsLCB7c3RhdHVzOiAnY2FuY2VsbGVkJ30pO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBvcHRzLnNpbmNlID0gaW5mby51cGRhdGVfc2VxO1xuICAgICAgICB0aGlzLmRvQ2hhbmdlcyhvcHRzKTtcbiAgICAgIH0sIGNhbGxiYWNrKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gIFxuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBlbHNlICovXG4gICAgaWYgKFBvdWNoREIuX2NoYW5nZXNGaWx0ZXJQbHVnaW4pIHtcbiAgICAgIFBvdWNoREIuX2NoYW5nZXNGaWx0ZXJQbHVnaW4ubm9ybWFsaXplKG9wdHMpO1xuICAgICAgaWYgKFBvdWNoREIuX2NoYW5nZXNGaWx0ZXJQbHVnaW4uc2hvdWxkRmlsdGVyKHRoaXMsIG9wdHMpKSB7XG4gICAgICAgIHJldHVybiBQb3VjaERCLl9jaGFuZ2VzRmlsdGVyUGx1Z2luLmZpbHRlcih0aGlzLCBvcHRzKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgWydkb2NfaWRzJywgJ2ZpbHRlcicsICdzZWxlY3RvcicsICd2aWV3J10uZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgIGlmIChrZXkgaW4gb3B0cykge1xuICAgICAgICAgIGd1YXJkZWRDb25zb2xlKCd3YXJuJyxcbiAgICAgICAgICAgICdUaGUgXCInICsga2V5ICsgJ1wiIG9wdGlvbiB3YXMgcGFzc2VkIGluIHRvIGNoYW5nZXMvcmVwbGljYXRlLCAnICtcbiAgICAgICAgICAgICdidXQgcG91Y2hkYi1jaGFuZ2VzLWZpbHRlciBwbHVnaW4gaXMgbm90IGluc3RhbGxlZCwgc28gaXQgJyArXG4gICAgICAgICAgICAnd2FzIGlnbm9yZWQuIFBsZWFzZSBpbnN0YWxsIHRoZSBwbHVnaW4gdG8gZW5hYmxlIGZpbHRlcmluZy4nXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICBcbiAgICBpZiAoISgnZGVzY2VuZGluZycgaW4gb3B0cykpIHtcbiAgICAgIG9wdHMuZGVzY2VuZGluZyA9IGZhbHNlO1xuICAgIH1cbiAgXG4gICAgLy8gMCBhbmQgMSBzaG91bGQgcmV0dXJuIDEgZG9jdW1lbnRcbiAgICBvcHRzLmxpbWl0ID0gb3B0cy5saW1pdCA9PT0gMCA/IDEgOiBvcHRzLmxpbWl0O1xuICAgIG9wdHMuY29tcGxldGUgPSBjYWxsYmFjaztcbiAgICB2YXIgbmV3UHJvbWlzZSA9IHRoaXMuZGIuX2NoYW5nZXMob3B0cyk7XG4gICAgLyogaXN0YW5idWwgaWdub3JlIGVsc2UgKi9cbiAgICBpZiAobmV3UHJvbWlzZSAmJiB0eXBlb2YgbmV3UHJvbWlzZS5jYW5jZWwgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNvbnN0IGNhbmNlbCA9IHRoaXMuY2FuY2VsO1xuICAgICAgdGhpcy5jYW5jZWwgPSAoLi4uYXJncykgPT4ge1xuICAgICAgICBuZXdQcm9taXNlLmNhbmNlbCgpO1xuICAgICAgICBjYW5jZWwuYXBwbHkodGhpcywgYXJncyk7XG4gICAgICB9O1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBDaGFuZ2VzO1xuIiwiaW1wb3J0IHsgcmV2LCBndWFyZGVkQ29uc29sZSwgaXNSZW1vdGUgfSBmcm9tICdwb3VjaGRiLXV0aWxzJztcbmltcG9ydCBFdmVudEVtaXR0ZXIgZnJvbSAnbm9kZTpldmVudHMnO1xuaW1wb3J0IENoYW5nZXMgZnJvbSAnLi9jaGFuZ2VzJztcbmltcG9ydCB7XG4gIHBpY2ssXG4gIGFkYXB0ZXJGdW4sXG4gIHVwc2VydCxcbiAgYnVsa0dldFNoaW0sXG4gIGludmFsaWRJZEVycm9yLFxuICBuZXh0VGljayxcbiAgY2xvbmVcbn0gZnJvbSAncG91Y2hkYi11dGlscyc7XG5pbXBvcnQge1xuICB0cmF2ZXJzZVJldlRyZWUsXG4gIGNvbGxlY3RMZWF2ZXMsXG4gIHJvb3RUb0xlYWYsXG4gIGNvbGxlY3RDb25mbGljdHMsXG4gIGlzRGVsZXRlZCxcbiAgaXNMb2NhbElkLFxuICBmaW5kUGF0aFRvTGVhZlxufSBmcm9tICdwb3VjaGRiLW1lcmdlJztcbmltcG9ydCB7XG4gIE1JU1NJTkdfQlVMS19ET0NTLFxuICBNSVNTSU5HX0RPQyxcbiAgUkVWX0NPTkZMSUNULFxuICBJTlZBTElEX0lELFxuICBVTktOT1dOX0VSUk9SLFxuICBRVUVSWV9QQVJTRV9FUlJPUixcbiAgQkFEX1JFUVVFU1QsXG4gIE5PVF9BTl9PQkpFQ1QsXG4gIElOVkFMSURfUkVWLFxuICBjcmVhdGVFcnJvclxufSBmcm9tICdwb3VjaGRiLWVycm9ycyc7XG5cbi8qXG4gKiBBIGdlbmVyaWMgcG91Y2ggYWRhcHRlclxuICovXG5cbmZ1bmN0aW9uIGNvbXBhcmUobGVmdCwgcmlnaHQpIHtcbiAgcmV0dXJuIGxlZnQgPCByaWdodCA/IC0xIDogbGVmdCA+IHJpZ2h0ID8gMSA6IDA7XG59XG5cbi8vIFdyYXBwZXIgZm9yIGZ1bmN0aW9ucyB0aGF0IGNhbGwgdGhlIGJ1bGtkb2NzIGFwaSB3aXRoIGEgc2luZ2xlIGRvYyxcbi8vIGlmIHRoZSBmaXJzdCByZXN1bHQgaXMgYW4gZXJyb3IsIHJldHVybiBhbiBlcnJvclxuZnVuY3Rpb24geWFua0Vycm9yKGNhbGxiYWNrLCBkb2NJZCkge1xuICByZXR1cm4gZnVuY3Rpb24gKGVyciwgcmVzdWx0cykge1xuICAgIGlmIChlcnIgfHwgKHJlc3VsdHNbMF0gJiYgcmVzdWx0c1swXS5lcnJvcikpIHtcbiAgICAgIGVyciA9IGVyciB8fCByZXN1bHRzWzBdO1xuICAgICAgZXJyLmRvY0lkID0gZG9jSWQ7XG4gICAgICBjYWxsYmFjayhlcnIpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjYWxsYmFjayhudWxsLCByZXN1bHRzLmxlbmd0aCA/IHJlc3VsdHNbMF0gIDogcmVzdWx0cyk7XG4gICAgfVxuICB9O1xufVxuXG4vLyBjbGVhbiBkb2NzIGdpdmVuIHRvIHVzIGJ5IHRoZSB1c2VyXG5mdW5jdGlvbiBjbGVhbkRvY3MoZG9jcykge1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGRvY3MubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgZG9jID0gZG9jc1tpXTtcbiAgICBpZiAoZG9jLl9kZWxldGVkKSB7XG4gICAgICBkZWxldGUgZG9jLl9hdHRhY2htZW50czsgLy8gaWdub3JlIGF0dHMgZm9yIGRlbGV0ZWQgZG9jc1xuICAgIH0gZWxzZSBpZiAoZG9jLl9hdHRhY2htZW50cykge1xuICAgICAgLy8gZmlsdGVyIG91dCBleHRyYW5lb3VzIGtleXMgZnJvbSBfYXR0YWNobWVudHNcbiAgICAgIHZhciBhdHRzID0gT2JqZWN0LmtleXMoZG9jLl9hdHRhY2htZW50cyk7XG4gICAgICBmb3IgKHZhciBqID0gMDsgaiA8IGF0dHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgdmFyIGF0dCA9IGF0dHNbal07XG4gICAgICAgIGRvYy5fYXR0YWNobWVudHNbYXR0XSA9IHBpY2soZG9jLl9hdHRhY2htZW50c1thdHRdLFxuICAgICAgICAgIFsnZGF0YScsICdkaWdlc3QnLCAnY29udGVudF90eXBlJywgJ2xlbmd0aCcsICdyZXZwb3MnLCAnc3R1YiddKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuLy8gY29tcGFyZSB0d28gZG9jcywgZmlyc3QgYnkgX2lkIHRoZW4gYnkgX3JldlxuZnVuY3Rpb24gY29tcGFyZUJ5SWRUaGVuUmV2KGEsIGIpIHtcbiAgdmFyIGlkQ29tcGFyZSA9IGNvbXBhcmUoYS5faWQsIGIuX2lkKTtcbiAgaWYgKGlkQ29tcGFyZSAhPT0gMCkge1xuICAgIHJldHVybiBpZENvbXBhcmU7XG4gIH1cbiAgdmFyIGFTdGFydCA9IGEuX3JldmlzaW9ucyA/IGEuX3JldmlzaW9ucy5zdGFydCA6IDA7XG4gIHZhciBiU3RhcnQgPSBiLl9yZXZpc2lvbnMgPyBiLl9yZXZpc2lvbnMuc3RhcnQgOiAwO1xuICByZXR1cm4gY29tcGFyZShhU3RhcnQsIGJTdGFydCk7XG59XG5cbi8vIGZvciBldmVyeSBub2RlIGluIGEgcmV2aXNpb24gdHJlZSBjb21wdXRlcyBpdHMgZGlzdGFuY2UgZnJvbSB0aGUgY2xvc2VzdFxuLy8gbGVhZlxuZnVuY3Rpb24gY29tcHV0ZUhlaWdodChyZXZzKSB7XG4gIHZhciBoZWlnaHQgPSB7fTtcbiAgdmFyIGVkZ2VzID0gW107XG4gIHRyYXZlcnNlUmV2VHJlZShyZXZzLCBmdW5jdGlvbiAoaXNMZWFmLCBwb3MsIGlkLCBwcm50KSB7XG4gICAgdmFyIHJldiA9IHBvcyArIFwiLVwiICsgaWQ7XG4gICAgaWYgKGlzTGVhZikge1xuICAgICAgaGVpZ2h0W3Jldl0gPSAwO1xuICAgIH1cbiAgICBpZiAocHJudCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBlZGdlcy5wdXNoKHtmcm9tOiBwcm50LCB0bzogcmV2fSk7XG4gICAgfVxuICAgIHJldHVybiByZXY7XG4gIH0pO1xuXG4gIGVkZ2VzLnJldmVyc2UoKTtcbiAgZWRnZXMuZm9yRWFjaChmdW5jdGlvbiAoZWRnZSkge1xuICAgIGlmIChoZWlnaHRbZWRnZS5mcm9tXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBoZWlnaHRbZWRnZS5mcm9tXSA9IDEgKyBoZWlnaHRbZWRnZS50b107XG4gICAgfSBlbHNlIHtcbiAgICAgIGhlaWdodFtlZGdlLmZyb21dID0gTWF0aC5taW4oaGVpZ2h0W2VkZ2UuZnJvbV0sIDEgKyBoZWlnaHRbZWRnZS50b10pO1xuICAgIH1cbiAgfSk7XG4gIHJldHVybiBoZWlnaHQ7XG59XG5cbmZ1bmN0aW9uIGFsbERvY3NLZXlzUGFyc2Uob3B0cykge1xuICB2YXIga2V5cyA9ICAoJ2xpbWl0JyBpbiBvcHRzKSA/XG4gICAgb3B0cy5rZXlzLnNsaWNlKG9wdHMuc2tpcCwgb3B0cy5saW1pdCArIG9wdHMuc2tpcCkgOlxuICAgIChvcHRzLnNraXAgPiAwKSA/IG9wdHMua2V5cy5zbGljZShvcHRzLnNraXApIDogb3B0cy5rZXlzO1xuICBvcHRzLmtleXMgPSBrZXlzO1xuICBvcHRzLnNraXAgPSAwO1xuICBkZWxldGUgb3B0cy5saW1pdDtcbiAgaWYgKG9wdHMuZGVzY2VuZGluZykge1xuICAgIGtleXMucmV2ZXJzZSgpO1xuICAgIG9wdHMuZGVzY2VuZGluZyA9IGZhbHNlO1xuICB9XG59XG5cbi8vIGFsbCBjb21wYWN0aW9uIGlzIGRvbmUgaW4gYSBxdWV1ZSwgdG8gYXZvaWQgYXR0YWNoaW5nXG4vLyB0b28gbWFueSBsaXN0ZW5lcnMgYXQgb25jZVxuZnVuY3Rpb24gZG9OZXh0Q29tcGFjdGlvbihzZWxmKSB7XG4gIHZhciB0YXNrID0gc2VsZi5fY29tcGFjdGlvblF1ZXVlWzBdO1xuICB2YXIgb3B0cyA9IHRhc2sub3B0cztcbiAgdmFyIGNhbGxiYWNrID0gdGFzay5jYWxsYmFjaztcbiAgc2VsZi5nZXQoJ19sb2NhbC9jb21wYWN0aW9uJykuY2F0Y2goZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfSkudGhlbihmdW5jdGlvbiAoZG9jKSB7XG4gICAgaWYgKGRvYyAmJiBkb2MubGFzdF9zZXEpIHtcbiAgICAgIG9wdHMubGFzdF9zZXEgPSBkb2MubGFzdF9zZXE7XG4gICAgfVxuICAgIHNlbGYuX2NvbXBhY3Qob3B0cywgZnVuY3Rpb24gKGVyciwgcmVzKSB7XG4gICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHJlcyk7XG4gICAgICB9XG4gICAgICBuZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICAgIHNlbGYuX2NvbXBhY3Rpb25RdWV1ZS5zaGlmdCgpO1xuICAgICAgICBpZiAoc2VsZi5fY29tcGFjdGlvblF1ZXVlLmxlbmd0aCkge1xuICAgICAgICAgIGRvTmV4dENvbXBhY3Rpb24oc2VsZik7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gYXBwZW5kUHVyZ2VTZXEoZGIsIGRvY0lkLCByZXYpIHtcbiAgcmV0dXJuIGRiLmdldCgnX2xvY2FsL3B1cmdlcycpLnRoZW4oZnVuY3Rpb24gKGRvYykge1xuICAgIGNvbnN0IHB1cmdlU2VxID0gZG9jLnB1cmdlU2VxICsgMTtcbiAgICBkb2MucHVyZ2VzLnB1c2goe1xuICAgICAgZG9jSWQsXG4gICAgICByZXYsXG4gICAgICBwdXJnZVNlcSxcbiAgICB9KTtcbiAgICBpZiAoZG9jLnB1cmdlcy5sZW5ndGggPiBzZWxmLnB1cmdlZF9pbmZvc19saW1pdCkge1xuICAgICAgZG9jLnB1cmdlcy5zcGxpY2UoMCwgZG9jLnB1cmdlcy5sZW5ndGggLSBzZWxmLnB1cmdlZF9pbmZvc19saW1pdCk7XG4gICAgfVxuICAgIGRvYy5wdXJnZVNlcSA9IHB1cmdlU2VxO1xuICAgIHJldHVybiBkb2M7XG4gIH0pLmNhdGNoKGZ1bmN0aW9uIChlcnIpIHtcbiAgICBpZiAoZXJyLnN0YXR1cyAhPT0gNDA0KSB7XG4gICAgICB0aHJvdyBlcnI7XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICBfaWQ6ICdfbG9jYWwvcHVyZ2VzJyxcbiAgICAgIHB1cmdlczogW3tcbiAgICAgICAgZG9jSWQsXG4gICAgICAgIHJldixcbiAgICAgICAgcHVyZ2VTZXE6IDAsXG4gICAgICB9XSxcbiAgICAgIHB1cmdlU2VxOiAwLFxuICAgIH07XG4gIH0pLnRoZW4oZnVuY3Rpb24gKGRvYykge1xuICAgIHJldHVybiBkYi5wdXQoZG9jKTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGF0dGFjaG1lbnROYW1lRXJyb3IobmFtZSkge1xuICBpZiAobmFtZS5jaGFyQXQoMCkgPT09ICdfJykge1xuICAgIHJldHVybiBuYW1lICsgJyBpcyBub3QgYSB2YWxpZCBhdHRhY2htZW50IG5hbWUsIGF0dGFjaG1lbnQgJyArXG4gICAgICAnbmFtZXMgY2Fubm90IHN0YXJ0IHdpdGggXFwnX1xcJyc7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5jbGFzcyBBYnN0cmFjdFBvdWNoREIgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuICBfc2V0dXAoKSB7XG4gICAgdGhpcy5wb3N0ID0gYWRhcHRlckZ1bigncG9zdCcsIGZ1bmN0aW9uIChkb2MsIG9wdHMsIGNhbGxiYWNrKSB7XG4gICAgICBpZiAodHlwZW9mIG9wdHMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgY2FsbGJhY2sgPSBvcHRzO1xuICAgICAgICBvcHRzID0ge307XG4gICAgICB9XG4gICAgICBpZiAodHlwZW9mIGRvYyAhPT0gJ29iamVjdCcgfHwgQXJyYXkuaXNBcnJheShkb2MpKSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjayhjcmVhdGVFcnJvcihOT1RfQU5fT0JKRUNUKSk7XG4gICAgICB9XG4gICAgICB0aGlzLmJ1bGtEb2NzKHtkb2NzOiBbZG9jXX0sIG9wdHMsIHlhbmtFcnJvcihjYWxsYmFjaywgZG9jLl9pZCkpO1xuICAgIH0pLmJpbmQodGhpcyk7XG5cbiAgICB0aGlzLnB1dCA9IGFkYXB0ZXJGdW4oJ3B1dCcsIGZ1bmN0aW9uIChkb2MsIG9wdHMsIGNiKSB7XG4gICAgICBpZiAodHlwZW9mIG9wdHMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgY2IgPSBvcHRzO1xuICAgICAgICBvcHRzID0ge307XG4gICAgICB9XG4gICAgICBpZiAodHlwZW9mIGRvYyAhPT0gJ29iamVjdCcgfHwgQXJyYXkuaXNBcnJheShkb2MpKSB7XG4gICAgICAgIHJldHVybiBjYihjcmVhdGVFcnJvcihOT1RfQU5fT0JKRUNUKSk7XG4gICAgICB9XG4gICAgICBpbnZhbGlkSWRFcnJvcihkb2MuX2lkKTtcbiAgICAgIGlmIChpc0xvY2FsSWQoZG9jLl9pZCkgJiYgdHlwZW9mIHRoaXMuX3B1dExvY2FsID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGlmIChkb2MuX2RlbGV0ZWQpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5fcmVtb3ZlTG9jYWwoZG9jLCBjYik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuX3B1dExvY2FsKGRvYywgY2IpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHB1dERvYyA9IChuZXh0KSA9PiB7XG4gICAgICAgIGlmICh0eXBlb2YgdGhpcy5fcHV0ID09PSAnZnVuY3Rpb24nICYmIG9wdHMubmV3X2VkaXRzICE9PSBmYWxzZSkge1xuICAgICAgICAgIHRoaXMuX3B1dChkb2MsIG9wdHMsIG5leHQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuYnVsa0RvY3Moe2RvY3M6IFtkb2NdfSwgb3B0cywgeWFua0Vycm9yKG5leHQsIGRvYy5faWQpKTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgaWYgKG9wdHMuZm9yY2UgJiYgZG9jLl9yZXYpIHtcbiAgICAgICAgdHJhbnNmb3JtRm9yY2VPcHRpb25Ub05ld0VkaXRzT3B0aW9uKCk7XG4gICAgICAgIHB1dERvYyhmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgdmFyIHJlc3VsdCA9IGVyciA/IG51bGwgOiB7b2s6IHRydWUsIGlkOiBkb2MuX2lkLCByZXY6IGRvYy5fcmV2fTtcbiAgICAgICAgICBjYihlcnIsIHJlc3VsdCk7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcHV0RG9jKGNiKTtcbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gdHJhbnNmb3JtRm9yY2VPcHRpb25Ub05ld0VkaXRzT3B0aW9uKCkge1xuICAgICAgICB2YXIgcGFydHMgPSBkb2MuX3Jldi5zcGxpdCgnLScpO1xuICAgICAgICB2YXIgb2xkUmV2SWQgPSBwYXJ0c1sxXTtcbiAgICAgICAgdmFyIG9sZFJldk51bSA9IHBhcnNlSW50KHBhcnRzWzBdLCAxMCk7XG5cbiAgICAgICAgdmFyIG5ld1Jldk51bSA9IG9sZFJldk51bSArIDE7XG4gICAgICAgIHZhciBuZXdSZXZJZCA9IHJldigpO1xuXG4gICAgICAgIGRvYy5fcmV2aXNpb25zID0ge1xuICAgICAgICAgIHN0YXJ0OiBuZXdSZXZOdW0sXG4gICAgICAgICAgaWRzOiBbbmV3UmV2SWQsIG9sZFJldklkXVxuICAgICAgICB9O1xuICAgICAgICBkb2MuX3JldiA9IG5ld1Jldk51bSArICctJyArIG5ld1JldklkO1xuICAgICAgICBvcHRzLm5ld19lZGl0cyA9IGZhbHNlO1xuICAgICAgfVxuICAgIH0pLmJpbmQodGhpcyk7XG5cbiAgICB0aGlzLnB1dEF0dGFjaG1lbnQgPSBhZGFwdGVyRnVuKCdwdXRBdHRhY2htZW50JywgZnVuY3Rpb24gKGRvY0lkLCBhdHRhY2htZW50SWQsIHJldiwgYmxvYiwgdHlwZSkge1xuICAgICAgdmFyIGFwaSA9IHRoaXM7XG4gICAgICBpZiAodHlwZW9mIHR5cGUgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgdHlwZSA9IGJsb2I7XG4gICAgICAgIGJsb2IgPSByZXY7XG4gICAgICAgIHJldiA9IG51bGw7XG4gICAgICB9XG4gICAgICAvLyBMZXRzIGZpeCBpbiBodHRwczovL2dpdGh1Yi5jb20vcG91Y2hkYi9wb3VjaGRiL2lzc3Vlcy8zMjY3XG4gICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICAgIGlmICh0eXBlb2YgdHlwZSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgdHlwZSA9IGJsb2I7XG4gICAgICAgIGJsb2IgPSByZXY7XG4gICAgICAgIHJldiA9IG51bGw7XG4gICAgICB9XG4gICAgICBpZiAoIXR5cGUpIHtcbiAgICAgICAgZ3VhcmRlZENvbnNvbGUoJ3dhcm4nLCAnQXR0YWNobWVudCcsIGF0dGFjaG1lbnRJZCwgJ29uIGRvY3VtZW50JywgZG9jSWQsICdpcyBtaXNzaW5nIGNvbnRlbnRfdHlwZScpO1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBjcmVhdGVBdHRhY2htZW50KGRvYykge1xuICAgICAgICB2YXIgcHJldnJldnBvcyA9ICdfcmV2JyBpbiBkb2MgPyBwYXJzZUludChkb2MuX3JldiwgMTApIDogMDtcbiAgICAgICAgZG9jLl9hdHRhY2htZW50cyA9IGRvYy5fYXR0YWNobWVudHMgfHwge307XG4gICAgICAgIGRvYy5fYXR0YWNobWVudHNbYXR0YWNobWVudElkXSA9IHtcbiAgICAgICAgICBjb250ZW50X3R5cGU6IHR5cGUsXG4gICAgICAgICAgZGF0YTogYmxvYixcbiAgICAgICAgICByZXZwb3M6ICsrcHJldnJldnBvc1xuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gYXBpLnB1dChkb2MpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gYXBpLmdldChkb2NJZCkudGhlbihmdW5jdGlvbiAoZG9jKSB7XG4gICAgICAgIGlmIChkb2MuX3JldiAhPT0gcmV2KSB7XG4gICAgICAgICAgdGhyb3cgY3JlYXRlRXJyb3IoUkVWX0NPTkZMSUNUKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjcmVhdGVBdHRhY2htZW50KGRvYyk7XG4gICAgICB9LCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgIC8vIGNyZWF0ZSBuZXcgZG9jXG4gICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBlbHNlICovXG4gICAgICAgIGlmIChlcnIucmVhc29uID09PSBNSVNTSU5HX0RPQy5tZXNzYWdlKSB7XG4gICAgICAgICAgcmV0dXJuIGNyZWF0ZUF0dGFjaG1lbnQoe19pZDogZG9jSWR9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pLmJpbmQodGhpcyk7XG5cbiAgICB0aGlzLnJlbW92ZUF0dGFjaG1lbnQgPSBhZGFwdGVyRnVuKCdyZW1vdmVBdHRhY2htZW50JywgZnVuY3Rpb24gKGRvY0lkLCBhdHRhY2htZW50SWQsIHJldiwgY2FsbGJhY2spIHtcbiAgICAgIHRoaXMuZ2V0KGRvY0lkLCAoZXJyLCBvYmopID0+IHtcbiAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAob2JqLl9yZXYgIT09IHJldikge1xuICAgICAgICAgIGNhbGxiYWNrKGNyZWF0ZUVycm9yKFJFVl9DT05GTElDVCkpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICAgICAgaWYgKCFvYmouX2F0dGFjaG1lbnRzKSB7XG4gICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKCk7XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlIG9iai5fYXR0YWNobWVudHNbYXR0YWNobWVudElkXTtcbiAgICAgICAgaWYgKE9iamVjdC5rZXlzKG9iai5fYXR0YWNobWVudHMpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIGRlbGV0ZSBvYmouX2F0dGFjaG1lbnRzO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMucHV0KG9iaiwgY2FsbGJhY2spO1xuICAgICAgfSk7XG4gICAgfSkuYmluZCh0aGlzKTtcblxuICAgIHRoaXMucmVtb3ZlID0gYWRhcHRlckZ1bigncmVtb3ZlJywgZnVuY3Rpb24gKGRvY09ySWQsIG9wdHNPclJldiwgb3B0cywgY2FsbGJhY2spIHtcbiAgICAgIHZhciBkb2M7XG4gICAgICBpZiAodHlwZW9mIG9wdHNPclJldiA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgLy8gaWQsIHJldiwgb3B0cywgY2FsbGJhY2sgc3R5bGVcbiAgICAgICAgZG9jID0ge1xuICAgICAgICAgIF9pZDogZG9jT3JJZCxcbiAgICAgICAgICBfcmV2OiBvcHRzT3JSZXZcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKHR5cGVvZiBvcHRzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgY2FsbGJhY2sgPSBvcHRzO1xuICAgICAgICAgIG9wdHMgPSB7fTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gZG9jLCBvcHRzLCBjYWxsYmFjayBzdHlsZVxuICAgICAgICBkb2MgPSBkb2NPcklkO1xuICAgICAgICBpZiAodHlwZW9mIG9wdHNPclJldiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIGNhbGxiYWNrID0gb3B0c09yUmV2O1xuICAgICAgICAgIG9wdHMgPSB7fTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjYWxsYmFjayA9IG9wdHM7XG4gICAgICAgICAgb3B0cyA9IG9wdHNPclJldjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgb3B0cyA9IG9wdHMgfHwge307XG4gICAgICBvcHRzLndhc19kZWxldGUgPSB0cnVlO1xuICAgICAgdmFyIG5ld0RvYyA9IHtfaWQ6IGRvYy5faWQsIF9yZXY6IChkb2MuX3JldiB8fCBvcHRzLnJldil9O1xuICAgICAgbmV3RG9jLl9kZWxldGVkID0gdHJ1ZTtcbiAgICAgIGlmIChpc0xvY2FsSWQobmV3RG9jLl9pZCkgJiYgdHlwZW9mIHRoaXMuX3JlbW92ZUxvY2FsID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yZW1vdmVMb2NhbChkb2MsIGNhbGxiYWNrKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuYnVsa0RvY3Moe2RvY3M6IFtuZXdEb2NdfSwgb3B0cywgeWFua0Vycm9yKGNhbGxiYWNrLCBuZXdEb2MuX2lkKSk7XG4gICAgfSkuYmluZCh0aGlzKTtcblxuICAgIHRoaXMucmV2c0RpZmYgPSBhZGFwdGVyRnVuKCdyZXZzRGlmZicsIGZ1bmN0aW9uIChyZXEsIG9wdHMsIGNhbGxiYWNrKSB7XG4gICAgICBpZiAodHlwZW9mIG9wdHMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgY2FsbGJhY2sgPSBvcHRzO1xuICAgICAgICBvcHRzID0ge307XG4gICAgICB9XG4gICAgICB2YXIgaWRzID0gT2JqZWN0LmtleXMocmVxKTtcblxuICAgICAgaWYgKCFpZHMubGVuZ3RoKSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjayhudWxsLCB7fSk7XG4gICAgICB9XG5cbiAgICAgIHZhciBjb3VudCA9IDA7XG4gICAgICB2YXIgbWlzc2luZyA9IG5ldyBNYXAoKTtcblxuICAgICAgZnVuY3Rpb24gYWRkVG9NaXNzaW5nKGlkLCByZXZJZCkge1xuICAgICAgICBpZiAoIW1pc3NpbmcuaGFzKGlkKSkge1xuICAgICAgICAgIG1pc3Npbmcuc2V0KGlkLCB7bWlzc2luZzogW119KTtcbiAgICAgICAgfVxuICAgICAgICBtaXNzaW5nLmdldChpZCkubWlzc2luZy5wdXNoKHJldklkKTtcbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gcHJvY2Vzc0RvYyhpZCwgcmV2X3RyZWUpIHtcbiAgICAgICAgLy8gSXMgdGhpcyBmYXN0IGVub3VnaD8gTWF5YmUgd2Ugc2hvdWxkIHN3aXRjaCB0byBhIHNldCBzaW11bGF0ZWQgYnkgYSBtYXBcbiAgICAgICAgdmFyIG1pc3NpbmdGb3JJZCA9IHJlcVtpZF0uc2xpY2UoMCk7XG4gICAgICAgIHRyYXZlcnNlUmV2VHJlZShyZXZfdHJlZSwgZnVuY3Rpb24gKGlzTGVhZiwgcG9zLCByZXZIYXNoLCBjdHgsXG4gICAgICAgICAgb3B0cykge1xuICAgICAgICAgICAgdmFyIHJldiA9IHBvcyArICctJyArIHJldkhhc2g7XG4gICAgICAgICAgICB2YXIgaWR4ID0gbWlzc2luZ0ZvcklkLmluZGV4T2YocmV2KTtcbiAgICAgICAgICAgIGlmIChpZHggPT09IC0xKSB7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbWlzc2luZ0ZvcklkLnNwbGljZShpZHgsIDEpO1xuICAgICAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgICAgICAgICBpZiAob3B0cy5zdGF0dXMgIT09ICdhdmFpbGFibGUnKSB7XG4gICAgICAgICAgICAgIGFkZFRvTWlzc2luZyhpZCwgcmV2KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcblxuICAgICAgICAvLyBUcmF2ZXJzaW5nIHRoZSB0cmVlIGlzIHN5bmNocm9ub3VzLCBzbyBub3cgYG1pc3NpbmdGb3JJZGAgY29udGFpbnNcbiAgICAgICAgLy8gcmV2aXNpb25zIHRoYXQgd2VyZSBub3QgZm91bmQgaW4gdGhlIHRyZWVcbiAgICAgICAgbWlzc2luZ0ZvcklkLmZvckVhY2goZnVuY3Rpb24gKHJldikge1xuICAgICAgICAgIGFkZFRvTWlzc2luZyhpZCwgcmV2KTtcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIGlkcy5tYXAoZnVuY3Rpb24gKGlkKSB7XG4gICAgICAgIHRoaXMuX2dldFJldmlzaW9uVHJlZShpZCwgZnVuY3Rpb24gKGVyciwgcmV2X3RyZWUpIHtcbiAgICAgICAgICBpZiAoZXJyICYmIGVyci5zdGF0dXMgPT09IDQwNCAmJiBlcnIubWVzc2FnZSA9PT0gJ21pc3NpbmcnKSB7XG4gICAgICAgICAgICBtaXNzaW5nLnNldChpZCwge21pc3Npbmc6IHJlcVtpZF19KTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGVycikge1xuICAgICAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwcm9jZXNzRG9jKGlkLCByZXZfdHJlZSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKCsrY291bnQgPT09IGlkcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIC8vIGNvbnZlcnQgTGF6eU1hcCB0byBvYmplY3RcbiAgICAgICAgICAgIHZhciBtaXNzaW5nT2JqID0ge307XG4gICAgICAgICAgICBtaXNzaW5nLmZvckVhY2goZnVuY3Rpb24gKHZhbHVlLCBrZXkpIHtcbiAgICAgICAgICAgICAgbWlzc2luZ09ialtrZXldID0gdmFsdWU7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhudWxsLCBtaXNzaW5nT2JqKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSwgdGhpcyk7XG4gICAgfSkuYmluZCh0aGlzKTtcblxuICAgIC8vIF9idWxrX2dldCBBUEkgZm9yIGZhc3RlciByZXBsaWNhdGlvbiwgYXMgZGVzY3JpYmVkIGluXG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2FwYWNoZS9jb3VjaGRiLWNodHRwZC9wdWxsLzMzXG4gICAgLy8gQXQgdGhlIFwiYWJzdHJhY3RcIiBsZXZlbCwgaXQgd2lsbCBqdXN0IHJ1biBtdWx0aXBsZSBnZXQoKXMgaW5cbiAgICAvLyBwYXJhbGxlbCwgYmVjYXVzZSB0aGlzIGlzbid0IG11Y2ggb2YgYSBwZXJmb3JtYW5jZSBjb3N0XG4gICAgLy8gZm9yIGxvY2FsIGRhdGFiYXNlcyAoZXhjZXB0IHRoZSBjb3N0IG9mIG11bHRpcGxlIHRyYW5zYWN0aW9ucywgd2hpY2ggaXNcbiAgICAvLyBzbWFsbCkuIFRoZSBodHRwIGFkYXB0ZXIgb3ZlcnJpZGVzIHRoaXMgaW4gb3JkZXJcbiAgICAvLyB0byBkbyBhIG1vcmUgZWZmaWNpZW50IHNpbmdsZSBIVFRQIHJlcXVlc3QuXG4gICAgdGhpcy5idWxrR2V0ID0gYWRhcHRlckZ1bignYnVsa0dldCcsIGZ1bmN0aW9uIChvcHRzLCBjYWxsYmFjaykge1xuICAgICAgYnVsa0dldFNoaW0odGhpcywgb3B0cywgY2FsbGJhY2spO1xuICAgIH0pLmJpbmQodGhpcyk7XG5cbiAgICAvLyBjb21wYWN0IG9uZSBkb2N1bWVudCBhbmQgZmlyZSBjYWxsYmFja1xuICAgIC8vIGJ5IGNvbXBhY3Rpbmcgd2UgbWVhbiByZW1vdmluZyBhbGwgcmV2aXNpb25zIHdoaWNoXG4gICAgLy8gYXJlIGZ1cnRoZXIgZnJvbSB0aGUgbGVhZiBpbiByZXZpc2lvbiB0cmVlIHRoYW4gbWF4X2hlaWdodFxuICAgIHRoaXMuY29tcGFjdERvY3VtZW50ID0gYWRhcHRlckZ1bignY29tcGFjdERvY3VtZW50JywgZnVuY3Rpb24gKGRvY0lkLCBtYXhIZWlnaHQsIGNhbGxiYWNrKSB7XG4gICAgICB0aGlzLl9nZXRSZXZpc2lvblRyZWUoZG9jSWQsIChlcnIsIHJldlRyZWUpID0+IHtcbiAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgaGVpZ2h0ID0gY29tcHV0ZUhlaWdodChyZXZUcmVlKTtcbiAgICAgICAgdmFyIGNhbmRpZGF0ZXMgPSBbXTtcbiAgICAgICAgdmFyIHJldnMgPSBbXTtcbiAgICAgICAgT2JqZWN0LmtleXMoaGVpZ2h0KS5mb3JFYWNoKGZ1bmN0aW9uIChyZXYpIHtcbiAgICAgICAgICBpZiAoaGVpZ2h0W3Jldl0gPiBtYXhIZWlnaHQpIHtcbiAgICAgICAgICAgIGNhbmRpZGF0ZXMucHVzaChyZXYpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgdHJhdmVyc2VSZXZUcmVlKHJldlRyZWUsIGZ1bmN0aW9uIChpc0xlYWYsIHBvcywgcmV2SGFzaCwgY3R4LCBvcHRzKSB7XG4gICAgICAgICAgdmFyIHJldiA9IHBvcyArICctJyArIHJldkhhc2g7XG4gICAgICAgICAgaWYgKG9wdHMuc3RhdHVzID09PSAnYXZhaWxhYmxlJyAmJiBjYW5kaWRhdGVzLmluZGV4T2YocmV2KSAhPT0gLTEpIHtcbiAgICAgICAgICAgIHJldnMucHVzaChyZXYpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX2RvQ29tcGFjdGlvbihkb2NJZCwgcmV2cywgY2FsbGJhY2spO1xuICAgICAgfSk7XG4gICAgfSkuYmluZCh0aGlzKTtcblxuICAgIC8vIGNvbXBhY3QgdGhlIHdob2xlIGRhdGFiYXNlIHVzaW5nIHNpbmdsZSBkb2N1bWVudFxuICAgIC8vIGNvbXBhY3Rpb25cbiAgICB0aGlzLmNvbXBhY3QgPSBhZGFwdGVyRnVuKCdjb21wYWN0JywgZnVuY3Rpb24gKG9wdHMsIGNhbGxiYWNrKSB7XG4gICAgICBpZiAodHlwZW9mIG9wdHMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgY2FsbGJhY2sgPSBvcHRzO1xuICAgICAgICBvcHRzID0ge307XG4gICAgICB9XG5cbiAgICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuXG4gICAgICB0aGlzLl9jb21wYWN0aW9uUXVldWUgPSB0aGlzLl9jb21wYWN0aW9uUXVldWUgfHwgW107XG4gICAgICB0aGlzLl9jb21wYWN0aW9uUXVldWUucHVzaCh7b3B0czogb3B0cywgY2FsbGJhY2s6IGNhbGxiYWNrfSk7XG4gICAgICBpZiAodGhpcy5fY29tcGFjdGlvblF1ZXVlLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICBkb05leHRDb21wYWN0aW9uKHRoaXMpO1xuICAgICAgfVxuICAgIH0pLmJpbmQodGhpcyk7XG5cbiAgICAvKiBCZWdpbiBhcGkgd3JhcHBlcnMuIFNwZWNpZmljIGZ1bmN0aW9uYWxpdHkgdG8gc3RvcmFnZSBiZWxvbmdzIGluIHRoZSBfW21ldGhvZF0gKi9cbiAgICB0aGlzLmdldCA9IGFkYXB0ZXJGdW4oJ2dldCcsIGZ1bmN0aW9uIChpZCwgb3B0cywgY2IpIHtcbiAgICAgIGlmICh0eXBlb2Ygb3B0cyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBjYiA9IG9wdHM7XG4gICAgICAgIG9wdHMgPSB7fTtcbiAgICAgIH1cbiAgICAgIGlmICh0eXBlb2YgaWQgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHJldHVybiBjYihjcmVhdGVFcnJvcihJTlZBTElEX0lEKSk7XG4gICAgICB9XG4gICAgICBpZiAoaXNMb2NhbElkKGlkKSAmJiB0eXBlb2YgdGhpcy5fZ2V0TG9jYWwgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2dldExvY2FsKGlkLCBjYik7XG4gICAgICB9XG4gICAgICB2YXIgbGVhdmVzID0gW107XG5cbiAgICAgIGNvbnN0IGZpbmlzaE9wZW5SZXZzID0gKCkgPT4ge1xuICAgICAgICB2YXIgcmVzdWx0ID0gW107XG4gICAgICAgIHZhciBjb3VudCA9IGxlYXZlcy5sZW5ndGg7XG4gICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgICAgICBpZiAoIWNvdW50KSB7XG4gICAgICAgICAgcmV0dXJuIGNiKG51bGwsIHJlc3VsdCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBvcmRlciB3aXRoIG9wZW5fcmV2cyBpcyB1bnNwZWNpZmllZFxuICAgICAgICBsZWF2ZXMuZm9yRWFjaCgobGVhZikgPT4ge1xuICAgICAgICAgIHRoaXMuZ2V0KGlkLCB7XG4gICAgICAgICAgICByZXY6IGxlYWYsXG4gICAgICAgICAgICByZXZzOiBvcHRzLnJldnMsXG4gICAgICAgICAgICBsYXRlc3Q6IG9wdHMubGF0ZXN0LFxuICAgICAgICAgICAgYXR0YWNobWVudHM6IG9wdHMuYXR0YWNobWVudHMsXG4gICAgICAgICAgICBiaW5hcnk6IG9wdHMuYmluYXJ5XG4gICAgICAgICAgfSwgZnVuY3Rpb24gKGVyciwgZG9jKSB7XG4gICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAvLyB1c2luZyBsYXRlc3Q9dHJ1ZSBjYW4gcHJvZHVjZSBkdXBsaWNhdGVzXG4gICAgICAgICAgICAgIHZhciBleGlzdGluZztcbiAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSByZXN1bHQubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdFtpXS5vayAmJiByZXN1bHRbaV0ub2suX3JldiA9PT0gZG9jLl9yZXYpIHtcbiAgICAgICAgICAgICAgICAgIGV4aXN0aW5nID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoIWV4aXN0aW5nKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LnB1c2goe29rOiBkb2N9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmVzdWx0LnB1c2goe21pc3Npbmc6IGxlYWZ9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvdW50LS07XG4gICAgICAgICAgICBpZiAoIWNvdW50KSB7XG4gICAgICAgICAgICAgIGNiKG51bGwsIHJlc3VsdCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgfTtcblxuICAgICAgaWYgKG9wdHMub3Blbl9yZXZzKSB7XG4gICAgICAgIGlmIChvcHRzLm9wZW5fcmV2cyA9PT0gXCJhbGxcIikge1xuICAgICAgICAgIHRoaXMuX2dldFJldmlzaW9uVHJlZShpZCwgZnVuY3Rpb24gKGVyciwgcmV2X3RyZWUpIHtcbiAgICAgICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICByZXR1cm4gY2IoZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxlYXZlcyA9IGNvbGxlY3RMZWF2ZXMocmV2X3RyZWUpLm1hcChmdW5jdGlvbiAobGVhZikge1xuICAgICAgICAgICAgICByZXR1cm4gbGVhZi5yZXY7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGZpbmlzaE9wZW5SZXZzKCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkob3B0cy5vcGVuX3JldnMpKSB7XG4gICAgICAgICAgICBsZWF2ZXMgPSBvcHRzLm9wZW5fcmV2cztcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVhdmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgIHZhciBsID0gbGVhdmVzW2ldO1xuICAgICAgICAgICAgICAvLyBsb29rcyBsaWtlIGl0J3MgdGhlIG9ubHkgdGhpbmcgY291Y2hkYiBjaGVja3NcbiAgICAgICAgICAgICAgaWYgKCEodHlwZW9mIChsKSA9PT0gXCJzdHJpbmdcIiAmJiAvXlxcZCstLy50ZXN0KGwpKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBjYihjcmVhdGVFcnJvcihJTlZBTElEX1JFVikpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmaW5pc2hPcGVuUmV2cygpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gY2IoY3JlYXRlRXJyb3IoVU5LTk9XTl9FUlJPUiwgJ2Z1bmN0aW9uX2NsYXVzZScpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuOyAvLyBvcGVuX3JldnMgZG9lcyBub3QgbGlrZSBvdGhlciBvcHRpb25zXG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0aGlzLl9nZXQoaWQsIG9wdHMsIChlcnIsIHJlc3VsdCkgPT4ge1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgZXJyLmRvY0lkID0gaWQ7XG4gICAgICAgICAgcmV0dXJuIGNiKGVycik7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgZG9jID0gcmVzdWx0LmRvYztcbiAgICAgICAgdmFyIG1ldGFkYXRhID0gcmVzdWx0Lm1ldGFkYXRhO1xuICAgICAgICB2YXIgY3R4ID0gcmVzdWx0LmN0eDtcblxuICAgICAgICBpZiAob3B0cy5jb25mbGljdHMpIHtcbiAgICAgICAgICB2YXIgY29uZmxpY3RzID0gY29sbGVjdENvbmZsaWN0cyhtZXRhZGF0YSk7XG4gICAgICAgICAgaWYgKGNvbmZsaWN0cy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGRvYy5fY29uZmxpY3RzID0gY29uZmxpY3RzO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpc0RlbGV0ZWQobWV0YWRhdGEsIGRvYy5fcmV2KSkge1xuICAgICAgICAgIGRvYy5fZGVsZXRlZCA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0cy5yZXZzIHx8IG9wdHMucmV2c19pbmZvKSB7XG4gICAgICAgICAgdmFyIHNwbGl0dGVkUmV2ID0gZG9jLl9yZXYuc3BsaXQoJy0nKTtcbiAgICAgICAgICB2YXIgcmV2Tm8gICAgICAgPSBwYXJzZUludChzcGxpdHRlZFJldlswXSwgMTApO1xuICAgICAgICAgIHZhciByZXZIYXNoICAgICA9IHNwbGl0dGVkUmV2WzFdO1xuXG4gICAgICAgICAgdmFyIHBhdGhzID0gcm9vdFRvTGVhZihtZXRhZGF0YS5yZXZfdHJlZSk7XG4gICAgICAgICAgdmFyIHBhdGggPSBudWxsO1xuXG4gICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwYXRocy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIGN1cnJlbnRQYXRoID0gcGF0aHNbaV07XG4gICAgICAgICAgICB2YXIgaGFzaEluZGV4ID0gY3VycmVudFBhdGguaWRzLm1hcChmdW5jdGlvbiAoeCkgeyByZXR1cm4geC5pZDsgfSlcbiAgICAgICAgICAgICAgLmluZGV4T2YocmV2SGFzaCk7XG4gICAgICAgICAgICB2YXIgaGFzaEZvdW5kQXRSZXZQb3MgPSBoYXNoSW5kZXggPT09IChyZXZObyAtIDEpO1xuXG4gICAgICAgICAgICBpZiAoaGFzaEZvdW5kQXRSZXZQb3MgfHwgKCFwYXRoICYmIGhhc2hJbmRleCAhPT0gLTEpKSB7XG4gICAgICAgICAgICAgIHBhdGggPSBjdXJyZW50UGF0aDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICAgICAgICBpZiAoIXBhdGgpIHtcbiAgICAgICAgICAgIGVyciA9IG5ldyBFcnJvcignaW52YWxpZCByZXYgdHJlZScpO1xuICAgICAgICAgICAgZXJyLmRvY0lkID0gaWQ7XG4gICAgICAgICAgICByZXR1cm4gY2IoZXJyKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB2YXIgaW5kZXhPZlJldiA9IHBhdGguaWRzLm1hcChmdW5jdGlvbiAoeCkgeyByZXR1cm4geC5pZDsgfSlcbiAgICAgICAgICAgIC5pbmRleE9mKGRvYy5fcmV2LnNwbGl0KCctJylbMV0pICsgMTtcbiAgICAgICAgICB2YXIgaG93TWFueSA9IHBhdGguaWRzLmxlbmd0aCAtIGluZGV4T2ZSZXY7XG4gICAgICAgICAgcGF0aC5pZHMuc3BsaWNlKGluZGV4T2ZSZXYsIGhvd01hbnkpO1xuICAgICAgICAgIHBhdGguaWRzLnJldmVyc2UoKTtcblxuICAgICAgICAgIGlmIChvcHRzLnJldnMpIHtcbiAgICAgICAgICAgIGRvYy5fcmV2aXNpb25zID0ge1xuICAgICAgICAgICAgICBzdGFydDogKHBhdGgucG9zICsgcGF0aC5pZHMubGVuZ3RoKSAtIDEsXG4gICAgICAgICAgICAgIGlkczogcGF0aC5pZHMubWFwKGZ1bmN0aW9uIChyZXYpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcmV2LmlkO1xuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKG9wdHMucmV2c19pbmZvKSB7XG4gICAgICAgICAgICB2YXIgcG9zID0gIHBhdGgucG9zICsgcGF0aC5pZHMubGVuZ3RoO1xuICAgICAgICAgICAgZG9jLl9yZXZzX2luZm8gPSBwYXRoLmlkcy5tYXAoZnVuY3Rpb24gKHJldikge1xuICAgICAgICAgICAgICBwb3MtLTtcbiAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICByZXY6IHBvcyArICctJyArIHJldi5pZCxcbiAgICAgICAgICAgICAgICBzdGF0dXM6IHJldi5vcHRzLnN0YXR1c1xuICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdHMuYXR0YWNobWVudHMgJiYgZG9jLl9hdHRhY2htZW50cykge1xuICAgICAgICAgIHZhciBhdHRhY2htZW50cyA9IGRvYy5fYXR0YWNobWVudHM7XG4gICAgICAgICAgdmFyIGNvdW50ID0gT2JqZWN0LmtleXMoYXR0YWNobWVudHMpLmxlbmd0aDtcbiAgICAgICAgICBpZiAoY291bnQgPT09IDApIHtcbiAgICAgICAgICAgIHJldHVybiBjYihudWxsLCBkb2MpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBPYmplY3Qua2V5cyhhdHRhY2htZW50cykuZm9yRWFjaCgoa2V5KSA9PiB7XG4gICAgICAgICAgICB0aGlzLl9nZXRBdHRhY2htZW50KGRvYy5faWQsIGtleSwgYXR0YWNobWVudHNba2V5XSwge1xuICAgICAgICAgICAgICAvLyBQcmV2aW91c2x5IHRoZSByZXZpc2lvbiBoYW5kbGluZyB3YXMgZG9uZSBpbiBhZGFwdGVyLmpzXG4gICAgICAgICAgICAgIC8vIGdldEF0dGFjaG1lbnQsIGhvd2V2ZXIgc2luY2UgaWRiLW5leHQgZG9lc250IHdlIG5lZWQgdG9cbiAgICAgICAgICAgICAgLy8gcGFzcyB0aGUgcmV2IHRocm91Z2hcbiAgICAgICAgICAgICAgcmV2OiBkb2MuX3JldixcbiAgICAgICAgICAgICAgYmluYXJ5OiBvcHRzLmJpbmFyeSxcbiAgICAgICAgICAgICAgY3R4OiBjdHhcbiAgICAgICAgICAgIH0sIGZ1bmN0aW9uIChlcnIsIGRhdGEpIHtcbiAgICAgICAgICAgICAgdmFyIGF0dCA9IGRvYy5fYXR0YWNobWVudHNba2V5XTtcbiAgICAgICAgICAgICAgYXR0LmRhdGEgPSBkYXRhO1xuICAgICAgICAgICAgICBkZWxldGUgYXR0LnN0dWI7XG4gICAgICAgICAgICAgIGRlbGV0ZSBhdHQubGVuZ3RoO1xuICAgICAgICAgICAgICBpZiAoIS0tY291bnQpIHtcbiAgICAgICAgICAgICAgICBjYihudWxsLCBkb2MpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpZiAoZG9jLl9hdHRhY2htZW50cykge1xuICAgICAgICAgICAgZm9yICh2YXIga2V5IGluIGRvYy5fYXR0YWNobWVudHMpIHtcbiAgICAgICAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIGVsc2UgKi9cbiAgICAgICAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChkb2MuX2F0dGFjaG1lbnRzLCBrZXkpKSB7XG4gICAgICAgICAgICAgICAgZG9jLl9hdHRhY2htZW50c1trZXldLnN0dWIgPSB0cnVlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGNiKG51bGwsIGRvYyk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pLmJpbmQodGhpcyk7XG5cbiAgICAvLyBUT0RPOiBJIGRvbnQgbGlrZSB0aGlzLCBpdCBmb3JjZXMgYW4gZXh0cmEgcmVhZCBmb3IgZXZlcnlcbiAgICAvLyBhdHRhY2htZW50IHJlYWQgYW5kIGVuZm9yY2VzIGEgY29uZnVzaW5nIGFwaSBiZXR3ZWVuXG4gICAgLy8gYWRhcHRlci5qcyBhbmQgdGhlIGFkYXB0ZXIgaW1wbGVtZW50YXRpb25cbiAgICB0aGlzLmdldEF0dGFjaG1lbnQgPSBhZGFwdGVyRnVuKCdnZXRBdHRhY2htZW50JywgZnVuY3Rpb24gKGRvY0lkLCBhdHRhY2htZW50SWQsIG9wdHMsIGNhbGxiYWNrKSB7XG4gICAgICBpZiAob3B0cyBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG4gICAgICAgIGNhbGxiYWNrID0gb3B0cztcbiAgICAgICAgb3B0cyA9IHt9O1xuICAgICAgfVxuICAgICAgdGhpcy5fZ2V0KGRvY0lkLCBvcHRzLCAoZXJyLCByZXMpID0+IHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgIHJldHVybiBjYWxsYmFjayhlcnIpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChyZXMuZG9jLl9hdHRhY2htZW50cyAmJiByZXMuZG9jLl9hdHRhY2htZW50c1thdHRhY2htZW50SWRdKSB7XG4gICAgICAgICAgb3B0cy5jdHggPSByZXMuY3R4O1xuICAgICAgICAgIG9wdHMuYmluYXJ5ID0gdHJ1ZTtcbiAgICAgICAgICB0aGlzLl9nZXRBdHRhY2htZW50KGRvY0lkLCBhdHRhY2htZW50SWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXMuZG9jLl9hdHRhY2htZW50c1thdHRhY2htZW50SWRdLCBvcHRzLCBjYWxsYmFjayk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGNyZWF0ZUVycm9yKE1JU1NJTkdfRE9DKSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pLmJpbmQodGhpcyk7XG5cbiAgICB0aGlzLmFsbERvY3MgPSBhZGFwdGVyRnVuKCdhbGxEb2NzJywgZnVuY3Rpb24gKG9wdHMsIGNhbGxiYWNrKSB7XG4gICAgICBpZiAodHlwZW9mIG9wdHMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgY2FsbGJhY2sgPSBvcHRzO1xuICAgICAgICBvcHRzID0ge307XG4gICAgICB9XG4gICAgICBvcHRzLnNraXAgPSB0eXBlb2Ygb3B0cy5za2lwICE9PSAndW5kZWZpbmVkJyA/IG9wdHMuc2tpcCA6IDA7XG4gICAgICBpZiAob3B0cy5zdGFydF9rZXkpIHtcbiAgICAgICAgb3B0cy5zdGFydGtleSA9IG9wdHMuc3RhcnRfa2V5O1xuICAgICAgfVxuICAgICAgaWYgKG9wdHMuZW5kX2tleSkge1xuICAgICAgICBvcHRzLmVuZGtleSA9IG9wdHMuZW5kX2tleTtcbiAgICAgIH1cbiAgICAgIGlmICgna2V5cycgaW4gb3B0cykge1xuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkob3B0cy5rZXlzKSkge1xuICAgICAgICAgIHJldHVybiBjYWxsYmFjayhuZXcgVHlwZUVycm9yKCdvcHRpb25zLmtleXMgbXVzdCBiZSBhbiBhcnJheScpKTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgaW5jb21wYXRpYmxlT3B0ID1cbiAgICAgICAgICBbJ3N0YXJ0a2V5JywgJ2VuZGtleScsICdrZXknXS5maWx0ZXIoZnVuY3Rpb24gKGluY29tcGF0aWJsZU9wdCkge1xuICAgICAgICAgIHJldHVybiBpbmNvbXBhdGlibGVPcHQgaW4gb3B0cztcbiAgICAgICAgfSlbMF07XG4gICAgICAgIGlmIChpbmNvbXBhdGlibGVPcHQpIHtcbiAgICAgICAgICBjYWxsYmFjayhjcmVhdGVFcnJvcihRVUVSWV9QQVJTRV9FUlJPUixcbiAgICAgICAgICAgICdRdWVyeSBwYXJhbWV0ZXIgYCcgKyBpbmNvbXBhdGlibGVPcHQgK1xuICAgICAgICAgICAgJ2AgaXMgbm90IGNvbXBhdGlibGUgd2l0aCBtdWx0aS1nZXQnXG4gICAgICAgICAgKSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmICghaXNSZW1vdGUodGhpcykpIHtcbiAgICAgICAgICBhbGxEb2NzS2V5c1BhcnNlKG9wdHMpO1xuICAgICAgICAgIGlmIChvcHRzLmtleXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fYWxsRG9jcyh7bGltaXQ6IDB9LCBjYWxsYmFjayk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0aGlzLl9hbGxEb2NzKG9wdHMsIGNhbGxiYWNrKTtcbiAgICB9KS5iaW5kKHRoaXMpO1xuXG4gICAgdGhpcy5jbG9zZSA9IGFkYXB0ZXJGdW4oJ2Nsb3NlJywgZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICB0aGlzLl9jbG9zZWQgPSB0cnVlO1xuICAgICAgdGhpcy5lbWl0KCdjbG9zZWQnKTtcbiAgICAgIHJldHVybiB0aGlzLl9jbG9zZShjYWxsYmFjayk7XG4gICAgfSkuYmluZCh0aGlzKTtcblxuICAgIHRoaXMuaW5mbyA9IGFkYXB0ZXJGdW4oJ2luZm8nLCBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgIHRoaXMuX2luZm8oKGVyciwgaW5mbykgPT4ge1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgICAgIH1cbiAgICAgICAgLy8gYXNzdW1lIHdlIGtub3cgYmV0dGVyIHRoYW4gdGhlIGFkYXB0ZXIsIHVubGVzcyBpdCBpbmZvcm1zIHVzXG4gICAgICAgIGluZm8uZGJfbmFtZSA9IGluZm8uZGJfbmFtZSB8fCB0aGlzLm5hbWU7XG4gICAgICAgIGluZm8uYXV0b19jb21wYWN0aW9uID0gISEodGhpcy5hdXRvX2NvbXBhY3Rpb24gJiYgIWlzUmVtb3RlKHRoaXMpKTtcbiAgICAgICAgaW5mby5hZGFwdGVyID0gdGhpcy5hZGFwdGVyO1xuICAgICAgICBjYWxsYmFjayhudWxsLCBpbmZvKTtcbiAgICAgIH0pO1xuICAgIH0pLmJpbmQodGhpcyk7XG5cbiAgICB0aGlzLmlkID0gYWRhcHRlckZ1bignaWQnLCBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgIHJldHVybiB0aGlzLl9pZChjYWxsYmFjayk7XG4gICAgfSkuYmluZCh0aGlzKTtcblxuICAgIHRoaXMuYnVsa0RvY3MgPSBhZGFwdGVyRnVuKCdidWxrRG9jcycsIGZ1bmN0aW9uIChyZXEsIG9wdHMsIGNhbGxiYWNrKSB7XG4gICAgICBpZiAodHlwZW9mIG9wdHMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgY2FsbGJhY2sgPSBvcHRzO1xuICAgICAgICBvcHRzID0ge307XG4gICAgICB9XG5cbiAgICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuXG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShyZXEpKSB7XG4gICAgICAgIHJlcSA9IHtcbiAgICAgICAgICBkb2NzOiByZXFcbiAgICAgICAgfTtcbiAgICAgIH1cblxuICAgICAgaWYgKCFyZXEgfHwgIXJlcS5kb2NzIHx8ICFBcnJheS5pc0FycmF5KHJlcS5kb2NzKSkge1xuICAgICAgICByZXR1cm4gY2FsbGJhY2soY3JlYXRlRXJyb3IoTUlTU0lOR19CVUxLX0RPQ1MpKTtcbiAgICAgIH1cblxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZXEuZG9jcy5sZW5ndGg7ICsraSkge1xuICAgICAgICBpZiAodHlwZW9mIHJlcS5kb2NzW2ldICE9PSAnb2JqZWN0JyB8fCBBcnJheS5pc0FycmF5KHJlcS5kb2NzW2ldKSkge1xuICAgICAgICAgIHJldHVybiBjYWxsYmFjayhjcmVhdGVFcnJvcihOT1RfQU5fT0JKRUNUKSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdmFyIGF0dGFjaG1lbnRFcnJvcjtcbiAgICAgIHJlcS5kb2NzLmZvckVhY2goZnVuY3Rpb24gKGRvYykge1xuICAgICAgICBpZiAoZG9jLl9hdHRhY2htZW50cykge1xuICAgICAgICAgIE9iamVjdC5rZXlzKGRvYy5fYXR0YWNobWVudHMpLmZvckVhY2goZnVuY3Rpb24gKG5hbWUpIHtcbiAgICAgICAgICAgIGF0dGFjaG1lbnRFcnJvciA9IGF0dGFjaG1lbnRFcnJvciB8fCBhdHRhY2htZW50TmFtZUVycm9yKG5hbWUpO1xuICAgICAgICAgICAgaWYgKCFkb2MuX2F0dGFjaG1lbnRzW25hbWVdLmNvbnRlbnRfdHlwZSkge1xuICAgICAgICAgICAgICBndWFyZGVkQ29uc29sZSgnd2FybicsICdBdHRhY2htZW50JywgbmFtZSwgJ29uIGRvY3VtZW50JywgZG9jLl9pZCwgJ2lzIG1pc3NpbmcgY29udGVudF90eXBlJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBpZiAoYXR0YWNobWVudEVycm9yKSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjayhjcmVhdGVFcnJvcihCQURfUkVRVUVTVCwgYXR0YWNobWVudEVycm9yKSk7XG4gICAgICB9XG5cbiAgICAgIGlmICghKCduZXdfZWRpdHMnIGluIG9wdHMpKSB7XG4gICAgICAgIGlmICgnbmV3X2VkaXRzJyBpbiByZXEpIHtcbiAgICAgICAgICBvcHRzLm5ld19lZGl0cyA9IHJlcS5uZXdfZWRpdHM7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgb3B0cy5uZXdfZWRpdHMgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHZhciBhZGFwdGVyID0gdGhpcztcbiAgICAgIGlmICghb3B0cy5uZXdfZWRpdHMgJiYgIWlzUmVtb3RlKGFkYXB0ZXIpKSB7XG4gICAgICAgIC8vIGVuc3VyZSByZXZpc2lvbnMgb2YgdGhlIHNhbWUgZG9jIGFyZSBzb3J0ZWQsIHNvIHRoYXRcbiAgICAgICAgLy8gdGhlIGxvY2FsIGFkYXB0ZXIgcHJvY2Vzc2VzIHRoZW0gY29ycmVjdGx5ICgjMjkzNSlcbiAgICAgICAgcmVxLmRvY3Muc29ydChjb21wYXJlQnlJZFRoZW5SZXYpO1xuICAgICAgfVxuXG4gICAgICBjbGVhbkRvY3MocmVxLmRvY3MpO1xuXG4gICAgICAvLyBpbiB0aGUgY2FzZSBvZiBjb25mbGljdHMsIHdlIHdhbnQgdG8gcmV0dXJuIHRoZSBfaWRzIHRvIHRoZSB1c2VyXG4gICAgICAvLyBob3dldmVyLCB0aGUgdW5kZXJseWluZyBhZGFwdGVyIG1heSBkZXN0cm95IHRoZSBkb2NzIGFycmF5LCBzb1xuICAgICAgLy8gY3JlYXRlIGEgY29weSBoZXJlXG4gICAgICB2YXIgaWRzID0gcmVxLmRvY3MubWFwKGZ1bmN0aW9uIChkb2MpIHtcbiAgICAgICAgcmV0dXJuIGRvYy5faWQ7XG4gICAgICB9KTtcblxuICAgICAgdGhpcy5fYnVsa0RvY3MocmVxLCBvcHRzLCBmdW5jdGlvbiAoZXJyLCByZXMpIHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgIHJldHVybiBjYWxsYmFjayhlcnIpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghb3B0cy5uZXdfZWRpdHMpIHtcbiAgICAgICAgICAvLyB0aGlzIGlzIHdoYXQgY291Y2ggZG9lcyB3aGVuIG5ld19lZGl0cyBpcyBmYWxzZVxuICAgICAgICAgIHJlcyA9IHJlcy5maWx0ZXIoZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgICAgIHJldHVybiB4LmVycm9yO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIC8vIGFkZCBpZHMgZm9yIGVycm9yL2NvbmZsaWN0IHJlc3BvbnNlcyAobm90IHJlcXVpcmVkIGZvciBDb3VjaERCKVxuICAgICAgICBpZiAoIWlzUmVtb3RlKGFkYXB0ZXIpKSB7XG4gICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSByZXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICByZXNbaV0uaWQgPSByZXNbaV0uaWQgfHwgaWRzW2ldO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHJlcyk7XG4gICAgICB9KTtcbiAgICB9KS5iaW5kKHRoaXMpO1xuXG4gICAgdGhpcy5yZWdpc3RlckRlcGVuZGVudERhdGFiYXNlID0gYWRhcHRlckZ1bigncmVnaXN0ZXJEZXBlbmRlbnREYXRhYmFzZScsIGZ1bmN0aW9uIChkZXBlbmRlbnREYiwgY2FsbGJhY2spIHtcbiAgICAgIHZhciBkYk9wdGlvbnMgPSBjbG9uZSh0aGlzLl9fb3B0cyk7XG4gICAgICBpZiAodGhpcy5fX29wdHMudmlld19hZGFwdGVyKSB7XG4gICAgICAgIGRiT3B0aW9ucy5hZGFwdGVyID0gdGhpcy5fX29wdHMudmlld19hZGFwdGVyO1xuICAgICAgfVxuXG4gICAgICB2YXIgZGVwREIgPSBuZXcgdGhpcy5jb25zdHJ1Y3RvcihkZXBlbmRlbnREYiwgZGJPcHRpb25zKTtcblxuICAgICAgZnVuY3Rpb24gZGlmZkZ1bihkb2MpIHtcbiAgICAgICAgZG9jLmRlcGVuZGVudERicyA9IGRvYy5kZXBlbmRlbnREYnMgfHwge307XG4gICAgICAgIGlmIChkb2MuZGVwZW5kZW50RGJzW2RlcGVuZGVudERiXSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTsgLy8gbm8gdXBkYXRlIHJlcXVpcmVkXG4gICAgICAgIH1cbiAgICAgICAgZG9jLmRlcGVuZGVudERic1tkZXBlbmRlbnREYl0gPSB0cnVlO1xuICAgICAgICByZXR1cm4gZG9jO1xuICAgICAgfVxuICAgICAgdXBzZXJ0KHRoaXMsICdfbG9jYWwvX3BvdWNoX2RlcGVuZGVudERicycsIGRpZmZGdW4pLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICBjYWxsYmFjayhudWxsLCB7ZGI6IGRlcERCfSk7XG4gICAgICB9KS5jYXRjaChjYWxsYmFjayk7XG4gICAgfSkuYmluZCh0aGlzKTtcblxuICAgIHRoaXMuZGVzdHJveSA9IGFkYXB0ZXJGdW4oJ2Rlc3Ryb3knLCBmdW5jdGlvbiAob3B0cywgY2FsbGJhY2spIHtcblxuICAgICAgaWYgKHR5cGVvZiBvcHRzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGNhbGxiYWNrID0gb3B0cztcbiAgICAgICAgb3B0cyA9IHt9O1xuICAgICAgfVxuXG4gICAgICB2YXIgdXNlUHJlZml4ID0gJ3VzZV9wcmVmaXgnIGluIHRoaXMgPyB0aGlzLnVzZV9wcmVmaXggOiB0cnVlO1xuXG4gICAgICBjb25zdCBkZXN0cm95RGIgPSAoKSA9PiB7XG4gICAgICAgIC8vIGNhbGwgZGVzdHJveSBtZXRob2Qgb2YgdGhlIHBhcnRpY3VsYXIgYWRhcHRvclxuICAgICAgICB0aGlzLl9kZXN0cm95KG9wdHMsIChlcnIsIHJlc3ApID0+IHtcbiAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5fZGVzdHJveWVkID0gdHJ1ZTtcbiAgICAgICAgICB0aGlzLmVtaXQoJ2Rlc3Ryb3llZCcpO1xuICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3AgfHwgeyAnb2snOiB0cnVlIH0pO1xuICAgICAgICB9KTtcbiAgICAgIH07XG5cbiAgICAgIGlmIChpc1JlbW90ZSh0aGlzKSkge1xuICAgICAgICAvLyBubyBuZWVkIHRvIGNoZWNrIGZvciBkZXBlbmRlbnQgREJzIGlmIGl0J3MgYSByZW1vdGUgREJcbiAgICAgICAgcmV0dXJuIGRlc3Ryb3lEYigpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLmdldCgnX2xvY2FsL19wb3VjaF9kZXBlbmRlbnREYnMnLCAoZXJyLCBsb2NhbERvYykgPT4ge1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgICAgICAgaWYgKGVyci5zdGF0dXMgIT09IDQwNCkge1xuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgfSBlbHNlIHsgLy8gbm8gZGVwZW5kZW5jaWVzXG4gICAgICAgICAgICByZXR1cm4gZGVzdHJveURiKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHZhciBkZXBlbmRlbnREYnMgPSBsb2NhbERvYy5kZXBlbmRlbnREYnM7XG4gICAgICAgIHZhciBQb3VjaERCID0gdGhpcy5jb25zdHJ1Y3RvcjtcbiAgICAgICAgdmFyIGRlbGV0ZWRNYXAgPSBPYmplY3Qua2V5cyhkZXBlbmRlbnREYnMpLm1hcCgobmFtZSkgPT4ge1xuICAgICAgICAgIC8vIHVzZV9wcmVmaXggaXMgb25seSBmYWxzZSBpbiB0aGUgYnJvd3NlclxuICAgICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gICAgICAgICAgdmFyIHRydWVOYW1lID0gdXNlUHJlZml4ID9cbiAgICAgICAgICAgIG5hbWUucmVwbGFjZShuZXcgUmVnRXhwKCdeJyArIFBvdWNoREIucHJlZml4KSwgJycpIDogbmFtZTtcbiAgICAgICAgICByZXR1cm4gbmV3IFBvdWNoREIodHJ1ZU5hbWUsIHRoaXMuX19vcHRzKS5kZXN0cm95KCk7XG4gICAgICAgIH0pO1xuICAgICAgICBQcm9taXNlLmFsbChkZWxldGVkTWFwKS50aGVuKGRlc3Ryb3lEYiwgY2FsbGJhY2spO1xuICAgICAgfSk7XG4gICAgfSkuYmluZCh0aGlzKTtcbiAgfVxuXG4gIF9jb21wYWN0KG9wdHMsIGNhbGxiYWNrKSB7XG4gICAgdmFyIGNoYW5nZXNPcHRzID0ge1xuICAgICAgcmV0dXJuX2RvY3M6IGZhbHNlLFxuICAgICAgbGFzdF9zZXE6IG9wdHMubGFzdF9zZXEgfHwgMFxuICAgIH07XG4gICAgdmFyIHByb21pc2VzID0gW107XG5cbiAgICB2YXIgdGFza0lkO1xuICAgIHZhciBjb21wYWN0ZWREb2NzID0gMDtcblxuICAgIGNvbnN0IG9uQ2hhbmdlID0gKHJvdykgPT4ge1xuICAgICAgdGhpcy5hY3RpdmVUYXNrcy51cGRhdGUodGFza0lkLCB7XG4gICAgICAgIGNvbXBsZXRlZF9pdGVtczogKytjb21wYWN0ZWREb2NzXG4gICAgICB9KTtcbiAgICAgIHByb21pc2VzLnB1c2godGhpcy5jb21wYWN0RG9jdW1lbnQocm93LmlkLCAwKSk7XG4gICAgfTtcbiAgICBjb25zdCBvbkVycm9yID0gKGVycikgPT4ge1xuICAgICAgdGhpcy5hY3RpdmVUYXNrcy5yZW1vdmUodGFza0lkLCBlcnIpO1xuICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICB9O1xuICAgIGNvbnN0IG9uQ29tcGxldGUgPSAocmVzcCkgPT4ge1xuICAgICAgdmFyIGxhc3RTZXEgPSByZXNwLmxhc3Rfc2VxO1xuICAgICAgUHJvbWlzZS5hbGwocHJvbWlzZXMpLnRoZW4oKCkgPT4ge1xuICAgICAgICByZXR1cm4gdXBzZXJ0KHRoaXMsICdfbG9jYWwvY29tcGFjdGlvbicsIChkb2MpID0+IHtcbiAgICAgICAgICBpZiAoIWRvYy5sYXN0X3NlcSB8fCBkb2MubGFzdF9zZXEgPCBsYXN0U2VxKSB7XG4gICAgICAgICAgICBkb2MubGFzdF9zZXEgPSBsYXN0U2VxO1xuICAgICAgICAgICAgcmV0dXJuIGRvYztcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGZhbHNlOyAvLyBzb21lYm9keSBlbHNlIGdvdCBoZXJlIGZpcnN0LCBkb24ndCB1cGRhdGVcbiAgICAgICAgfSk7XG4gICAgICB9KS50aGVuKCgpID0+IHtcbiAgICAgICAgdGhpcy5hY3RpdmVUYXNrcy5yZW1vdmUodGFza0lkKTtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwge29rOiB0cnVlfSk7XG4gICAgICB9KS5jYXRjaChvbkVycm9yKTtcbiAgICB9O1xuXG4gICAgdGhpcy5pbmZvKCkudGhlbigoaW5mbykgPT4ge1xuICAgICAgdGFza0lkID0gdGhpcy5hY3RpdmVUYXNrcy5hZGQoe1xuICAgICAgICBuYW1lOiAnZGF0YWJhc2VfY29tcGFjdGlvbicsXG4gICAgICAgIHRvdGFsX2l0ZW1zOiBpbmZvLnVwZGF0ZV9zZXEgLSBjaGFuZ2VzT3B0cy5sYXN0X3NlcSxcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLmNoYW5nZXMoY2hhbmdlc09wdHMpXG4gICAgICAgIC5vbignY2hhbmdlJywgb25DaGFuZ2UpXG4gICAgICAgIC5vbignY29tcGxldGUnLCBvbkNvbXBsZXRlKVxuICAgICAgICAub24oJ2Vycm9yJywgb25FcnJvcik7XG4gICAgfSk7XG4gIH1cblxuICBjaGFuZ2VzKG9wdHMsIGNhbGxiYWNrKSB7XG4gICAgaWYgKHR5cGVvZiBvcHRzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBjYWxsYmFjayA9IG9wdHM7XG4gICAgICBvcHRzID0ge307XG4gICAgfVxuXG4gICAgb3B0cyA9IG9wdHMgfHwge307XG5cbiAgICAvLyBCeSBkZWZhdWx0IHNldCByZXR1cm5fZG9jcyB0byBmYWxzZSBpZiB0aGUgY2FsbGVyIGhhcyBvcHRzLmxpdmUgPSB0cnVlLFxuICAgIC8vIHRoaXMgd2lsbCBwcmV2ZW50IHVzIGZyb20gY29sbGVjdGluZyB0aGUgc2V0IG9mIGNoYW5nZXMgaW5kZWZpbml0ZWx5XG4gICAgLy8gcmVzdWx0aW5nIGluIGdyb3dpbmcgbWVtb3J5XG4gICAgb3B0cy5yZXR1cm5fZG9jcyA9ICgncmV0dXJuX2RvY3MnIGluIG9wdHMpID8gb3B0cy5yZXR1cm5fZG9jcyA6ICFvcHRzLmxpdmU7XG5cbiAgICByZXR1cm4gbmV3IENoYW5nZXModGhpcywgb3B0cywgY2FsbGJhY2spO1xuICB9XG5cbiAgdHlwZSgpIHtcbiAgICByZXR1cm4gKHR5cGVvZiB0aGlzLl90eXBlID09PSAnZnVuY3Rpb24nKSA/IHRoaXMuX3R5cGUoKSA6IHRoaXMuYWRhcHRlcjtcbiAgfVxufVxuXG4vLyBUaGUgYWJzdHJhY3QgcHVyZ2UgaW1wbGVtZW50YXRpb24gZXhwZWN0cyBhIGRvYyBpZCBhbmQgdGhlIHJldiBvZiBhIGxlYWYgbm9kZSBpbiB0aGF0IGRvYy5cbi8vIEl0IHdpbGwgcmV0dXJuIGVycm9ycyBpZiB0aGUgcmV2IGRvZXNu4oCZdCBleGlzdCBvciBpc27igJl0IGEgbGVhZi5cbkFic3RyYWN0UG91Y2hEQi5wcm90b3R5cGUucHVyZ2UgPSBhZGFwdGVyRnVuKCdfcHVyZ2UnLCBmdW5jdGlvbiAoZG9jSWQsIHJldiwgY2FsbGJhY2spIHtcbiAgaWYgKHR5cGVvZiB0aGlzLl9wdXJnZSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICByZXR1cm4gY2FsbGJhY2soY3JlYXRlRXJyb3IoVU5LTk9XTl9FUlJPUiwgJ1B1cmdlIGlzIG5vdCBpbXBsZW1lbnRlZCBpbiB0aGUgJyArIHRoaXMuYWRhcHRlciArICcgYWRhcHRlci4nKSk7XG4gIH1cbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIHNlbGYuX2dldFJldmlzaW9uVHJlZShkb2NJZCwgKGVycm9yLCByZXZzKSA9PiB7XG4gICAgaWYgKGVycm9yKSB7XG4gICAgICByZXR1cm4gY2FsbGJhY2soZXJyb3IpO1xuICAgIH1cbiAgICBpZiAoIXJldnMpIHtcbiAgICAgIHJldHVybiBjYWxsYmFjayhjcmVhdGVFcnJvcihNSVNTSU5HX0RPQykpO1xuICAgIH1cbiAgICBsZXQgcGF0aDtcbiAgICB0cnkge1xuICAgICAgcGF0aCA9IGZpbmRQYXRoVG9MZWFmKHJldnMsIHJldik7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHJldHVybiBjYWxsYmFjayhlcnJvci5tZXNzYWdlIHx8IGVycm9yKTtcbiAgICB9XG4gICAgc2VsZi5fcHVyZ2UoZG9jSWQsIHBhdGgsIChlcnJvciwgcmVzdWx0KSA9PiB7XG4gICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycm9yKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGFwcGVuZFB1cmdlU2VxKHNlbGYsIGRvY0lkLCByZXYpLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHJldHVybiBjYWxsYmFjayhudWxsLCByZXN1bHQpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSk7XG59KTtcblxuZXhwb3J0IGRlZmF1bHQgQWJzdHJhY3RQb3VjaERCO1xuIiwiZXhwb3J0IGRlZmF1bHQgY2xhc3MgVGFza1F1ZXVlIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5pc1JlYWR5ID0gZmFsc2U7XG4gICAgdGhpcy5mYWlsZWQgPSBmYWxzZTtcbiAgICB0aGlzLnF1ZXVlID0gW107XG4gIH1cblxuICBleGVjdXRlKCkge1xuICAgIHZhciBmdW47XG4gICAgaWYgKHRoaXMuZmFpbGVkKSB7XG4gICAgICB3aGlsZSAoKGZ1biA9IHRoaXMucXVldWUuc2hpZnQoKSkpIHtcbiAgICAgICAgZnVuKHRoaXMuZmFpbGVkKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgd2hpbGUgKChmdW4gPSB0aGlzLnF1ZXVlLnNoaWZ0KCkpKSB7XG4gICAgICAgIGZ1bigpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZhaWwoZXJyKSB7XG4gICAgdGhpcy5mYWlsZWQgPSBlcnI7XG4gICAgdGhpcy5leGVjdXRlKCk7XG4gIH1cblxuICByZWFkeShkYikge1xuICAgIHRoaXMuaXNSZWFkeSA9IHRydWU7XG4gICAgdGhpcy5kYiA9IGRiO1xuICAgIHRoaXMuZXhlY3V0ZSgpO1xuICB9XG5cbiAgYWRkVGFzayhmdW4pIHtcbiAgICB0aGlzLnF1ZXVlLnB1c2goZnVuKTtcbiAgICBpZiAodGhpcy5mYWlsZWQpIHtcbiAgICAgIHRoaXMuZXhlY3V0ZSgpO1xuICAgIH1cbiAgfVxufVxuIiwiaW1wb3J0IHsgZ3VhcmRlZENvbnNvbGUsIGhhc0xvY2FsU3RvcmFnZSB9IGZyb20gJ3BvdWNoZGItdXRpbHMnO1xuXG5jb25zdCBnZXRQYXJzZUFkYXB0ZXIgPSAoUG91Y2hEQikgPT4gZnVuY3Rpb24gcGFyc2VBZGFwdGVyKG5hbWUsIG9wdHMpIHtcbiAgdmFyIG1hdGNoID0gbmFtZS5tYXRjaCgvKFthLXotXSopOlxcL1xcLyguKikvKTtcbiAgaWYgKG1hdGNoKSB7XG4gICAgLy8gdGhlIGh0dHAgYWRhcHRlciBleHBlY3RzIHRoZSBmdWxseSBxdWFsaWZpZWQgbmFtZVxuICAgIHJldHVybiB7XG4gICAgICBuYW1lOiAvaHR0cHM/Ly50ZXN0KG1hdGNoWzFdKSA/IG1hdGNoWzFdICsgJzovLycgKyBtYXRjaFsyXSA6IG1hdGNoWzJdLFxuICAgICAgYWRhcHRlcjogbWF0Y2hbMV1cbiAgICB9O1xuICB9XG5cbiAgdmFyIGFkYXB0ZXJzID0gUG91Y2hEQi5hZGFwdGVycztcbiAgdmFyIHByZWZlcnJlZEFkYXB0ZXJzID0gUG91Y2hEQi5wcmVmZXJyZWRBZGFwdGVycztcbiAgdmFyIHByZWZpeCA9IFBvdWNoREIucHJlZml4O1xuICB2YXIgYWRhcHRlck5hbWUgPSBvcHRzLmFkYXB0ZXI7XG5cbiAgaWYgKCFhZGFwdGVyTmFtZSkgeyAvLyBhdXRvbWF0aWNhbGx5IGRldGVybWluZSBhZGFwdGVyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwcmVmZXJyZWRBZGFwdGVycy5sZW5ndGg7ICsraSkge1xuICAgICAgYWRhcHRlck5hbWUgPSBwcmVmZXJyZWRBZGFwdGVyc1tpXTtcbiAgICAgIC8vIGNoZWNrIGZvciBicm93c2VycyB0aGF0IGhhdmUgYmVlbiB1cGdyYWRlZCBmcm9tIHdlYnNxbC1vbmx5IHRvIHdlYnNxbCtpZGJcbiAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgICAgaWYgKGFkYXB0ZXJOYW1lID09PSAnaWRiJyAmJiAnd2Vic3FsJyBpbiBhZGFwdGVycyAmJlxuICAgICAgICAgIGhhc0xvY2FsU3RvcmFnZSgpICYmIGxvY2FsU3RvcmFnZVsnX3BvdWNoX193ZWJzcWxkYl8nICsgcHJlZml4ICsgbmFtZV0pIHtcbiAgICAgICAgLy8gbG9nIGl0LCBiZWNhdXNlIHRoaXMgY2FuIGJlIGNvbmZ1c2luZyBkdXJpbmcgZGV2ZWxvcG1lbnRcbiAgICAgICAgZ3VhcmRlZENvbnNvbGUoJ2xvZycsICdQb3VjaERCIGlzIGRvd25ncmFkaW5nIFwiJyArIG5hbWUgKyAnXCIgdG8gV2ViU1FMIHRvJyArXG4gICAgICAgICAgJyBhdm9pZCBkYXRhIGxvc3MsIGJlY2F1c2UgaXQgd2FzIGFscmVhZHkgb3BlbmVkIHdpdGggV2ViU1FMLicpO1xuICAgICAgICBjb250aW51ZTsgLy8ga2VlcCB1c2luZyB3ZWJzcWwgdG8gYXZvaWQgdXNlciBkYXRhIGxvc3NcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIHZhciBhZGFwdGVyID0gYWRhcHRlcnNbYWRhcHRlck5hbWVdO1xuXG4gIC8vIGlmIGFkYXB0ZXIgaXMgaW52YWxpZCwgdGhlbiBhbiBlcnJvciB3aWxsIGJlIHRocm93biBsYXRlclxuICB2YXIgdXNlUHJlZml4ID0gKGFkYXB0ZXIgJiYgJ3VzZV9wcmVmaXgnIGluIGFkYXB0ZXIpID9cbiAgICBhZGFwdGVyLnVzZV9wcmVmaXggOiB0cnVlO1xuXG4gIHJldHVybiB7XG4gICAgbmFtZTogdXNlUHJlZml4ID8gKHByZWZpeCArIG5hbWUpIDogbmFtZSxcbiAgICBhZGFwdGVyOiBhZGFwdGVyTmFtZVxuICB9O1xufTtcblxuXG5cbmV4cG9ydCBkZWZhdWx0IGdldFBhcnNlQWRhcHRlcjsiLCJmdW5jdGlvbiBpbmhlcml0cyhBLCBCKSB7XG4gIEEucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShCLnByb3RvdHlwZSwge1xuICAgIGNvbnN0cnVjdG9yOiB7IHZhbHVlOiBBIH1cbiAgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVDbGFzcyhwYXJlbnQsIGluaXQpIHtcbiAgbGV0IGtsYXNzID0gZnVuY3Rpb24gKC4uLmFyZ3MpIHtcbiAgICBpZiAoISh0aGlzIGluc3RhbmNlb2Yga2xhc3MpKSB7XG4gICAgICByZXR1cm4gbmV3IGtsYXNzKC4uLmFyZ3MpO1xuICAgIH1cbiAgICBpbml0LmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9O1xuICBpbmhlcml0cyhrbGFzcywgcGFyZW50KTtcbiAgcmV0dXJuIGtsYXNzO1xufVxuIiwiaW1wb3J0IEFkYXB0ZXIgZnJvbSAnLi9hZGFwdGVyLmpzJztcbmltcG9ydCBUYXNrUXVldWUgZnJvbSAnLi90YXNrcXVldWUnO1xuaW1wb3J0IHsgY2xvbmUgfSBmcm9tICdwb3VjaGRiLXV0aWxzJztcbmltcG9ydCBnZXRQYXJzZUFkYXB0ZXIgZnJvbSAnLi9wYXJzZUFkYXB0ZXInO1xuaW1wb3J0IHsgY3JlYXRlQ2xhc3MgfSBmcm9tICcuL3V0aWxzJztcblxuLy8gT0ssIHNvIGhlcmUncyB0aGUgZGVhbC4gQ29uc2lkZXIgdGhpcyBjb2RlOlxuLy8gICAgIHZhciBkYjEgPSBuZXcgUG91Y2hEQignZm9vJyk7XG4vLyAgICAgdmFyIGRiMiA9IG5ldyBQb3VjaERCKCdmb28nKTtcbi8vICAgICBkYjEuZGVzdHJveSgpO1xuLy8gXiB0aGVzZSB0d28gYm90aCBuZWVkIHRvIGVtaXQgJ2Rlc3Ryb3llZCcgZXZlbnRzLFxuLy8gYXMgd2VsbCBhcyB0aGUgUG91Y2hEQiBjb25zdHJ1Y3RvciBpdHNlbGYuXG4vLyBTbyB3ZSBoYXZlIG9uZSBkYiBvYmplY3QgKHdoaWNoZXZlciBvbmUgZ290IGRlc3Ryb3koKSBjYWxsZWQgb24gaXQpXG4vLyByZXNwb25zaWJsZSBmb3IgZW1pdHRpbmcgdGhlIGluaXRpYWwgZXZlbnQsIHdoaWNoIHRoZW4gZ2V0cyBlbWl0dGVkXG4vLyBieSB0aGUgY29uc3RydWN0b3IsIHdoaWNoIHRoZW4gYnJvYWRjYXN0cyBpdCB0byBhbnkgb3RoZXIgZGJzXG4vLyB0aGF0IG1heSBoYXZlIGJlZW4gY3JlYXRlZCB3aXRoIHRoZSBzYW1lIG5hbWUuXG5mdW5jdGlvbiBwcmVwYXJlRm9yRGVzdHJ1Y3Rpb24oc2VsZikge1xuXG4gIGZ1bmN0aW9uIG9uRGVzdHJveWVkKGZyb21fY29uc3RydWN0b3IpIHtcbiAgICBzZWxmLnJlbW92ZUxpc3RlbmVyKCdjbG9zZWQnLCBvbkNsb3NlZCk7XG4gICAgaWYgKCFmcm9tX2NvbnN0cnVjdG9yKSB7XG4gICAgICBzZWxmLmNvbnN0cnVjdG9yLmVtaXQoJ2Rlc3Ryb3llZCcsIHNlbGYubmFtZSk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gb25DbG9zZWQoKSB7XG4gICAgc2VsZi5yZW1vdmVMaXN0ZW5lcignZGVzdHJveWVkJywgb25EZXN0cm95ZWQpO1xuICAgIHNlbGYuY29uc3RydWN0b3IuZW1pdCgndW5yZWYnLCBzZWxmKTtcbiAgfVxuXG4gIHNlbGYub25jZSgnZGVzdHJveWVkJywgb25EZXN0cm95ZWQpO1xuICBzZWxmLm9uY2UoJ2Nsb3NlZCcsIG9uQ2xvc2VkKTtcbiAgc2VsZi5jb25zdHJ1Y3Rvci5lbWl0KCdyZWYnLCBzZWxmKTtcbn1cblxuY2xhc3MgUG91Y2hJbnRlcm5hbCBleHRlbmRzIEFkYXB0ZXIge1xuICBjb25zdHJ1Y3RvcihuYW1lLCBvcHRzKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLl9zZXR1cChuYW1lLCBvcHRzKTtcbiAgfVxuXG4gIF9zZXR1cChuYW1lLCBvcHRzKSB7XG4gICAgc3VwZXIuX3NldHVwKCk7XG4gICAgb3B0cyA9IG9wdHMgfHwge307XG5cbiAgICBpZiAobmFtZSAmJiB0eXBlb2YgbmFtZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgIG9wdHMgPSBuYW1lO1xuICAgICAgbmFtZSA9IG9wdHMubmFtZTtcbiAgICAgIGRlbGV0ZSBvcHRzLm5hbWU7XG4gICAgfVxuXG4gICAgaWYgKG9wdHMuZGV0ZXJtaW5pc3RpY19yZXZzID09PSB1bmRlZmluZWQpIHtcbiAgICAgIG9wdHMuZGV0ZXJtaW5pc3RpY19yZXZzID0gdHJ1ZTtcbiAgICB9XG5cbiAgICB0aGlzLl9fb3B0cyA9IG9wdHMgPSBjbG9uZShvcHRzKTtcblxuICAgIHRoaXMuYXV0b19jb21wYWN0aW9uID0gb3B0cy5hdXRvX2NvbXBhY3Rpb247XG4gICAgdGhpcy5wdXJnZWRfaW5mb3NfbGltaXQgPSBvcHRzLnB1cmdlZF9pbmZvc19saW1pdCB8fCAxMDAwO1xuICAgIHRoaXMucHJlZml4ID0gUG91Y2hEQi5wcmVmaXg7XG5cbiAgICBpZiAodHlwZW9mIG5hbWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ01pc3NpbmcvaW52YWxpZCBEQiBuYW1lJyk7XG4gICAgfVxuXG4gICAgdmFyIHByZWZpeGVkTmFtZSA9IChvcHRzLnByZWZpeCB8fCAnJykgKyBuYW1lO1xuICAgIHZhciBiYWNrZW5kID0gcGFyc2VBZGFwdGVyKHByZWZpeGVkTmFtZSwgb3B0cyk7XG5cbiAgICBvcHRzLm5hbWUgPSBiYWNrZW5kLm5hbWU7XG4gICAgb3B0cy5hZGFwdGVyID0gb3B0cy5hZGFwdGVyIHx8IGJhY2tlbmQuYWRhcHRlcjtcblxuICAgIHRoaXMubmFtZSA9IG5hbWU7XG4gICAgdGhpcy5fYWRhcHRlciA9IG9wdHMuYWRhcHRlcjtcbiAgICBQb3VjaERCLmVtaXQoJ2RlYnVnJywgWydhZGFwdGVyJywgJ1BpY2tlZCBhZGFwdGVyOiAnLCBvcHRzLmFkYXB0ZXJdKTtcblxuICAgIGlmICghUG91Y2hEQi5hZGFwdGVyc1tvcHRzLmFkYXB0ZXJdIHx8XG4gICAgICAgICFQb3VjaERCLmFkYXB0ZXJzW29wdHMuYWRhcHRlcl0udmFsaWQoKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIEFkYXB0ZXI6ICcgKyBvcHRzLmFkYXB0ZXIpO1xuICAgIH1cblxuICAgIGlmIChvcHRzLnZpZXdfYWRhcHRlcikge1xuICAgICAgaWYgKCFQb3VjaERCLmFkYXB0ZXJzW29wdHMudmlld19hZGFwdGVyXSB8fFxuICAgICAgICAgICFQb3VjaERCLmFkYXB0ZXJzW29wdHMudmlld19hZGFwdGVyXS52YWxpZCgpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBWaWV3IEFkYXB0ZXI6ICcgKyBvcHRzLnZpZXdfYWRhcHRlcik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy50YXNrcXVldWUgPSBuZXcgVGFza1F1ZXVlKCk7XG5cbiAgICB0aGlzLmFkYXB0ZXIgPSBvcHRzLmFkYXB0ZXI7XG5cbiAgICBQb3VjaERCLmFkYXB0ZXJzW29wdHMuYWRhcHRlcl0uY2FsbCh0aGlzLCBvcHRzLCAoZXJyKSA9PiB7XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnRhc2txdWV1ZS5mYWlsKGVycik7XG4gICAgICB9XG4gICAgICBwcmVwYXJlRm9yRGVzdHJ1Y3Rpb24odGhpcyk7XG5cbiAgICAgIHRoaXMuZW1pdCgnY3JlYXRlZCcsIHRoaXMpO1xuICAgICAgUG91Y2hEQi5lbWl0KCdjcmVhdGVkJywgdGhpcy5uYW1lKTtcbiAgICAgIHRoaXMudGFza3F1ZXVlLnJlYWR5KHRoaXMpO1xuICAgIH0pO1xuICB9XG59XG5cbmNvbnN0IFBvdWNoREIgPSBjcmVhdGVDbGFzcyhQb3VjaEludGVybmFsLCBmdW5jdGlvbiAobmFtZSwgb3B0cykge1xuICBQb3VjaEludGVybmFsLnByb3RvdHlwZS5fc2V0dXAuY2FsbCh0aGlzLCBuYW1lLCBvcHRzKTtcbn0pO1xuXG5jb25zdCBwYXJzZUFkYXB0ZXIgPSBnZXRQYXJzZUFkYXB0ZXIoUG91Y2hEQik7XG5cbmV4cG9ydCBkZWZhdWx0IFBvdWNoREI7XG4iLCJpbXBvcnQge3Y0IGFzIHV1aWR2NH0gZnJvbSBcInV1aWRcIjtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgQWN0aXZlVGFza3Mge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLnRhc2tzID0ge307XG4gIH1cblxuICBsaXN0KCkge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMudGFza3MpO1xuICB9XG5cbiAgYWRkKHRhc2spIHtcbiAgICBjb25zdCBpZCA9IHV1aWR2NCgpO1xuICAgIHRoaXMudGFza3NbaWRdID0ge1xuICAgICAgaWQsXG4gICAgICBuYW1lOiB0YXNrLm5hbWUsXG4gICAgICB0b3RhbF9pdGVtczogdGFzay50b3RhbF9pdGVtcyxcbiAgICAgIGNyZWF0ZWRfYXQ6IG5ldyBEYXRlKCkudG9KU09OKClcbiAgICB9O1xuICAgIHJldHVybiBpZDtcbiAgfVxuXG4gIGdldChpZCkge1xuICAgIHJldHVybiB0aGlzLnRhc2tzW2lkXTtcbiAgfVxuXG4gIC8qIGVzbGludC1kaXNhYmxlIG5vLXVudXNlZC12YXJzICovXG4gIHJlbW92ZShpZCwgcmVhc29uKSB7XG4gICAgZGVsZXRlIHRoaXMudGFza3NbaWRdO1xuICAgIHJldHVybiB0aGlzLnRhc2tzO1xuICB9XG5cbiAgdXBkYXRlKGlkLCB1cGRhdGVkVGFzaykge1xuICAgIGNvbnN0IHRhc2sgPSB0aGlzLnRhc2tzW2lkXTtcbiAgICBpZiAodHlwZW9mIHRhc2sgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICBjb25zdCBtZXJnZWRUYXNrID0ge1xuICAgICAgICBpZDogdGFzay5pZCxcbiAgICAgICAgbmFtZTogdGFzay5uYW1lLFxuICAgICAgICBjcmVhdGVkX2F0OiB0YXNrLmNyZWF0ZWRfYXQsXG4gICAgICAgIHRvdGFsX2l0ZW1zOiB1cGRhdGVkVGFzay50b3RhbF9pdGVtcyB8fCB0YXNrLnRvdGFsX2l0ZW1zLFxuICAgICAgICBjb21wbGV0ZWRfaXRlbXM6IHVwZGF0ZWRUYXNrLmNvbXBsZXRlZF9pdGVtcyB8fCB0YXNrLmNvbXBsZXRlZF9pdGVtcyxcbiAgICAgICAgdXBkYXRlZF9hdDogbmV3IERhdGUoKS50b0pTT04oKVxuICAgICAgfTtcbiAgICAgIHRoaXMudGFza3NbaWRdID0gbWVyZ2VkVGFzaztcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMudGFza3M7XG4gIH1cbn1cbiIsIi8vICd1c2Ugc3RyaWN0JzsgaXMgZGVmYXVsdCB3aGVuIEVTTVxuXG5pbXBvcnQgUG91Y2hEQiBmcm9tICcuL2NvbnN0cnVjdG9yJztcbmltcG9ydCBFRSBmcm9tICdub2RlOmV2ZW50cyc7XG5pbXBvcnQgeyBmZXRjaCB9IGZyb20gJ3BvdWNoZGItZmV0Y2gnO1xuaW1wb3J0IEFjdGl2ZVRhc2tzIGZyb20gJy4vYWN0aXZlLXRhc2tzJztcbmltcG9ydCB7IGNyZWF0ZUNsYXNzIH0gZnJvbSAnLi91dGlscyc7XG5cblBvdWNoREIuYWRhcHRlcnMgPSB7fTtcblBvdWNoREIucHJlZmVycmVkQWRhcHRlcnMgPSBbXTtcblxuUG91Y2hEQi5wcmVmaXggPSAnX3BvdWNoXyc7XG5cbnZhciBldmVudEVtaXR0ZXIgPSBuZXcgRUUoKTtcblxuZnVuY3Rpb24gc2V0VXBFdmVudEVtaXR0ZXIoUG91Y2gpIHtcbiAgT2JqZWN0LmtleXMoRUUucHJvdG90eXBlKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcbiAgICBpZiAodHlwZW9mIEVFLnByb3RvdHlwZVtrZXldID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBQb3VjaFtrZXldID0gZXZlbnRFbWl0dGVyW2tleV0uYmluZChldmVudEVtaXR0ZXIpO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gdGhlc2UgYXJlIGNyZWF0ZWQgaW4gY29uc3RydWN0b3IuanMsIGFuZCBhbGxvdyB1cyB0byBub3RpZnkgZWFjaCBEQiB3aXRoXG4gIC8vIHRoZSBzYW1lIG5hbWUgdGhhdCBpdCB3YXMgZGVzdHJveWVkLCB2aWEgdGhlIGNvbnN0cnVjdG9yIG9iamVjdFxuICB2YXIgZGVzdHJ1Y3RMaXN0ZW5lcnMgPSBQb3VjaC5fZGVzdHJ1Y3Rpb25MaXN0ZW5lcnMgPSBuZXcgTWFwKCk7XG5cbiAgUG91Y2gub24oJ3JlZicsIGZ1bmN0aW9uIG9uQ29uc3RydWN0b3JSZWYoZGIpIHtcbiAgICBpZiAoIWRlc3RydWN0TGlzdGVuZXJzLmhhcyhkYi5uYW1lKSkge1xuICAgICAgZGVzdHJ1Y3RMaXN0ZW5lcnMuc2V0KGRiLm5hbWUsIFtdKTtcbiAgICB9XG4gICAgZGVzdHJ1Y3RMaXN0ZW5lcnMuZ2V0KGRiLm5hbWUpLnB1c2goZGIpO1xuICB9KTtcblxuICBQb3VjaC5vbigndW5yZWYnLCBmdW5jdGlvbiBvbkNvbnN0cnVjdG9yVW5yZWYoZGIpIHtcbiAgICBpZiAoIWRlc3RydWN0TGlzdGVuZXJzLmhhcyhkYi5uYW1lKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgZGJMaXN0ID0gZGVzdHJ1Y3RMaXN0ZW5lcnMuZ2V0KGRiLm5hbWUpO1xuICAgIHZhciBwb3MgPSBkYkxpc3QuaW5kZXhPZihkYik7XG4gICAgaWYgKHBvcyA8IDApIHtcbiAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGRiTGlzdC5zcGxpY2UocG9zLCAxKTtcbiAgICBpZiAoZGJMaXN0Lmxlbmd0aCA+IDEpIHtcbiAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gICAgICBkZXN0cnVjdExpc3RlbmVycy5zZXQoZGIubmFtZSwgZGJMaXN0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgZGVzdHJ1Y3RMaXN0ZW5lcnMuZGVsZXRlKGRiLm5hbWUpO1xuICAgIH1cbiAgfSk7XG5cbiAgUG91Y2gub24oJ2Rlc3Ryb3llZCcsIGZ1bmN0aW9uIG9uQ29uc3RydWN0b3JEZXN0cm95ZWQobmFtZSkge1xuICAgIGlmICghZGVzdHJ1Y3RMaXN0ZW5lcnMuaGFzKG5hbWUpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciBkYkxpc3QgPSBkZXN0cnVjdExpc3RlbmVycy5nZXQobmFtZSk7XG4gICAgZGVzdHJ1Y3RMaXN0ZW5lcnMuZGVsZXRlKG5hbWUpO1xuICAgIGRiTGlzdC5mb3JFYWNoKGZ1bmN0aW9uIChkYikge1xuICAgICAgZGIuZW1pdCgnZGVzdHJveWVkJyx0cnVlKTtcbiAgICB9KTtcbiAgfSk7XG59XG5cbnNldFVwRXZlbnRFbWl0dGVyKFBvdWNoREIpO1xuXG5Qb3VjaERCLmFkYXB0ZXIgPSBmdW5jdGlvbiAoaWQsIG9iaiwgYWRkVG9QcmVmZXJyZWRBZGFwdGVycykge1xuICAvKiBpc3RhbmJ1bCBpZ25vcmUgZWxzZSAqL1xuICBpZiAob2JqLnZhbGlkKCkpIHtcbiAgICBQb3VjaERCLmFkYXB0ZXJzW2lkXSA9IG9iajtcbiAgICBpZiAoYWRkVG9QcmVmZXJyZWRBZGFwdGVycykge1xuICAgICAgUG91Y2hEQi5wcmVmZXJyZWRBZGFwdGVycy5wdXNoKGlkKTtcbiAgICB9XG4gIH1cbn07XG5cblBvdWNoREIucGx1Z2luID0gZnVuY3Rpb24gKG9iaikge1xuICBpZiAodHlwZW9mIG9iaiA9PT0gJ2Z1bmN0aW9uJykgeyAvLyBmdW5jdGlvbiBzdHlsZSBmb3IgcGx1Z2luc1xuICAgIG9iaihQb3VjaERCKTtcbiAgfSBlbHNlIGlmICh0eXBlb2Ygb2JqICE9PSAnb2JqZWN0JyB8fCBPYmplY3Qua2V5cyhvYmopLmxlbmd0aCA9PT0gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBwbHVnaW46IGdvdCBcIicgKyBvYmogKyAnXCIsIGV4cGVjdGVkIGFuIG9iamVjdCBvciBhIGZ1bmN0aW9uJyk7XG4gIH0gZWxzZSB7XG4gICAgT2JqZWN0LmtleXMob2JqKS5mb3JFYWNoKGZ1bmN0aW9uIChpZCkgeyAvLyBvYmplY3Qgc3R5bGUgZm9yIHBsdWdpbnNcbiAgICAgIFBvdWNoREIucHJvdG90eXBlW2lkXSA9IG9ialtpZF07XG4gICAgfSk7XG4gIH1cbiAgaWYgKHRoaXMuX19kZWZhdWx0cykge1xuICAgIFBvdWNoREIuX19kZWZhdWx0cyA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMuX19kZWZhdWx0cyk7XG4gIH1cbiAgcmV0dXJuIFBvdWNoREI7XG59O1xuXG5Qb3VjaERCLmRlZmF1bHRzID0gZnVuY3Rpb24gKGRlZmF1bHRPcHRzKSB7XG4gIGxldCBQb3VjaFdpdGhEZWZhdWx0cyA9IGNyZWF0ZUNsYXNzKFBvdWNoREIsIGZ1bmN0aW9uIChuYW1lLCBvcHRzKSB7XG4gICAgb3B0cyA9IG9wdHMgfHwge307XG5cbiAgICBpZiAobmFtZSAmJiB0eXBlb2YgbmFtZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgIG9wdHMgPSBuYW1lO1xuICAgICAgbmFtZSA9IG9wdHMubmFtZTtcbiAgICAgIGRlbGV0ZSBvcHRzLm5hbWU7XG4gICAgfVxuXG4gICAgb3B0cyA9IE9iamVjdC5hc3NpZ24oe30sIFBvdWNoV2l0aERlZmF1bHRzLl9fZGVmYXVsdHMsIG9wdHMpO1xuICAgIFBvdWNoREIuY2FsbCh0aGlzLCBuYW1lLCBvcHRzKTtcbiAgfSk7XG5cbiAgUG91Y2hXaXRoRGVmYXVsdHMucHJlZmVycmVkQWRhcHRlcnMgPSBQb3VjaERCLnByZWZlcnJlZEFkYXB0ZXJzLnNsaWNlKCk7XG4gIE9iamVjdC5rZXlzKFBvdWNoREIpLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgIGlmICghKGtleSBpbiBQb3VjaFdpdGhEZWZhdWx0cykpIHtcbiAgICAgIFBvdWNoV2l0aERlZmF1bHRzW2tleV0gPSBQb3VjaERCW2tleV07XG4gICAgfVxuICB9KTtcblxuICAvLyBtYWtlIGRlZmF1bHQgb3B0aW9ucyB0cmFuc2l0aXZlXG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9wb3VjaGRiL3BvdWNoZGIvaXNzdWVzLzU5MjJcbiAgUG91Y2hXaXRoRGVmYXVsdHMuX19kZWZhdWx0cyA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMuX19kZWZhdWx0cywgZGVmYXVsdE9wdHMpO1xuXG4gIHJldHVybiBQb3VjaFdpdGhEZWZhdWx0cztcbn07XG5cblBvdWNoREIuZmV0Y2ggPSBmdW5jdGlvbiAodXJsLCBvcHRzKSB7XG4gIHJldHVybiBmZXRjaCh1cmwsIG9wdHMpO1xufTtcblxuUG91Y2hEQi5wcm90b3R5cGUuYWN0aXZlVGFza3MgPSBQb3VjaERCLmFjdGl2ZVRhc2tzID0gbmV3IEFjdGl2ZVRhc2tzKCk7XG5cbmV4cG9ydCBkZWZhdWx0IFBvdWNoREI7XG4iLCIvLyBtYW5hZ2VkIGF1dG9tYXRpY2FsbHkgYnkgc2V0LXZlcnNpb24uanNcbmV4cG9ydCBkZWZhdWx0IFwiNy4wLjAtcHJlcmVsZWFzZVwiO1xuIiwiaW1wb3J0IFBvdWNoREIgZnJvbSAnLi9zZXR1cCc7XG5pbXBvcnQgdmVyc2lvbiBmcm9tICcuL3ZlcnNpb24nO1xuaW1wb3J0IHBvdWNoQ2hhbmdlc0ZpbHRlciBmcm9tICdwb3VjaGRiLWNoYW5nZXMtZmlsdGVyJztcblxuLy8gVE9ETzogcmVtb3ZlIGZyb20gcG91Y2hkYi1jb3JlIChicmVha2luZylcblBvdWNoREIucGx1Z2luKHBvdWNoQ2hhbmdlc0ZpbHRlcik7XG5cblBvdWNoREIudmVyc2lvbiA9IHZlcnNpb247XG5cbmV4cG9ydCBkZWZhdWx0IFBvdWNoREI7XG4iXSwibmFtZXMiOlsiZXZlbnRzIiwiUG91Y2hEQiIsIm5leHRUaWNrIiwiRXZlbnRFbWl0dGVyIiwiYnVsa0dldFNoaW0iLCJBZGFwdGVyIiwidXVpZHY0IiwicG91Y2hDaGFuZ2VzRmlsdGVyIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBZUEsU0FBUyx3QkFBd0IsQ0FBQyxJQUFJLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUU7QUFDbEU7QUFDQSxFQUFFLElBQUk7QUFDTixJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDbEQsR0FBRyxDQUFDLE9BQU8sQ0FBQyxFQUFFO0FBQ2QsSUFBSSxjQUFjLENBQUMsT0FBTyxFQUFFLG1DQUFtQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQ3BFLEdBQUc7QUFDSCxDQUFDO0FBQ0Q7QUFDQSxTQUFTLGFBQWEsQ0FBQyxHQUFHLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRTtBQUM1QyxFQUFFLElBQUksVUFBVSxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7QUFDckMsRUFBRSxJQUFJLElBQUksQ0FBQyxLQUFLLEtBQUssVUFBVSxFQUFFO0FBQ2pDLElBQUksVUFBVSxHQUFHLGFBQWEsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDO0FBQ2pELEtBQUssR0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUFFLEVBQUUsT0FBTyxDQUFDLEdBQUcsRUFB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
