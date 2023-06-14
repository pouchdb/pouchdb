import { a as adapterFun, b as bulkGet, p as pick } from './bulkGetShim-d4877145.js';
import { e as events$1 } from './__node-resolve_empty-5ffda92e.js';
import { i as immediate, h as hasLocalStorage } from './functionName-9335a350.js';
import { c as clone } from './clone-abfcddc8.js';
import { g as guardedConsole } from './guardedConsole-f54e5a40.js';
import { createError, MISSING_DOC, UNKNOWN_ERROR, NOT_AN_OBJECT, REV_CONFLICT, INVALID_ID, INVALID_REV, QUERY_PARSE_ERROR, MISSING_BULK_DOCS, BAD_REQUEST } from './pouchdb-errors.browser.js';
import { l as listenerCount, i as invalidIdError, r as rev, v as v4 } from './rev-5645662a.js';
import { i as isRemote } from './isRemote-f9121da9.js';
import { u as upsert } from './upsert-331b6913.js';
import { o as once } from './toPromise-9dada06a.js';
import './spark-md5-2c57e5fc.js';
import { a as collectLeaves, c as collectConflicts } from './collectConflicts-6afe46fc.js';
import { i as isDeleted, a as isLocalId } from './isLocalId-d067de54.js';
import events from 'node:events';
import { t as traverseRevTree, r as rootToLeaf } from './rootToLeaf-f8d0e78a.js';
import { f as findPathToLeaf } from './findPathToLeaf-7e69c93c.js';
import { fetch } from './pouchdb-fetch.browser.js';
import applyChangesFilterPlugin from './pouchdb-changes-filter.browser.js';
import './_commonjsHelpers-24198af3.js';
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

class Changes extends events {
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

class AbstractPouchDB extends events$1 {
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

var eventEmitter = new events$1();

function setUpEventEmitter(Pouch) {
  Object.keys(events$1.prototype).forEach(function (key) {
    if (typeof events$1.prototype[key] === 'function') {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG91Y2hkYi1jb3JlLmJyb3dzZXIuanMiLCJzb3VyY2VzIjpbIi4uL3BhY2thZ2VzL3BvdWNoZGItY29yZS9zcmMvY2hhbmdlcy5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItY29yZS9zcmMvYWRhcHRlci5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItY29yZS9zcmMvdGFza3F1ZXVlLmpzIiwiLi4vcGFja2FnZXMvcG91Y2hkYi1jb3JlL3NyYy9wYXJzZUFkYXB0ZXIuanMiLCIuLi9wYWNrYWdlcy9wb3VjaGRiLWNvcmUvc3JjL3V0aWxzLmpzIiwiLi4vcGFja2FnZXMvcG91Y2hkYi1jb3JlL3NyYy9jb25zdHJ1Y3Rvci5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItY29yZS9zcmMvYWN0aXZlLXRhc2tzLmpzIiwiLi4vcGFja2FnZXMvcG91Y2hkYi1jb3JlL3NyYy9zZXR1cC5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItY29yZS9zcmMvdmVyc2lvbi5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItY29yZS9zcmMvaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcbiAgY2xvbmUsXG4gIGxpc3RlbmVyQ291bnQsXG4gIG9uY2UsXG4gIGd1YXJkZWRDb25zb2xlXG59IGZyb20gJ3BvdWNoZGItdXRpbHMnO1xuaW1wb3J0IHtcbiAgaXNEZWxldGVkLFxuICBjb2xsZWN0TGVhdmVzLFxuICBjb2xsZWN0Q29uZmxpY3RzXG59IGZyb20gJ3BvdWNoZGItbWVyZ2UnO1xuaW1wb3J0IGV2ZW50cyBmcm9tICdub2RlOmV2ZW50cyc7XG5cbmltcG9ydCBQb3VjaERCIGZyb20gJy4vc2V0dXAnO1xuXG5mdW5jdGlvbiB0cnlDYXRjaEluQ2hhbmdlTGlzdGVuZXIoc2VsZiwgY2hhbmdlLCBwZW5kaW5nLCBsYXN0U2VxKSB7XG4gIC8vIGlzb2xhdGUgdHJ5L2NhdGNoZXMgdG8gYXZvaWQgVjggZGVvcHRpbWl6YXRpb25zXG4gIHRyeSB7XG4gICAgc2VsZi5lbWl0KCdjaGFuZ2UnLCBjaGFuZ2UsIHBlbmRpbmcsIGxhc3RTZXEpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgZ3VhcmRlZENvbnNvbGUoJ2Vycm9yJywgJ0Vycm9yIGluIC5vbihcImNoYW5nZVwiLCBmdW5jdGlvbik6JywgZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcHJvY2Vzc0NoYW5nZShkb2MsIG1ldGFkYXRhLCBvcHRzKSB7XG4gIHZhciBjaGFuZ2VMaXN0ID0gW3tyZXY6IGRvYy5fcmV2fV07XG4gIGlmIChvcHRzLnN0eWxlID09PSAnYWxsX2RvY3MnKSB7XG4gICAgY2hhbmdlTGlzdCA9IGNvbGxlY3RMZWF2ZXMobWV0YWRhdGEucmV2X3RyZWUpXG4gICAgLm1hcChmdW5jdGlvbiAoeCkgeyByZXR1cm4ge3JldjogeC5yZXZ9OyB9KTtcbiAgfVxuICB2YXIgY2hhbmdlID0ge1xuICAgIGlkOiBtZXRhZGF0YS5pZCxcbiAgICBjaGFuZ2VzOiBjaGFuZ2VMaXN0LFxuICAgIGRvYzogZG9jXG4gIH07XG5cbiAgaWYgKGlzRGVsZXRlZChtZXRhZGF0YSwgZG9jLl9yZXYpKSB7XG4gICAgY2hhbmdlLmRlbGV0ZWQgPSB0cnVlO1xuICB9XG4gIGlmIChvcHRzLmNvbmZsaWN0cykge1xuICAgIGNoYW5nZS5kb2MuX2NvbmZsaWN0cyA9IGNvbGxlY3RDb25mbGljdHMobWV0YWRhdGEpO1xuICAgIGlmICghY2hhbmdlLmRvYy5fY29uZmxpY3RzLmxlbmd0aCkge1xuICAgICAgZGVsZXRlIGNoYW5nZS5kb2MuX2NvbmZsaWN0cztcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGNoYW5nZTtcbn1cblxuY2xhc3MgQ2hhbmdlcyBleHRlbmRzIGV2ZW50cyB7XG4gIGNvbnN0cnVjdG9yKGRiLCBvcHRzLCBjYWxsYmFjaykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5kYiA9IGRiO1xuICAgIG9wdHMgPSBvcHRzID8gY2xvbmUob3B0cykgOiB7fTtcbiAgICB2YXIgY29tcGxldGUgPSBvcHRzLmNvbXBsZXRlID0gb25jZSgoZXJyLCByZXNwKSA9PiB7XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIGlmIChsaXN0ZW5lckNvdW50KHRoaXMsICdlcnJvcicpID4gMCkge1xuICAgICAgICAgIHRoaXMuZW1pdCgnZXJyb3InLCBlcnIpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmVtaXQoJ2NvbXBsZXRlJywgcmVzcCk7XG4gICAgICB9XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygpO1xuICAgICAgZGIucmVtb3ZlTGlzdGVuZXIoJ2Rlc3Ryb3llZCcsIG9uRGVzdHJveSk7XG4gICAgfSk7XG4gICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICB0aGlzLm9uKCdjb21wbGV0ZScsIGZ1bmN0aW9uIChyZXNwKSB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3ApO1xuICAgICAgfSk7XG4gICAgICB0aGlzLm9uKCdlcnJvcicsIGNhbGxiYWNrKTtcbiAgICB9XG4gICAgY29uc3Qgb25EZXN0cm95ID0gKCkgPT4ge1xuICAgICAgdGhpcy5jYW5jZWwoKTtcbiAgICB9O1xuICAgIGRiLm9uY2UoJ2Rlc3Ryb3llZCcsIG9uRGVzdHJveSk7XG4gIFxuICAgIG9wdHMub25DaGFuZ2UgPSAoY2hhbmdlLCBwZW5kaW5nLCBsYXN0U2VxKSA9PiB7XG4gICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICAgIGlmICh0aGlzLmlzQ2FuY2VsbGVkKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHRyeUNhdGNoSW5DaGFuZ2VMaXN0ZW5lcih0aGlzLCBjaGFuZ2UsIHBlbmRpbmcsIGxhc3RTZXEpO1xuICAgIH07XG4gIFxuICAgIHZhciBwcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24gKGZ1bGZpbGwsIHJlamVjdCkge1xuICAgICAgb3B0cy5jb21wbGV0ZSA9IGZ1bmN0aW9uIChlcnIsIHJlcykge1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZnVsZmlsbChyZXMpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH0pO1xuICAgIHRoaXMub25jZSgnY2FuY2VsJywgZnVuY3Rpb24gKCkge1xuICAgICAgZGIucmVtb3ZlTGlzdGVuZXIoJ2Rlc3Ryb3llZCcsIG9uRGVzdHJveSk7XG4gICAgICBvcHRzLmNvbXBsZXRlKG51bGwsIHtzdGF0dXM6ICdjYW5jZWxsZWQnfSk7XG4gICAgfSk7XG4gICAgdGhpcy50aGVuID0gcHJvbWlzZS50aGVuLmJpbmQocHJvbWlzZSk7XG4gICAgdGhpc1snY2F0Y2gnXSA9IHByb21pc2VbJ2NhdGNoJ10uYmluZChwcm9taXNlKTtcbiAgICB0aGlzLnRoZW4oZnVuY3Rpb24gKHJlc3VsdCkge1xuICAgICAgY29tcGxldGUobnVsbCwgcmVzdWx0KTtcbiAgICB9LCBjb21wbGV0ZSk7XG4gIFxuICBcbiAgXG4gICAgaWYgKCFkYi50YXNrcXVldWUuaXNSZWFkeSkge1xuICAgICAgZGIudGFza3F1ZXVlLmFkZFRhc2soKGZhaWxlZCkgPT4ge1xuICAgICAgICBpZiAoZmFpbGVkKSB7XG4gICAgICAgICAgb3B0cy5jb21wbGV0ZShmYWlsZWQpO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuaXNDYW5jZWxsZWQpIHtcbiAgICAgICAgICB0aGlzLmVtaXQoJ2NhbmNlbCcpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMudmFsaWRhdGVDaGFuZ2VzKG9wdHMpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy52YWxpZGF0ZUNoYW5nZXMob3B0cyk7XG4gICAgfVxuICB9XG5cbiAgY2FuY2VsKCkge1xuICAgIHRoaXMuaXNDYW5jZWxsZWQgPSB0cnVlO1xuICAgIGlmICh0aGlzLmRiLnRhc2txdWV1ZS5pc1JlYWR5KSB7XG4gICAgICB0aGlzLmVtaXQoJ2NhbmNlbCcpO1xuICAgIH1cbiAgfVxuXG4gIHZhbGlkYXRlQ2hhbmdlcyhvcHRzKSB7XG4gICAgdmFyIGNhbGxiYWNrID0gb3B0cy5jb21wbGV0ZTtcbiAgXG4gICAgLyogaXN0YW5idWwgaWdub3JlIGVsc2UgKi9cbiAgICBpZiAoUG91Y2hEQi5fY2hhbmdlc0ZpbHRlclBsdWdpbikge1xuICAgICAgUG91Y2hEQi5fY2hhbmdlc0ZpbHRlclBsdWdpbi52YWxpZGF0ZShvcHRzLCAoZXJyKSA9PiB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmRvQ2hhbmdlcyhvcHRzKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRvQ2hhbmdlcyhvcHRzKTtcbiAgICB9XG4gIH1cblxuICBkb0NoYW5nZXMob3B0cykge1xuICAgIHZhciBjYWxsYmFjayA9IG9wdHMuY29tcGxldGU7XG4gIFxuICAgIG9wdHMgPSBjbG9uZShvcHRzKTtcbiAgICBpZiAoJ2xpdmUnIGluIG9wdHMgJiYgISgnY29udGludW91cycgaW4gb3B0cykpIHtcbiAgICAgIG9wdHMuY29udGludW91cyA9IG9wdHMubGl2ZTtcbiAgICB9XG4gICAgb3B0cy5wcm9jZXNzQ2hhbmdlID0gcHJvY2Vzc0NoYW5nZTtcbiAgXG4gICAgaWYgKG9wdHMuc2luY2UgPT09ICdsYXRlc3QnKSB7XG4gICAgICBvcHRzLnNpbmNlID0gJ25vdyc7XG4gICAgfVxuICAgIGlmICghb3B0cy5zaW5jZSkge1xuICAgICAgb3B0cy5zaW5jZSA9IDA7XG4gICAgfVxuICAgIGlmIChvcHRzLnNpbmNlID09PSAnbm93Jykge1xuICAgICAgdGhpcy5kYi5pbmZvKCkudGhlbigoaW5mbykgPT4ge1xuICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICAgICAgaWYgKHRoaXMuaXNDYW5jZWxsZWQpIHtcbiAgICAgICAgICBjYWxsYmFjayhudWxsLCB7c3RhdHVzOiAnY2FuY2VsbGVkJ30pO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBvcHRzLnNpbmNlID0gaW5mby51cGRhdGVfc2VxO1xuICAgICAgICB0aGlzLmRvQ2hhbmdlcyhvcHRzKTtcbiAgICAgIH0sIGNhbGxiYWNrKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gIFxuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBlbHNlICovXG4gICAgaWYgKFBvdWNoREIuX2NoYW5nZXNGaWx0ZXJQbHVnaW4pIHtcbiAgICAgIFBvdWNoREIuX2NoYW5nZXNGaWx0ZXJQbHVnaW4ubm9ybWFsaXplKG9wdHMpO1xuICAgICAgaWYgKFBvdWNoREIuX2NoYW5nZXNGaWx0ZXJQbHVnaW4uc2hvdWxkRmlsdGVyKHRoaXMsIG9wdHMpKSB7XG4gICAgICAgIHJldHVybiBQb3VjaERCLl9jaGFuZ2VzRmlsdGVyUGx1Z2luLmZpbHRlcih0aGlzLCBvcHRzKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgWydkb2NfaWRzJywgJ2ZpbHRlcicsICdzZWxlY3RvcicsICd2aWV3J10uZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgIGlmIChrZXkgaW4gb3B0cykge1xuICAgICAgICAgIGd1YXJkZWRDb25zb2xlKCd3YXJuJyxcbiAgICAgICAgICAgICdUaGUgXCInICsga2V5ICsgJ1wiIG9wdGlvbiB3YXMgcGFzc2VkIGluIHRvIGNoYW5nZXMvcmVwbGljYXRlLCAnICtcbiAgICAgICAgICAgICdidXQgcG91Y2hkYi1jaGFuZ2VzLWZpbHRlciBwbHVnaW4gaXMgbm90IGluc3RhbGxlZCwgc28gaXQgJyArXG4gICAgICAgICAgICAnd2FzIGlnbm9yZWQuIFBsZWFzZSBpbnN0YWxsIHRoZSBwbHVnaW4gdG8gZW5hYmxlIGZpbHRlcmluZy4nXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICBcbiAgICBpZiAoISgnZGVzY2VuZGluZycgaW4gb3B0cykpIHtcbiAgICAgIG9wdHMuZGVzY2VuZGluZyA9IGZhbHNlO1xuICAgIH1cbiAgXG4gICAgLy8gMCBhbmQgMSBzaG91bGQgcmV0dXJuIDEgZG9jdW1lbnRcbiAgICBvcHRzLmxpbWl0ID0gb3B0cy5saW1pdCA9PT0gMCA/IDEgOiBvcHRzLmxpbWl0O1xuICAgIG9wdHMuY29tcGxldGUgPSBjYWxsYmFjaztcbiAgICB2YXIgbmV3UHJvbWlzZSA9IHRoaXMuZGIuX2NoYW5nZXMob3B0cyk7XG4gICAgLyogaXN0YW5idWwgaWdub3JlIGVsc2UgKi9cbiAgICBpZiAobmV3UHJvbWlzZSAmJiB0eXBlb2YgbmV3UHJvbWlzZS5jYW5jZWwgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNvbnN0IGNhbmNlbCA9IHRoaXMuY2FuY2VsO1xuICAgICAgdGhpcy5jYW5jZWwgPSAoLi4uYXJncykgPT4ge1xuICAgICAgICBuZXdQcm9taXNlLmNhbmNlbCgpO1xuICAgICAgICBjYW5jZWwuYXBwbHkodGhpcywgYXJncyk7XG4gICAgICB9O1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBDaGFuZ2VzO1xuIiwiaW1wb3J0IHsgcmV2LCBndWFyZGVkQ29uc29sZSwgaXNSZW1vdGUgfSBmcm9tICdwb3VjaGRiLXV0aWxzJztcbmltcG9ydCBFdmVudEVtaXR0ZXIgZnJvbSAnZXZlbnRzJztcbmltcG9ydCBDaGFuZ2VzIGZyb20gJy4vY2hhbmdlcyc7XG5pbXBvcnQge1xuICBwaWNrLFxuICBhZGFwdGVyRnVuLFxuICB1cHNlcnQsXG4gIGJ1bGtHZXRTaGltLFxuICBpbnZhbGlkSWRFcnJvcixcbiAgbmV4dFRpY2ssXG4gIGNsb25lXG59IGZyb20gJ3BvdWNoZGItdXRpbHMnO1xuaW1wb3J0IHtcbiAgdHJhdmVyc2VSZXZUcmVlLFxuICBjb2xsZWN0TGVhdmVzLFxuICByb290VG9MZWFmLFxuICBjb2xsZWN0Q29uZmxpY3RzLFxuICBpc0RlbGV0ZWQsXG4gIGlzTG9jYWxJZCxcbiAgZmluZFBhdGhUb0xlYWZcbn0gZnJvbSAncG91Y2hkYi1tZXJnZSc7XG5pbXBvcnQge1xuICBNSVNTSU5HX0JVTEtfRE9DUyxcbiAgTUlTU0lOR19ET0MsXG4gIFJFVl9DT05GTElDVCxcbiAgSU5WQUxJRF9JRCxcbiAgVU5LTk9XTl9FUlJPUixcbiAgUVVFUllfUEFSU0VfRVJST1IsXG4gIEJBRF9SRVFVRVNULFxuICBOT1RfQU5fT0JKRUNULFxuICBJTlZBTElEX1JFVixcbiAgY3JlYXRlRXJyb3Jcbn0gZnJvbSAncG91Y2hkYi1lcnJvcnMnO1xuXG4vKlxuICogQSBnZW5lcmljIHBvdWNoIGFkYXB0ZXJcbiAqL1xuXG5mdW5jdGlvbiBjb21wYXJlKGxlZnQsIHJpZ2h0KSB7XG4gIHJldHVybiBsZWZ0IDwgcmlnaHQgPyAtMSA6IGxlZnQgPiByaWdodCA/IDEgOiAwO1xufVxuXG4vLyBXcmFwcGVyIGZvciBmdW5jdGlvbnMgdGhhdCBjYWxsIHRoZSBidWxrZG9jcyBhcGkgd2l0aCBhIHNpbmdsZSBkb2MsXG4vLyBpZiB0aGUgZmlyc3QgcmVzdWx0IGlzIGFuIGVycm9yLCByZXR1cm4gYW4gZXJyb3JcbmZ1bmN0aW9uIHlhbmtFcnJvcihjYWxsYmFjaywgZG9jSWQpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIChlcnIsIHJlc3VsdHMpIHtcbiAgICBpZiAoZXJyIHx8IChyZXN1bHRzWzBdICYmIHJlc3VsdHNbMF0uZXJyb3IpKSB7XG4gICAgICBlcnIgPSBlcnIgfHwgcmVzdWx0c1swXTtcbiAgICAgIGVyci5kb2NJZCA9IGRvY0lkO1xuICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0cy5sZW5ndGggPyByZXN1bHRzWzBdICA6IHJlc3VsdHMpO1xuICAgIH1cbiAgfTtcbn1cblxuLy8gY2xlYW4gZG9jcyBnaXZlbiB0byB1cyBieSB0aGUgdXNlclxuZnVuY3Rpb24gY2xlYW5Eb2NzKGRvY3MpIHtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBkb2NzLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGRvYyA9IGRvY3NbaV07XG4gICAgaWYgKGRvYy5fZGVsZXRlZCkge1xuICAgICAgZGVsZXRlIGRvYy5fYXR0YWNobWVudHM7IC8vIGlnbm9yZSBhdHRzIGZvciBkZWxldGVkIGRvY3NcbiAgICB9IGVsc2UgaWYgKGRvYy5fYXR0YWNobWVudHMpIHtcbiAgICAgIC8vIGZpbHRlciBvdXQgZXh0cmFuZW91cyBrZXlzIGZyb20gX2F0dGFjaG1lbnRzXG4gICAgICB2YXIgYXR0cyA9IE9iamVjdC5rZXlzKGRvYy5fYXR0YWNobWVudHMpO1xuICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBhdHRzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgIHZhciBhdHQgPSBhdHRzW2pdO1xuICAgICAgICBkb2MuX2F0dGFjaG1lbnRzW2F0dF0gPSBwaWNrKGRvYy5fYXR0YWNobWVudHNbYXR0XSxcbiAgICAgICAgICBbJ2RhdGEnLCAnZGlnZXN0JywgJ2NvbnRlbnRfdHlwZScsICdsZW5ndGgnLCAncmV2cG9zJywgJ3N0dWInXSk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8vIGNvbXBhcmUgdHdvIGRvY3MsIGZpcnN0IGJ5IF9pZCB0aGVuIGJ5IF9yZXZcbmZ1bmN0aW9uIGNvbXBhcmVCeUlkVGhlblJldihhLCBiKSB7XG4gIHZhciBpZENvbXBhcmUgPSBjb21wYXJlKGEuX2lkLCBiLl9pZCk7XG4gIGlmIChpZENvbXBhcmUgIT09IDApIHtcbiAgICByZXR1cm4gaWRDb21wYXJlO1xuICB9XG4gIHZhciBhU3RhcnQgPSBhLl9yZXZpc2lvbnMgPyBhLl9yZXZpc2lvbnMuc3RhcnQgOiAwO1xuICB2YXIgYlN0YXJ0ID0gYi5fcmV2aXNpb25zID8gYi5fcmV2aXNpb25zLnN0YXJ0IDogMDtcbiAgcmV0dXJuIGNvbXBhcmUoYVN0YXJ0LCBiU3RhcnQpO1xufVxuXG4vLyBmb3IgZXZlcnkgbm9kZSBpbiBhIHJldmlzaW9uIHRyZWUgY29tcHV0ZXMgaXRzIGRpc3RhbmNlIGZyb20gdGhlIGNsb3Nlc3Rcbi8vIGxlYWZcbmZ1bmN0aW9uIGNvbXB1dGVIZWlnaHQocmV2cykge1xuICB2YXIgaGVpZ2h0ID0ge307XG4gIHZhciBlZGdlcyA9IFtdO1xuICB0cmF2ZXJzZVJldlRyZWUocmV2cywgZnVuY3Rpb24gKGlzTGVhZiwgcG9zLCBpZCwgcHJudCkge1xuICAgIHZhciByZXYgPSBwb3MgKyBcIi1cIiArIGlkO1xuICAgIGlmIChpc0xlYWYpIHtcbiAgICAgIGhlaWdodFtyZXZdID0gMDtcbiAgICB9XG4gICAgaWYgKHBybnQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgZWRnZXMucHVzaCh7ZnJvbTogcHJudCwgdG86IHJldn0pO1xuICAgIH1cbiAgICByZXR1cm4gcmV2O1xuICB9KTtcblxuICBlZGdlcy5yZXZlcnNlKCk7XG4gIGVkZ2VzLmZvckVhY2goZnVuY3Rpb24gKGVkZ2UpIHtcbiAgICBpZiAoaGVpZ2h0W2VkZ2UuZnJvbV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgaGVpZ2h0W2VkZ2UuZnJvbV0gPSAxICsgaGVpZ2h0W2VkZ2UudG9dO1xuICAgIH0gZWxzZSB7XG4gICAgICBoZWlnaHRbZWRnZS5mcm9tXSA9IE1hdGgubWluKGhlaWdodFtlZGdlLmZyb21dLCAxICsgaGVpZ2h0W2VkZ2UudG9dKTtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gaGVpZ2h0O1xufVxuXG5mdW5jdGlvbiBhbGxEb2NzS2V5c1BhcnNlKG9wdHMpIHtcbiAgdmFyIGtleXMgPSAgKCdsaW1pdCcgaW4gb3B0cykgP1xuICAgIG9wdHMua2V5cy5zbGljZShvcHRzLnNraXAsIG9wdHMubGltaXQgKyBvcHRzLnNraXApIDpcbiAgICAob3B0cy5za2lwID4gMCkgPyBvcHRzLmtleXMuc2xpY2Uob3B0cy5za2lwKSA6IG9wdHMua2V5cztcbiAgb3B0cy5rZXlzID0ga2V5cztcbiAgb3B0cy5za2lwID0gMDtcbiAgZGVsZXRlIG9wdHMubGltaXQ7XG4gIGlmIChvcHRzLmRlc2NlbmRpbmcpIHtcbiAgICBrZXlzLnJldmVyc2UoKTtcbiAgICBvcHRzLmRlc2NlbmRpbmcgPSBmYWxzZTtcbiAgfVxufVxuXG4vLyBhbGwgY29tcGFjdGlvbiBpcyBkb25lIGluIGEgcXVldWUsIHRvIGF2b2lkIGF0dGFjaGluZ1xuLy8gdG9vIG1hbnkgbGlzdGVuZXJzIGF0IG9uY2VcbmZ1bmN0aW9uIGRvTmV4dENvbXBhY3Rpb24oc2VsZikge1xuICB2YXIgdGFzayA9IHNlbGYuX2NvbXBhY3Rpb25RdWV1ZVswXTtcbiAgdmFyIG9wdHMgPSB0YXNrLm9wdHM7XG4gIHZhciBjYWxsYmFjayA9IHRhc2suY2FsbGJhY2s7XG4gIHNlbGYuZ2V0KCdfbG9jYWwvY29tcGFjdGlvbicpLmNhdGNoKGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH0pLnRoZW4oZnVuY3Rpb24gKGRvYykge1xuICAgIGlmIChkb2MgJiYgZG9jLmxhc3Rfc2VxKSB7XG4gICAgICBvcHRzLmxhc3Rfc2VxID0gZG9jLmxhc3Rfc2VxO1xuICAgIH1cbiAgICBzZWxmLl9jb21wYWN0KG9wdHMsIGZ1bmN0aW9uIChlcnIsIHJlcykge1xuICAgICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjYWxsYmFjayhudWxsLCByZXMpO1xuICAgICAgfVxuICAgICAgbmV4dFRpY2soZnVuY3Rpb24gKCkge1xuICAgICAgICBzZWxmLl9jb21wYWN0aW9uUXVldWUuc2hpZnQoKTtcbiAgICAgICAgaWYgKHNlbGYuX2NvbXBhY3Rpb25RdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgICBkb05leHRDb21wYWN0aW9uKHNlbGYpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGFwcGVuZFB1cmdlU2VxKGRiLCBkb2NJZCwgcmV2KSB7XG4gIHJldHVybiBkYi5nZXQoJ19sb2NhbC9wdXJnZXMnKS50aGVuKGZ1bmN0aW9uIChkb2MpIHtcbiAgICBjb25zdCBwdXJnZVNlcSA9IGRvYy5wdXJnZVNlcSArIDE7XG4gICAgZG9jLnB1cmdlcy5wdXNoKHtcbiAgICAgIGRvY0lkLFxuICAgICAgcmV2LFxuICAgICAgcHVyZ2VTZXEsXG4gICAgfSk7XG4gICAgaWYgKGRvYy5wdXJnZXMubGVuZ3RoID4gc2VsZi5wdXJnZWRfaW5mb3NfbGltaXQpIHtcbiAgICAgIGRvYy5wdXJnZXMuc3BsaWNlKDAsIGRvYy5wdXJnZXMubGVuZ3RoIC0gc2VsZi5wdXJnZWRfaW5mb3NfbGltaXQpO1xuICAgIH1cbiAgICBkb2MucHVyZ2VTZXEgPSBwdXJnZVNlcTtcbiAgICByZXR1cm4gZG9jO1xuICB9KS5jYXRjaChmdW5jdGlvbiAoZXJyKSB7XG4gICAgaWYgKGVyci5zdGF0dXMgIT09IDQwNCkge1xuICAgICAgdGhyb3cgZXJyO1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgX2lkOiAnX2xvY2FsL3B1cmdlcycsXG4gICAgICBwdXJnZXM6IFt7XG4gICAgICAgIGRvY0lkLFxuICAgICAgICByZXYsXG4gICAgICAgIHB1cmdlU2VxOiAwLFxuICAgICAgfV0sXG4gICAgICBwdXJnZVNlcTogMCxcbiAgICB9O1xuICB9KS50aGVuKGZ1bmN0aW9uIChkb2MpIHtcbiAgICByZXR1cm4gZGIucHV0KGRvYyk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBhdHRhY2htZW50TmFtZUVycm9yKG5hbWUpIHtcbiAgaWYgKG5hbWUuY2hhckF0KDApID09PSAnXycpIHtcbiAgICByZXR1cm4gbmFtZSArICcgaXMgbm90IGEgdmFsaWQgYXR0YWNobWVudCBuYW1lLCBhdHRhY2htZW50ICcgK1xuICAgICAgJ25hbWVzIGNhbm5vdCBzdGFydCB3aXRoIFxcJ19cXCcnO1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxuY2xhc3MgQWJzdHJhY3RQb3VjaERCIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcbiAgX3NldHVwKCkge1xuICAgIHRoaXMucG9zdCA9IGFkYXB0ZXJGdW4oJ3Bvc3QnLCBmdW5jdGlvbiAoZG9jLCBvcHRzLCBjYWxsYmFjaykge1xuICAgICAgaWYgKHR5cGVvZiBvcHRzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGNhbGxiYWNrID0gb3B0cztcbiAgICAgICAgb3B0cyA9IHt9O1xuICAgICAgfVxuICAgICAgaWYgKHR5cGVvZiBkb2MgIT09ICdvYmplY3QnIHx8IEFycmF5LmlzQXJyYXkoZG9jKSkge1xuICAgICAgICByZXR1cm4gY2FsbGJhY2soY3JlYXRlRXJyb3IoTk9UX0FOX09CSkVDVCkpO1xuICAgICAgfVxuICAgICAgdGhpcy5idWxrRG9jcyh7ZG9jczogW2RvY119LCBvcHRzLCB5YW5rRXJyb3IoY2FsbGJhY2ssIGRvYy5faWQpKTtcbiAgICB9KS5iaW5kKHRoaXMpO1xuXG4gICAgdGhpcy5wdXQgPSBhZGFwdGVyRnVuKCdwdXQnLCBmdW5jdGlvbiAoZG9jLCBvcHRzLCBjYikge1xuICAgICAgaWYgKHR5cGVvZiBvcHRzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGNiID0gb3B0cztcbiAgICAgICAgb3B0cyA9IHt9O1xuICAgICAgfVxuICAgICAgaWYgKHR5cGVvZiBkb2MgIT09ICdvYmplY3QnIHx8IEFycmF5LmlzQXJyYXkoZG9jKSkge1xuICAgICAgICByZXR1cm4gY2IoY3JlYXRlRXJyb3IoTk9UX0FOX09CSkVDVCkpO1xuICAgICAgfVxuICAgICAgaW52YWxpZElkRXJyb3IoZG9jLl9pZCk7XG4gICAgICBpZiAoaXNMb2NhbElkKGRvYy5faWQpICYmIHR5cGVvZiB0aGlzLl9wdXRMb2NhbCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBpZiAoZG9jLl9kZWxldGVkKSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuX3JlbW92ZUxvY2FsKGRvYywgY2IpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiB0aGlzLl9wdXRMb2NhbChkb2MsIGNiKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBjb25zdCBwdXREb2MgPSAobmV4dCkgPT4ge1xuICAgICAgICBpZiAodHlwZW9mIHRoaXMuX3B1dCA9PT0gJ2Z1bmN0aW9uJyAmJiBvcHRzLm5ld19lZGl0cyAhPT0gZmFsc2UpIHtcbiAgICAgICAgICB0aGlzLl9wdXQoZG9jLCBvcHRzLCBuZXh0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLmJ1bGtEb2NzKHtkb2NzOiBbZG9jXX0sIG9wdHMsIHlhbmtFcnJvcihuZXh0LCBkb2MuX2lkKSk7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIGlmIChvcHRzLmZvcmNlICYmIGRvYy5fcmV2KSB7XG4gICAgICAgIHRyYW5zZm9ybUZvcmNlT3B0aW9uVG9OZXdFZGl0c09wdGlvbigpO1xuICAgICAgICBwdXREb2MoZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgIHZhciByZXN1bHQgPSBlcnIgPyBudWxsIDoge29rOiB0cnVlLCBpZDogZG9jLl9pZCwgcmV2OiBkb2MuX3Jldn07XG4gICAgICAgICAgY2IoZXJyLCByZXN1bHQpO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHB1dERvYyhjYik7XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIHRyYW5zZm9ybUZvcmNlT3B0aW9uVG9OZXdFZGl0c09wdGlvbigpIHtcbiAgICAgICAgdmFyIHBhcnRzID0gZG9jLl9yZXYuc3BsaXQoJy0nKTtcbiAgICAgICAgdmFyIG9sZFJldklkID0gcGFydHNbMV07XG4gICAgICAgIHZhciBvbGRSZXZOdW0gPSBwYXJzZUludChwYXJ0c1swXSwgMTApO1xuXG4gICAgICAgIHZhciBuZXdSZXZOdW0gPSBvbGRSZXZOdW0gKyAxO1xuICAgICAgICB2YXIgbmV3UmV2SWQgPSByZXYoKTtcblxuICAgICAgICBkb2MuX3JldmlzaW9ucyA9IHtcbiAgICAgICAgICBzdGFydDogbmV3UmV2TnVtLFxuICAgICAgICAgIGlkczogW25ld1JldklkLCBvbGRSZXZJZF1cbiAgICAgICAgfTtcbiAgICAgICAgZG9jLl9yZXYgPSBuZXdSZXZOdW0gKyAnLScgKyBuZXdSZXZJZDtcbiAgICAgICAgb3B0cy5uZXdfZWRpdHMgPSBmYWxzZTtcbiAgICAgIH1cbiAgICB9KS5iaW5kKHRoaXMpO1xuXG4gICAgdGhpcy5wdXRBdHRhY2htZW50ID0gYWRhcHRlckZ1bigncHV0QXR0YWNobWVudCcsIGZ1bmN0aW9uIChkb2NJZCwgYXR0YWNobWVudElkLCByZXYsIGJsb2IsIHR5cGUpIHtcbiAgICAgIHZhciBhcGkgPSB0aGlzO1xuICAgICAgaWYgKHR5cGVvZiB0eXBlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHR5cGUgPSBibG9iO1xuICAgICAgICBibG9iID0gcmV2O1xuICAgICAgICByZXYgPSBudWxsO1xuICAgICAgfVxuICAgICAgLy8gTGV0cyBmaXggaW4gaHR0cHM6Ly9naXRodWIuY29tL3BvdWNoZGIvcG91Y2hkYi9pc3N1ZXMvMzI2N1xuICAgICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgICBpZiAodHlwZW9mIHR5cGUgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHR5cGUgPSBibG9iO1xuICAgICAgICBibG9iID0gcmV2O1xuICAgICAgICByZXYgPSBudWxsO1xuICAgICAgfVxuICAgICAgaWYgKCF0eXBlKSB7XG4gICAgICAgIGd1YXJkZWRDb25zb2xlKCd3YXJuJywgJ0F0dGFjaG1lbnQnLCBhdHRhY2htZW50SWQsICdvbiBkb2N1bWVudCcsIGRvY0lkLCAnaXMgbWlzc2luZyBjb250ZW50X3R5cGUnKTtcbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gY3JlYXRlQXR0YWNobWVudChkb2MpIHtcbiAgICAgICAgdmFyIHByZXZyZXZwb3MgPSAnX3JldicgaW4gZG9jID8gcGFyc2VJbnQoZG9jLl9yZXYsIDEwKSA6IDA7XG4gICAgICAgIGRvYy5fYXR0YWNobWVudHMgPSBkb2MuX2F0dGFjaG1lbnRzIHx8IHt9O1xuICAgICAgICBkb2MuX2F0dGFjaG1lbnRzW2F0dGFjaG1lbnRJZF0gPSB7XG4gICAgICAgICAgY29udGVudF90eXBlOiB0eXBlLFxuICAgICAgICAgIGRhdGE6IGJsb2IsXG4gICAgICAgICAgcmV2cG9zOiArK3ByZXZyZXZwb3NcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIGFwaS5wdXQoZG9jKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGFwaS5nZXQoZG9jSWQpLnRoZW4oZnVuY3Rpb24gKGRvYykge1xuICAgICAgICBpZiAoZG9jLl9yZXYgIT09IHJldikge1xuICAgICAgICAgIHRocm93IGNyZWF0ZUVycm9yKFJFVl9DT05GTElDVCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY3JlYXRlQXR0YWNobWVudChkb2MpO1xuICAgICAgfSwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAvLyBjcmVhdGUgbmV3IGRvY1xuICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgZWxzZSAqL1xuICAgICAgICBpZiAoZXJyLnJlYXNvbiA9PT0gTUlTU0lOR19ET0MubWVzc2FnZSkge1xuICAgICAgICAgIHJldHVybiBjcmVhdGVBdHRhY2htZW50KHtfaWQ6IGRvY0lkfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KS5iaW5kKHRoaXMpO1xuXG4gICAgdGhpcy5yZW1vdmVBdHRhY2htZW50ID0gYWRhcHRlckZ1bigncmVtb3ZlQXR0YWNobWVudCcsIGZ1bmN0aW9uIChkb2NJZCwgYXR0YWNobWVudElkLCByZXYsIGNhbGxiYWNrKSB7XG4gICAgICB0aGlzLmdldChkb2NJZCwgKGVyciwgb2JqKSA9PiB7XG4gICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9iai5fcmV2ICE9PSByZXYpIHtcbiAgICAgICAgICBjYWxsYmFjayhjcmVhdGVFcnJvcihSRVZfQ09ORkxJQ1QpKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgICAgIGlmICghb2JqLl9hdHRhY2htZW50cykge1xuICAgICAgICAgIHJldHVybiBjYWxsYmFjaygpO1xuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZSBvYmouX2F0dGFjaG1lbnRzW2F0dGFjaG1lbnRJZF07XG4gICAgICAgIGlmIChPYmplY3Qua2V5cyhvYmouX2F0dGFjaG1lbnRzKS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICBkZWxldGUgb2JqLl9hdHRhY2htZW50cztcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnB1dChvYmosIGNhbGxiYWNrKTtcbiAgICAgIH0pO1xuICAgIH0pLmJpbmQodGhpcyk7XG5cbiAgICB0aGlzLnJlbW92ZSA9IGFkYXB0ZXJGdW4oJ3JlbW92ZScsIGZ1bmN0aW9uIChkb2NPcklkLCBvcHRzT3JSZXYsIG9wdHMsIGNhbGxiYWNrKSB7XG4gICAgICB2YXIgZG9jO1xuICAgICAgaWYgKHR5cGVvZiBvcHRzT3JSZXYgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIC8vIGlkLCByZXYsIG9wdHMsIGNhbGxiYWNrIHN0eWxlXG4gICAgICAgIGRvYyA9IHtcbiAgICAgICAgICBfaWQ6IGRvY09ySWQsXG4gICAgICAgICAgX3Jldjogb3B0c09yUmV2XG4gICAgICAgIH07XG4gICAgICAgIGlmICh0eXBlb2Ygb3B0cyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIGNhbGxiYWNrID0gb3B0cztcbiAgICAgICAgICBvcHRzID0ge307XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGRvYywgb3B0cywgY2FsbGJhY2sgc3R5bGVcbiAgICAgICAgZG9jID0gZG9jT3JJZDtcbiAgICAgICAgaWYgKHR5cGVvZiBvcHRzT3JSZXYgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICBjYWxsYmFjayA9IG9wdHNPclJldjtcbiAgICAgICAgICBvcHRzID0ge307XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY2FsbGJhY2sgPSBvcHRzO1xuICAgICAgICAgIG9wdHMgPSBvcHRzT3JSZXY7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuICAgICAgb3B0cy53YXNfZGVsZXRlID0gdHJ1ZTtcbiAgICAgIHZhciBuZXdEb2MgPSB7X2lkOiBkb2MuX2lkLCBfcmV2OiAoZG9jLl9yZXYgfHwgb3B0cy5yZXYpfTtcbiAgICAgIG5ld0RvYy5fZGVsZXRlZCA9IHRydWU7XG4gICAgICBpZiAoaXNMb2NhbElkKG5ld0RvYy5faWQpICYmIHR5cGVvZiB0aGlzLl9yZW1vdmVMb2NhbCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICByZXR1cm4gdGhpcy5fcmVtb3ZlTG9jYWwoZG9jLCBjYWxsYmFjayk7XG4gICAgICB9XG4gICAgICB0aGlzLmJ1bGtEb2NzKHtkb2NzOiBbbmV3RG9jXX0sIG9wdHMsIHlhbmtFcnJvcihjYWxsYmFjaywgbmV3RG9jLl9pZCkpO1xuICAgIH0pLmJpbmQodGhpcyk7XG5cbiAgICB0aGlzLnJldnNEaWZmID0gYWRhcHRlckZ1bigncmV2c0RpZmYnLCBmdW5jdGlvbiAocmVxLCBvcHRzLCBjYWxsYmFjaykge1xuICAgICAgaWYgKHR5cGVvZiBvcHRzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGNhbGxiYWNrID0gb3B0cztcbiAgICAgICAgb3B0cyA9IHt9O1xuICAgICAgfVxuICAgICAgdmFyIGlkcyA9IE9iamVjdC5rZXlzKHJlcSk7XG5cbiAgICAgIGlmICghaWRzLmxlbmd0aCkge1xuICAgICAgICByZXR1cm4gY2FsbGJhY2sobnVsbCwge30pO1xuICAgICAgfVxuXG4gICAgICB2YXIgY291bnQgPSAwO1xuICAgICAgdmFyIG1pc3NpbmcgPSBuZXcgTWFwKCk7XG5cbiAgICAgIGZ1bmN0aW9uIGFkZFRvTWlzc2luZyhpZCwgcmV2SWQpIHtcbiAgICAgICAgaWYgKCFtaXNzaW5nLmhhcyhpZCkpIHtcbiAgICAgICAgICBtaXNzaW5nLnNldChpZCwge21pc3Npbmc6IFtdfSk7XG4gICAgICAgIH1cbiAgICAgICAgbWlzc2luZy5nZXQoaWQpLm1pc3NpbmcucHVzaChyZXZJZCk7XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIHByb2Nlc3NEb2MoaWQsIHJldl90cmVlKSB7XG4gICAgICAgIC8vIElzIHRoaXMgZmFzdCBlbm91Z2g/IE1heWJlIHdlIHNob3VsZCBzd2l0Y2ggdG8gYSBzZXQgc2ltdWxhdGVkIGJ5IGEgbWFwXG4gICAgICAgIHZhciBtaXNzaW5nRm9ySWQgPSByZXFbaWRdLnNsaWNlKDApO1xuICAgICAgICB0cmF2ZXJzZVJldlRyZWUocmV2X3RyZWUsIGZ1bmN0aW9uIChpc0xlYWYsIHBvcywgcmV2SGFzaCwgY3R4LFxuICAgICAgICAgIG9wdHMpIHtcbiAgICAgICAgICAgIHZhciByZXYgPSBwb3MgKyAnLScgKyByZXZIYXNoO1xuICAgICAgICAgICAgdmFyIGlkeCA9IG1pc3NpbmdGb3JJZC5pbmRleE9mKHJldik7XG4gICAgICAgICAgICBpZiAoaWR4ID09PSAtMSkge1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG1pc3NpbmdGb3JJZC5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgICAgICAgICAgaWYgKG9wdHMuc3RhdHVzICE9PSAnYXZhaWxhYmxlJykge1xuICAgICAgICAgICAgICBhZGRUb01pc3NpbmcoaWQsIHJldik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gVHJhdmVyc2luZyB0aGUgdHJlZSBpcyBzeW5jaHJvbm91cywgc28gbm93IGBtaXNzaW5nRm9ySWRgIGNvbnRhaW5zXG4gICAgICAgIC8vIHJldmlzaW9ucyB0aGF0IHdlcmUgbm90IGZvdW5kIGluIHRoZSB0cmVlXG4gICAgICAgIG1pc3NpbmdGb3JJZC5mb3JFYWNoKGZ1bmN0aW9uIChyZXYpIHtcbiAgICAgICAgICBhZGRUb01pc3NpbmcoaWQsIHJldik7XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICBpZHMubWFwKGZ1bmN0aW9uIChpZCkge1xuICAgICAgICB0aGlzLl9nZXRSZXZpc2lvblRyZWUoaWQsIGZ1bmN0aW9uIChlcnIsIHJldl90cmVlKSB7XG4gICAgICAgICAgaWYgKGVyciAmJiBlcnIuc3RhdHVzID09PSA0MDQgJiYgZXJyLm1lc3NhZ2UgPT09ICdtaXNzaW5nJykge1xuICAgICAgICAgICAgbWlzc2luZy5zZXQoaWQsIHttaXNzaW5nOiByZXFbaWRdfSk7XG4gICAgICAgICAgfSBlbHNlIGlmIChlcnIpIHtcbiAgICAgICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcHJvY2Vzc0RvYyhpZCwgcmV2X3RyZWUpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmICgrK2NvdW50ID09PSBpZHMubGVuZ3RoKSB7XG4gICAgICAgICAgICAvLyBjb252ZXJ0IExhenlNYXAgdG8gb2JqZWN0XG4gICAgICAgICAgICB2YXIgbWlzc2luZ09iaiA9IHt9O1xuICAgICAgICAgICAgbWlzc2luZy5mb3JFYWNoKGZ1bmN0aW9uICh2YWx1ZSwga2V5KSB7XG4gICAgICAgICAgICAgIG1pc3NpbmdPYmpba2V5XSA9IHZhbHVlO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2sobnVsbCwgbWlzc2luZ09iaik7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0sIHRoaXMpO1xuICAgIH0pLmJpbmQodGhpcyk7XG5cbiAgICAvLyBfYnVsa19nZXQgQVBJIGZvciBmYXN0ZXIgcmVwbGljYXRpb24sIGFzIGRlc2NyaWJlZCBpblxuICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9hcGFjaGUvY291Y2hkYi1jaHR0cGQvcHVsbC8zM1xuICAgIC8vIEF0IHRoZSBcImFic3RyYWN0XCIgbGV2ZWwsIGl0IHdpbGwganVzdCBydW4gbXVsdGlwbGUgZ2V0KClzIGluXG4gICAgLy8gcGFyYWxsZWwsIGJlY2F1c2UgdGhpcyBpc24ndCBtdWNoIG9mIGEgcGVyZm9ybWFuY2UgY29zdFxuICAgIC8vIGZvciBsb2NhbCBkYXRhYmFzZXMgKGV4Y2VwdCB0aGUgY29zdCBvZiBtdWx0aXBsZSB0cmFuc2FjdGlvbnMsIHdoaWNoIGlzXG4gICAgLy8gc21hbGwpLiBUaGUgaHR0cCBhZGFwdGVyIG92ZXJyaWRlcyB0aGlzIGluIG9yZGVyXG4gICAgLy8gdG8gZG8gYSBtb3JlIGVmZmljaWVudCBzaW5nbGUgSFRUUCByZXF1ZXN0LlxuICAgIHRoaXMuYnVsa0dldCA9IGFkYXB0ZXJGdW4oJ2J1bGtHZXQnLCBmdW5jdGlvbiAob3B0cywgY2FsbGJhY2spIHtcbiAgICAgIGJ1bGtHZXRTaGltKHRoaXMsIG9wdHMsIGNhbGxiYWNrKTtcbiAgICB9KS5iaW5kKHRoaXMpO1xuXG4gICAgLy8gY29tcGFjdCBvbmUgZG9jdW1lbnQgYW5kIGZpcmUgY2FsbGJhY2tcbiAgICAvLyBieSBjb21wYWN0aW5nIHdlIG1lYW4gcmVtb3ZpbmcgYWxsIHJldmlzaW9ucyB3aGljaFxuICAgIC8vIGFyZSBmdXJ0aGVyIGZyb20gdGhlIGxlYWYgaW4gcmV2aXNpb24gdHJlZSB0aGFuIG1heF9oZWlnaHRcbiAgICB0aGlzLmNvbXBhY3REb2N1bWVudCA9IGFkYXB0ZXJGdW4oJ2NvbXBhY3REb2N1bWVudCcsIGZ1bmN0aW9uIChkb2NJZCwgbWF4SGVpZ2h0LCBjYWxsYmFjaykge1xuICAgICAgdGhpcy5fZ2V0UmV2aXNpb25UcmVlKGRvY0lkLCAoZXJyLCByZXZUcmVlKSA9PiB7XG4gICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGhlaWdodCA9IGNvbXB1dGVIZWlnaHQocmV2VHJlZSk7XG4gICAgICAgIHZhciBjYW5kaWRhdGVzID0gW107XG4gICAgICAgIHZhciByZXZzID0gW107XG4gICAgICAgIE9iamVjdC5rZXlzKGhlaWdodCkuZm9yRWFjaChmdW5jdGlvbiAocmV2KSB7XG4gICAgICAgICAgaWYgKGhlaWdodFtyZXZdID4gbWF4SGVpZ2h0KSB7XG4gICAgICAgICAgICBjYW5kaWRhdGVzLnB1c2gocmV2KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRyYXZlcnNlUmV2VHJlZShyZXZUcmVlLCBmdW5jdGlvbiAoaXNMZWFmLCBwb3MsIHJldkhhc2gsIGN0eCwgb3B0cykge1xuICAgICAgICAgIHZhciByZXYgPSBwb3MgKyAnLScgKyByZXZIYXNoO1xuICAgICAgICAgIGlmIChvcHRzLnN0YXR1cyA9PT0gJ2F2YWlsYWJsZScgJiYgY2FuZGlkYXRlcy5pbmRleE9mKHJldikgIT09IC0xKSB7XG4gICAgICAgICAgICByZXZzLnB1c2gocmV2KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLl9kb0NvbXBhY3Rpb24oZG9jSWQsIHJldnMsIGNhbGxiYWNrKTtcbiAgICAgIH0pO1xuICAgIH0pLmJpbmQodGhpcyk7XG5cbiAgICAvLyBjb21wYWN0IHRoZSB3aG9sZSBkYXRhYmFzZSB1c2luZyBzaW5nbGUgZG9jdW1lbnRcbiAgICAvLyBjb21wYWN0aW9uXG4gICAgdGhpcy5jb21wYWN0ID0gYWRhcHRlckZ1bignY29tcGFjdCcsIGZ1bmN0aW9uIChvcHRzLCBjYWxsYmFjaykge1xuICAgICAgaWYgKHR5cGVvZiBvcHRzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGNhbGxiYWNrID0gb3B0cztcbiAgICAgICAgb3B0cyA9IHt9O1xuICAgICAgfVxuXG4gICAgICBvcHRzID0gb3B0cyB8fCB7fTtcblxuICAgICAgdGhpcy5fY29tcGFjdGlvblF1ZXVlID0gdGhpcy5fY29tcGFjdGlvblF1ZXVlIHx8IFtdO1xuICAgICAgdGhpcy5fY29tcGFjdGlvblF1ZXVlLnB1c2goe29wdHM6IG9wdHMsIGNhbGxiYWNrOiBjYWxsYmFja30pO1xuICAgICAgaWYgKHRoaXMuX2NvbXBhY3Rpb25RdWV1ZS5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgZG9OZXh0Q29tcGFjdGlvbih0aGlzKTtcbiAgICAgIH1cbiAgICB9KS5iaW5kKHRoaXMpO1xuXG4gICAgLyogQmVnaW4gYXBpIHdyYXBwZXJzLiBTcGVjaWZpYyBmdW5jdGlvbmFsaXR5IHRvIHN0b3JhZ2UgYmVsb25ncyBpbiB0aGUgX1ttZXRob2RdICovXG4gICAgdGhpcy5nZXQgPSBhZGFwdGVyRnVuKCdnZXQnLCBmdW5jdGlvbiAoaWQsIG9wdHMsIGNiKSB7XG4gICAgICBpZiAodHlwZW9mIG9wdHMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgY2IgPSBvcHRzO1xuICAgICAgICBvcHRzID0ge307XG4gICAgICB9XG4gICAgICBpZiAodHlwZW9mIGlkICE9PSAnc3RyaW5nJykge1xuICAgICAgICByZXR1cm4gY2IoY3JlYXRlRXJyb3IoSU5WQUxJRF9JRCkpO1xuICAgICAgfVxuICAgICAgaWYgKGlzTG9jYWxJZChpZCkgJiYgdHlwZW9mIHRoaXMuX2dldExvY2FsID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9nZXRMb2NhbChpZCwgY2IpO1xuICAgICAgfVxuICAgICAgdmFyIGxlYXZlcyA9IFtdO1xuXG4gICAgICBjb25zdCBmaW5pc2hPcGVuUmV2cyA9ICgpID0+IHtcbiAgICAgICAgdmFyIHJlc3VsdCA9IFtdO1xuICAgICAgICB2YXIgY291bnQgPSBsZWF2ZXMubGVuZ3RoO1xuICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICAgICAgaWYgKCFjb3VudCkge1xuICAgICAgICAgIHJldHVybiBjYihudWxsLCByZXN1bHQpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gb3JkZXIgd2l0aCBvcGVuX3JldnMgaXMgdW5zcGVjaWZpZWRcbiAgICAgICAgbGVhdmVzLmZvckVhY2goKGxlYWYpID0+IHtcbiAgICAgICAgICB0aGlzLmdldChpZCwge1xuICAgICAgICAgICAgcmV2OiBsZWFmLFxuICAgICAgICAgICAgcmV2czogb3B0cy5yZXZzLFxuICAgICAgICAgICAgbGF0ZXN0OiBvcHRzLmxhdGVzdCxcbiAgICAgICAgICAgIGF0dGFjaG1lbnRzOiBvcHRzLmF0dGFjaG1lbnRzLFxuICAgICAgICAgICAgYmluYXJ5OiBvcHRzLmJpbmFyeVxuICAgICAgICAgIH0sIGZ1bmN0aW9uIChlcnIsIGRvYykge1xuICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgLy8gdXNpbmcgbGF0ZXN0PXRydWUgY2FuIHByb2R1Y2UgZHVwbGljYXRlc1xuICAgICAgICAgICAgICB2YXIgZXhpc3Rpbmc7XG4gICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gcmVzdWx0Lmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmIChyZXN1bHRbaV0ub2sgJiYgcmVzdWx0W2ldLm9rLl9yZXYgPT09IGRvYy5fcmV2KSB7XG4gICAgICAgICAgICAgICAgICBleGlzdGluZyA9IHRydWU7XG4gICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKCFleGlzdGluZykge1xuICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKHtvazogZG9jfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHJlc3VsdC5wdXNoKHttaXNzaW5nOiBsZWFmfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb3VudC0tO1xuICAgICAgICAgICAgaWYgKCFjb3VudCkge1xuICAgICAgICAgICAgICBjYihudWxsLCByZXN1bHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgIH07XG5cbiAgICAgIGlmIChvcHRzLm9wZW5fcmV2cykge1xuICAgICAgICBpZiAob3B0cy5vcGVuX3JldnMgPT09IFwiYWxsXCIpIHtcbiAgICAgICAgICB0aGlzLl9nZXRSZXZpc2lvblRyZWUoaWQsIGZ1bmN0aW9uIChlcnIsIHJldl90cmVlKSB7XG4gICAgICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGNiKGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZWF2ZXMgPSBjb2xsZWN0TGVhdmVzKHJldl90cmVlKS5tYXAoZnVuY3Rpb24gKGxlYWYpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGxlYWYucmV2O1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBmaW5pc2hPcGVuUmV2cygpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KG9wdHMub3Blbl9yZXZzKSkge1xuICAgICAgICAgICAgbGVhdmVzID0gb3B0cy5vcGVuX3JldnM7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlYXZlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICB2YXIgbCA9IGxlYXZlc1tpXTtcbiAgICAgICAgICAgICAgLy8gbG9va3MgbGlrZSBpdCdzIHRoZSBvbmx5IHRoaW5nIGNvdWNoZGIgY2hlY2tzXG4gICAgICAgICAgICAgIGlmICghKHR5cGVvZiAobCkgPT09IFwic3RyaW5nXCIgJiYgL15cXGQrLS8udGVzdChsKSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gY2IoY3JlYXRlRXJyb3IoSU5WQUxJRF9SRVYpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZmluaXNoT3BlblJldnMoKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGNiKGNyZWF0ZUVycm9yKFVOS05PV05fRVJST1IsICdmdW5jdGlvbl9jbGF1c2UnKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybjsgLy8gb3Blbl9yZXZzIGRvZXMgbm90IGxpa2Ugb3RoZXIgb3B0aW9uc1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdGhpcy5fZ2V0KGlkLCBvcHRzLCAoZXJyLCByZXN1bHQpID0+IHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgIGVyci5kb2NJZCA9IGlkO1xuICAgICAgICAgIHJldHVybiBjYihlcnIpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGRvYyA9IHJlc3VsdC5kb2M7XG4gICAgICAgIHZhciBtZXRhZGF0YSA9IHJlc3VsdC5tZXRhZGF0YTtcbiAgICAgICAgdmFyIGN0eCA9IHJlc3VsdC5jdHg7XG5cbiAgICAgICAgaWYgKG9wdHMuY29uZmxpY3RzKSB7XG4gICAgICAgICAgdmFyIGNvbmZsaWN0cyA9IGNvbGxlY3RDb25mbGljdHMobWV0YWRhdGEpO1xuICAgICAgICAgIGlmIChjb25mbGljdHMubGVuZ3RoKSB7XG4gICAgICAgICAgICBkb2MuX2NvbmZsaWN0cyA9IGNvbmZsaWN0cztcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXNEZWxldGVkKG1ldGFkYXRhLCBkb2MuX3JldikpIHtcbiAgICAgICAgICBkb2MuX2RlbGV0ZWQgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdHMucmV2cyB8fCBvcHRzLnJldnNfaW5mbykge1xuICAgICAgICAgIHZhciBzcGxpdHRlZFJldiA9IGRvYy5fcmV2LnNwbGl0KCctJyk7XG4gICAgICAgICAgdmFyIHJldk5vICAgICAgID0gcGFyc2VJbnQoc3BsaXR0ZWRSZXZbMF0sIDEwKTtcbiAgICAgICAgICB2YXIgcmV2SGFzaCAgICAgPSBzcGxpdHRlZFJldlsxXTtcblxuICAgICAgICAgIHZhciBwYXRocyA9IHJvb3RUb0xlYWYobWV0YWRhdGEucmV2X3RyZWUpO1xuICAgICAgICAgIHZhciBwYXRoID0gbnVsbDtcblxuICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcGF0aHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBjdXJyZW50UGF0aCA9IHBhdGhzW2ldO1xuICAgICAgICAgICAgdmFyIGhhc2hJbmRleCA9IGN1cnJlbnRQYXRoLmlkcy5tYXAoZnVuY3Rpb24gKHgpIHsgcmV0dXJuIHguaWQ7IH0pXG4gICAgICAgICAgICAgIC5pbmRleE9mKHJldkhhc2gpO1xuICAgICAgICAgICAgdmFyIGhhc2hGb3VuZEF0UmV2UG9zID0gaGFzaEluZGV4ID09PSAocmV2Tm8gLSAxKTtcblxuICAgICAgICAgICAgaWYgKGhhc2hGb3VuZEF0UmV2UG9zIHx8ICghcGF0aCAmJiBoYXNoSW5kZXggIT09IC0xKSkge1xuICAgICAgICAgICAgICBwYXRoID0gY3VycmVudFBhdGg7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgICAgICAgaWYgKCFwYXRoKSB7XG4gICAgICAgICAgICBlcnIgPSBuZXcgRXJyb3IoJ2ludmFsaWQgcmV2IHRyZWUnKTtcbiAgICAgICAgICAgIGVyci5kb2NJZCA9IGlkO1xuICAgICAgICAgICAgcmV0dXJuIGNiKGVycik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdmFyIGluZGV4T2ZSZXYgPSBwYXRoLmlkcy5tYXAoZnVuY3Rpb24gKHgpIHsgcmV0dXJuIHguaWQ7IH0pXG4gICAgICAgICAgICAuaW5kZXhPZihkb2MuX3Jldi5zcGxpdCgnLScpWzFdKSArIDE7XG4gICAgICAgICAgdmFyIGhvd01hbnkgPSBwYXRoLmlkcy5sZW5ndGggLSBpbmRleE9mUmV2O1xuICAgICAgICAgIHBhdGguaWRzLnNwbGljZShpbmRleE9mUmV2LCBob3dNYW55KTtcbiAgICAgICAgICBwYXRoLmlkcy5yZXZlcnNlKCk7XG5cbiAgICAgICAgICBpZiAob3B0cy5yZXZzKSB7XG4gICAgICAgICAgICBkb2MuX3JldmlzaW9ucyA9IHtcbiAgICAgICAgICAgICAgc3RhcnQ6IChwYXRoLnBvcyArIHBhdGguaWRzLmxlbmd0aCkgLSAxLFxuICAgICAgICAgICAgICBpZHM6IHBhdGguaWRzLm1hcChmdW5jdGlvbiAocmV2KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJldi5pZDtcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChvcHRzLnJldnNfaW5mbykge1xuICAgICAgICAgICAgdmFyIHBvcyA9ICBwYXRoLnBvcyArIHBhdGguaWRzLmxlbmd0aDtcbiAgICAgICAgICAgIGRvYy5fcmV2c19pbmZvID0gcGF0aC5pZHMubWFwKGZ1bmN0aW9uIChyZXYpIHtcbiAgICAgICAgICAgICAgcG9zLS07XG4gICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgcmV2OiBwb3MgKyAnLScgKyByZXYuaWQsXG4gICAgICAgICAgICAgICAgc3RhdHVzOiByZXYub3B0cy5zdGF0dXNcbiAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRzLmF0dGFjaG1lbnRzICYmIGRvYy5fYXR0YWNobWVudHMpIHtcbiAgICAgICAgICB2YXIgYXR0YWNobWVudHMgPSBkb2MuX2F0dGFjaG1lbnRzO1xuICAgICAgICAgIHZhciBjb3VudCA9IE9iamVjdC5rZXlzKGF0dGFjaG1lbnRzKS5sZW5ndGg7XG4gICAgICAgICAgaWYgKGNvdW50ID09PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4gY2IobnVsbCwgZG9jKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgT2JqZWN0LmtleXMoYXR0YWNobWVudHMpLmZvckVhY2goKGtleSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5fZ2V0QXR0YWNobWVudChkb2MuX2lkLCBrZXksIGF0dGFjaG1lbnRzW2tleV0sIHtcbiAgICAgICAgICAgICAgLy8gUHJldmlvdXNseSB0aGUgcmV2aXNpb24gaGFuZGxpbmcgd2FzIGRvbmUgaW4gYWRhcHRlci5qc1xuICAgICAgICAgICAgICAvLyBnZXRBdHRhY2htZW50LCBob3dldmVyIHNpbmNlIGlkYi1uZXh0IGRvZXNudCB3ZSBuZWVkIHRvXG4gICAgICAgICAgICAgIC8vIHBhc3MgdGhlIHJldiB0aHJvdWdoXG4gICAgICAgICAgICAgIHJldjogZG9jLl9yZXYsXG4gICAgICAgICAgICAgIGJpbmFyeTogb3B0cy5iaW5hcnksXG4gICAgICAgICAgICAgIGN0eDogY3R4XG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyLCBkYXRhKSB7XG4gICAgICAgICAgICAgIHZhciBhdHQgPSBkb2MuX2F0dGFjaG1lbnRzW2tleV07XG4gICAgICAgICAgICAgIGF0dC5kYXRhID0gZGF0YTtcbiAgICAgICAgICAgICAgZGVsZXRlIGF0dC5zdHViO1xuICAgICAgICAgICAgICBkZWxldGUgYXR0Lmxlbmd0aDtcbiAgICAgICAgICAgICAgaWYgKCEtLWNvdW50KSB7XG4gICAgICAgICAgICAgICAgY2IobnVsbCwgZG9jKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKGRvYy5fYXR0YWNobWVudHMpIHtcbiAgICAgICAgICAgIGZvciAodmFyIGtleSBpbiBkb2MuX2F0dGFjaG1lbnRzKSB7XG4gICAgICAgICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBlbHNlICovXG4gICAgICAgICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoZG9jLl9hdHRhY2htZW50cywga2V5KSkge1xuICAgICAgICAgICAgICAgIGRvYy5fYXR0YWNobWVudHNba2V5XS5zdHViID0gdHJ1ZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBjYihudWxsLCBkb2MpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KS5iaW5kKHRoaXMpO1xuXG4gICAgLy8gVE9ETzogSSBkb250IGxpa2UgdGhpcywgaXQgZm9yY2VzIGFuIGV4dHJhIHJlYWQgZm9yIGV2ZXJ5XG4gICAgLy8gYXR0YWNobWVudCByZWFkIGFuZCBlbmZvcmNlcyBhIGNvbmZ1c2luZyBhcGkgYmV0d2VlblxuICAgIC8vIGFkYXB0ZXIuanMgYW5kIHRoZSBhZGFwdGVyIGltcGxlbWVudGF0aW9uXG4gICAgdGhpcy5nZXRBdHRhY2htZW50ID0gYWRhcHRlckZ1bignZ2V0QXR0YWNobWVudCcsIGZ1bmN0aW9uIChkb2NJZCwgYXR0YWNobWVudElkLCBvcHRzLCBjYWxsYmFjaykge1xuICAgICAgaWYgKG9wdHMgaW5zdGFuY2VvZiBGdW5jdGlvbikge1xuICAgICAgICBjYWxsYmFjayA9IG9wdHM7XG4gICAgICAgIG9wdHMgPSB7fTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX2dldChkb2NJZCwgb3B0cywgKGVyciwgcmVzKSA9PiB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocmVzLmRvYy5fYXR0YWNobWVudHMgJiYgcmVzLmRvYy5fYXR0YWNobWVudHNbYXR0YWNobWVudElkXSkge1xuICAgICAgICAgIG9wdHMuY3R4ID0gcmVzLmN0eDtcbiAgICAgICAgICBvcHRzLmJpbmFyeSA9IHRydWU7XG4gICAgICAgICAgdGhpcy5fZ2V0QXR0YWNobWVudChkb2NJZCwgYXR0YWNobWVudElkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzLmRvYy5fYXR0YWNobWVudHNbYXR0YWNobWVudElkXSwgb3B0cywgY2FsbGJhY2spO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBjYWxsYmFjayhjcmVhdGVFcnJvcihNSVNTSU5HX0RPQykpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KS5iaW5kKHRoaXMpO1xuXG4gICAgdGhpcy5hbGxEb2NzID0gYWRhcHRlckZ1bignYWxsRG9jcycsIGZ1bmN0aW9uIChvcHRzLCBjYWxsYmFjaykge1xuICAgICAgaWYgKHR5cGVvZiBvcHRzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGNhbGxiYWNrID0gb3B0cztcbiAgICAgICAgb3B0cyA9IHt9O1xuICAgICAgfVxuICAgICAgb3B0cy5za2lwID0gdHlwZW9mIG9wdHMuc2tpcCAhPT0gJ3VuZGVmaW5lZCcgPyBvcHRzLnNraXAgOiAwO1xuICAgICAgaWYgKG9wdHMuc3RhcnRfa2V5KSB7XG4gICAgICAgIG9wdHMuc3RhcnRrZXkgPSBvcHRzLnN0YXJ0X2tleTtcbiAgICAgIH1cbiAgICAgIGlmIChvcHRzLmVuZF9rZXkpIHtcbiAgICAgICAgb3B0cy5lbmRrZXkgPSBvcHRzLmVuZF9rZXk7XG4gICAgICB9XG4gICAgICBpZiAoJ2tleXMnIGluIG9wdHMpIHtcbiAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KG9wdHMua2V5cykpIHtcbiAgICAgICAgICByZXR1cm4gY2FsbGJhY2sobmV3IFR5cGVFcnJvcignb3B0aW9ucy5rZXlzIG11c3QgYmUgYW4gYXJyYXknKSk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGluY29tcGF0aWJsZU9wdCA9XG4gICAgICAgICAgWydzdGFydGtleScsICdlbmRrZXknLCAna2V5J10uZmlsdGVyKGZ1bmN0aW9uIChpbmNvbXBhdGlibGVPcHQpIHtcbiAgICAgICAgICByZXR1cm4gaW5jb21wYXRpYmxlT3B0IGluIG9wdHM7XG4gICAgICAgIH0pWzBdO1xuICAgICAgICBpZiAoaW5jb21wYXRpYmxlT3B0KSB7XG4gICAgICAgICAgY2FsbGJhY2soY3JlYXRlRXJyb3IoUVVFUllfUEFSU0VfRVJST1IsXG4gICAgICAgICAgICAnUXVlcnkgcGFyYW1ldGVyIGAnICsgaW5jb21wYXRpYmxlT3B0ICtcbiAgICAgICAgICAgICdgIGlzIG5vdCBjb21wYXRpYmxlIHdpdGggbXVsdGktZ2V0J1xuICAgICAgICAgICkpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIWlzUmVtb3RlKHRoaXMpKSB7XG4gICAgICAgICAgYWxsRG9jc0tleXNQYXJzZShvcHRzKTtcbiAgICAgICAgICBpZiAob3B0cy5rZXlzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2FsbERvY3Moe2xpbWl0OiAwfSwgY2FsbGJhY2spO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gdGhpcy5fYWxsRG9jcyhvcHRzLCBjYWxsYmFjayk7XG4gICAgfSkuYmluZCh0aGlzKTtcblxuICAgIHRoaXMuY2xvc2UgPSBhZGFwdGVyRnVuKCdjbG9zZScsIGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgdGhpcy5fY2xvc2VkID0gdHJ1ZTtcbiAgICAgIHRoaXMuZW1pdCgnY2xvc2VkJyk7XG4gICAgICByZXR1cm4gdGhpcy5fY2xvc2UoY2FsbGJhY2spO1xuICAgIH0pLmJpbmQodGhpcyk7XG5cbiAgICB0aGlzLmluZm8gPSBhZGFwdGVyRnVuKCdpbmZvJywgZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICB0aGlzLl9pbmZvKChlcnIsIGluZm8pID0+IHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgIHJldHVybiBjYWxsYmFjayhlcnIpO1xuICAgICAgICB9XG4gICAgICAgIC8vIGFzc3VtZSB3ZSBrbm93IGJldHRlciB0aGFuIHRoZSBhZGFwdGVyLCB1bmxlc3MgaXQgaW5mb3JtcyB1c1xuICAgICAgICBpbmZvLmRiX25hbWUgPSBpbmZvLmRiX25hbWUgfHwgdGhpcy5uYW1lO1xuICAgICAgICBpbmZvLmF1dG9fY29tcGFjdGlvbiA9ICEhKHRoaXMuYXV0b19jb21wYWN0aW9uICYmICFpc1JlbW90ZSh0aGlzKSk7XG4gICAgICAgIGluZm8uYWRhcHRlciA9IHRoaXMuYWRhcHRlcjtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgaW5mbyk7XG4gICAgICB9KTtcbiAgICB9KS5iaW5kKHRoaXMpO1xuXG4gICAgdGhpcy5pZCA9IGFkYXB0ZXJGdW4oJ2lkJywgZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICByZXR1cm4gdGhpcy5faWQoY2FsbGJhY2spO1xuICAgIH0pLmJpbmQodGhpcyk7XG5cbiAgICB0aGlzLmJ1bGtEb2NzID0gYWRhcHRlckZ1bignYnVsa0RvY3MnLCBmdW5jdGlvbiAocmVxLCBvcHRzLCBjYWxsYmFjaykge1xuICAgICAgaWYgKHR5cGVvZiBvcHRzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGNhbGxiYWNrID0gb3B0cztcbiAgICAgICAgb3B0cyA9IHt9O1xuICAgICAgfVxuXG4gICAgICBvcHRzID0gb3B0cyB8fCB7fTtcblxuICAgICAgaWYgKEFycmF5LmlzQXJyYXkocmVxKSkge1xuICAgICAgICByZXEgPSB7XG4gICAgICAgICAgZG9jczogcmVxXG4gICAgICAgIH07XG4gICAgICB9XG5cbiAgICAgIGlmICghcmVxIHx8ICFyZXEuZG9jcyB8fCAhQXJyYXkuaXNBcnJheShyZXEuZG9jcykpIHtcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGNyZWF0ZUVycm9yKE1JU1NJTkdfQlVMS19ET0NTKSk7XG4gICAgICB9XG5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVxLmRvY3MubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgaWYgKHR5cGVvZiByZXEuZG9jc1tpXSAhPT0gJ29iamVjdCcgfHwgQXJyYXkuaXNBcnJheShyZXEuZG9jc1tpXSkpIHtcbiAgICAgICAgICByZXR1cm4gY2FsbGJhY2soY3JlYXRlRXJyb3IoTk9UX0FOX09CSkVDVCkpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHZhciBhdHRhY2htZW50RXJyb3I7XG4gICAgICByZXEuZG9jcy5mb3JFYWNoKGZ1bmN0aW9uIChkb2MpIHtcbiAgICAgICAgaWYgKGRvYy5fYXR0YWNobWVudHMpIHtcbiAgICAgICAgICBPYmplY3Qua2V5cyhkb2MuX2F0dGFjaG1lbnRzKS5mb3JFYWNoKGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgICAgICAgICBhdHRhY2htZW50RXJyb3IgPSBhdHRhY2htZW50RXJyb3IgfHwgYXR0YWNobWVudE5hbWVFcnJvcihuYW1lKTtcbiAgICAgICAgICAgIGlmICghZG9jLl9hdHRhY2htZW50c1tuYW1lXS5jb250ZW50X3R5cGUpIHtcbiAgICAgICAgICAgICAgZ3VhcmRlZENvbnNvbGUoJ3dhcm4nLCAnQXR0YWNobWVudCcsIG5hbWUsICdvbiBkb2N1bWVudCcsIGRvYy5faWQsICdpcyBtaXNzaW5nIGNvbnRlbnRfdHlwZScpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgaWYgKGF0dGFjaG1lbnRFcnJvcikge1xuICAgICAgICByZXR1cm4gY2FsbGJhY2soY3JlYXRlRXJyb3IoQkFEX1JFUVVFU1QsIGF0dGFjaG1lbnRFcnJvcikpO1xuICAgICAgfVxuXG4gICAgICBpZiAoISgnbmV3X2VkaXRzJyBpbiBvcHRzKSkge1xuICAgICAgICBpZiAoJ25ld19lZGl0cycgaW4gcmVxKSB7XG4gICAgICAgICAgb3B0cy5uZXdfZWRpdHMgPSByZXEubmV3X2VkaXRzO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG9wdHMubmV3X2VkaXRzID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB2YXIgYWRhcHRlciA9IHRoaXM7XG4gICAgICBpZiAoIW9wdHMubmV3X2VkaXRzICYmICFpc1JlbW90ZShhZGFwdGVyKSkge1xuICAgICAgICAvLyBlbnN1cmUgcmV2aXNpb25zIG9mIHRoZSBzYW1lIGRvYyBhcmUgc29ydGVkLCBzbyB0aGF0XG4gICAgICAgIC8vIHRoZSBsb2NhbCBhZGFwdGVyIHByb2Nlc3NlcyB0aGVtIGNvcnJlY3RseSAoIzI5MzUpXG4gICAgICAgIHJlcS5kb2NzLnNvcnQoY29tcGFyZUJ5SWRUaGVuUmV2KTtcbiAgICAgIH1cblxuICAgICAgY2xlYW5Eb2NzKHJlcS5kb2NzKTtcblxuICAgICAgLy8gaW4gdGhlIGNhc2Ugb2YgY29uZmxpY3RzLCB3ZSB3YW50IHRvIHJldHVybiB0aGUgX2lkcyB0byB0aGUgdXNlclxuICAgICAgLy8gaG93ZXZlciwgdGhlIHVuZGVybHlpbmcgYWRhcHRlciBtYXkgZGVzdHJveSB0aGUgZG9jcyBhcnJheSwgc29cbiAgICAgIC8vIGNyZWF0ZSBhIGNvcHkgaGVyZVxuICAgICAgdmFyIGlkcyA9IHJlcS5kb2NzLm1hcChmdW5jdGlvbiAoZG9jKSB7XG4gICAgICAgIHJldHVybiBkb2MuX2lkO1xuICAgICAgfSk7XG5cbiAgICAgIHRoaXMuX2J1bGtEb2NzKHJlcSwgb3B0cywgZnVuY3Rpb24gKGVyciwgcmVzKSB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIW9wdHMubmV3X2VkaXRzKSB7XG4gICAgICAgICAgLy8gdGhpcyBpcyB3aGF0IGNvdWNoIGRvZXMgd2hlbiBuZXdfZWRpdHMgaXMgZmFsc2VcbiAgICAgICAgICByZXMgPSByZXMuZmlsdGVyKGZ1bmN0aW9uICh4KSB7XG4gICAgICAgICAgICByZXR1cm4geC5lcnJvcjtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICAvLyBhZGQgaWRzIGZvciBlcnJvci9jb25mbGljdCByZXNwb25zZXMgKG5vdCByZXF1aXJlZCBmb3IgQ291Y2hEQilcbiAgICAgICAgaWYgKCFpc1JlbW90ZShhZGFwdGVyKSkge1xuICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gcmVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgcmVzW2ldLmlkID0gcmVzW2ldLmlkIHx8IGlkc1tpXTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjYWxsYmFjayhudWxsLCByZXMpO1xuICAgICAgfSk7XG4gICAgfSkuYmluZCh0aGlzKTtcblxuICAgIHRoaXMucmVnaXN0ZXJEZXBlbmRlbnREYXRhYmFzZSA9IGFkYXB0ZXJGdW4oJ3JlZ2lzdGVyRGVwZW5kZW50RGF0YWJhc2UnLCBmdW5jdGlvbiAoZGVwZW5kZW50RGIsIGNhbGxiYWNrKSB7XG4gICAgICB2YXIgZGJPcHRpb25zID0gY2xvbmUodGhpcy5fX29wdHMpO1xuICAgICAgaWYgKHRoaXMuX19vcHRzLnZpZXdfYWRhcHRlcikge1xuICAgICAgICBkYk9wdGlvbnMuYWRhcHRlciA9IHRoaXMuX19vcHRzLnZpZXdfYWRhcHRlcjtcbiAgICAgIH1cblxuICAgICAgdmFyIGRlcERCID0gbmV3IHRoaXMuY29uc3RydWN0b3IoZGVwZW5kZW50RGIsIGRiT3B0aW9ucyk7XG5cbiAgICAgIGZ1bmN0aW9uIGRpZmZGdW4oZG9jKSB7XG4gICAgICAgIGRvYy5kZXBlbmRlbnREYnMgPSBkb2MuZGVwZW5kZW50RGJzIHx8IHt9O1xuICAgICAgICBpZiAoZG9jLmRlcGVuZGVudERic1tkZXBlbmRlbnREYl0pIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7IC8vIG5vIHVwZGF0ZSByZXF1aXJlZFxuICAgICAgICB9XG4gICAgICAgIGRvYy5kZXBlbmRlbnREYnNbZGVwZW5kZW50RGJdID0gdHJ1ZTtcbiAgICAgICAgcmV0dXJuIGRvYztcbiAgICAgIH1cbiAgICAgIHVwc2VydCh0aGlzLCAnX2xvY2FsL19wb3VjaF9kZXBlbmRlbnREYnMnLCBkaWZmRnVuKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwge2RiOiBkZXBEQn0pO1xuICAgICAgfSkuY2F0Y2goY2FsbGJhY2spO1xuICAgIH0pLmJpbmQodGhpcyk7XG5cbiAgICB0aGlzLmRlc3Ryb3kgPSBhZGFwdGVyRnVuKCdkZXN0cm95JywgZnVuY3Rpb24gKG9wdHMsIGNhbGxiYWNrKSB7XG5cbiAgICAgIGlmICh0eXBlb2Ygb3B0cyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBjYWxsYmFjayA9IG9wdHM7XG4gICAgICAgIG9wdHMgPSB7fTtcbiAgICAgIH1cblxuICAgICAgdmFyIHVzZVByZWZpeCA9ICd1c2VfcHJlZml4JyBpbiB0aGlzID8gdGhpcy51c2VfcHJlZml4IDogdHJ1ZTtcblxuICAgICAgY29uc3QgZGVzdHJveURiID0gKCkgPT4ge1xuICAgICAgICAvLyBjYWxsIGRlc3Ryb3kgbWV0aG9kIG9mIHRoZSBwYXJ0aWN1bGFyIGFkYXB0b3JcbiAgICAgICAgdGhpcy5fZGVzdHJveShvcHRzLCAoZXJyLCByZXNwKSA9PiB7XG4gICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMuX2Rlc3Ryb3llZCA9IHRydWU7XG4gICAgICAgICAgdGhpcy5lbWl0KCdkZXN0cm95ZWQnKTtcbiAgICAgICAgICBjYWxsYmFjayhudWxsLCByZXNwIHx8IHsgJ29rJzogdHJ1ZSB9KTtcbiAgICAgICAgfSk7XG4gICAgICB9O1xuXG4gICAgICBpZiAoaXNSZW1vdGUodGhpcykpIHtcbiAgICAgICAgLy8gbm8gbmVlZCB0byBjaGVjayBmb3IgZGVwZW5kZW50IERCcyBpZiBpdCdzIGEgcmVtb3RlIERCXG4gICAgICAgIHJldHVybiBkZXN0cm95RGIoKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5nZXQoJ19sb2NhbC9fcG91Y2hfZGVwZW5kZW50RGJzJywgKGVyciwgbG9jYWxEb2MpID0+IHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgICAgICAgIGlmIChlcnIuc3RhdHVzICE9PSA0MDQpIHtcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgIH0gZWxzZSB7IC8vIG5vIGRlcGVuZGVuY2llc1xuICAgICAgICAgICAgcmV0dXJuIGRlc3Ryb3lEYigpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB2YXIgZGVwZW5kZW50RGJzID0gbG9jYWxEb2MuZGVwZW5kZW50RGJzO1xuICAgICAgICB2YXIgUG91Y2hEQiA9IHRoaXMuY29uc3RydWN0b3I7XG4gICAgICAgIHZhciBkZWxldGVkTWFwID0gT2JqZWN0LmtleXMoZGVwZW5kZW50RGJzKS5tYXAoKG5hbWUpID0+IHtcbiAgICAgICAgICAvLyB1c2VfcHJlZml4IGlzIG9ubHkgZmFsc2UgaW4gdGhlIGJyb3dzZXJcbiAgICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgICAgICAgIHZhciB0cnVlTmFtZSA9IHVzZVByZWZpeCA/XG4gICAgICAgICAgICBuYW1lLnJlcGxhY2UobmV3IFJlZ0V4cCgnXicgKyBQb3VjaERCLnByZWZpeCksICcnKSA6IG5hbWU7XG4gICAgICAgICAgcmV0dXJuIG5ldyBQb3VjaERCKHRydWVOYW1lLCB0aGlzLl9fb3B0cykuZGVzdHJveSgpO1xuICAgICAgICB9KTtcbiAgICAgICAgUHJvbWlzZS5hbGwoZGVsZXRlZE1hcCkudGhlbihkZXN0cm95RGIsIGNhbGxiYWNrKTtcbiAgICAgIH0pO1xuICAgIH0pLmJpbmQodGhpcyk7XG4gIH1cblxuICBfY29tcGFjdChvcHRzLCBjYWxsYmFjaykge1xuICAgIHZhciBjaGFuZ2VzT3B0cyA9IHtcbiAgICAgIHJldHVybl9kb2NzOiBmYWxzZSxcbiAgICAgIGxhc3Rfc2VxOiBvcHRzLmxhc3Rfc2VxIHx8IDBcbiAgICB9O1xuICAgIHZhciBwcm9taXNlcyA9IFtdO1xuXG4gICAgdmFyIHRhc2tJZDtcbiAgICB2YXIgY29tcGFjdGVkRG9jcyA9IDA7XG5cbiAgICBjb25zdCBvbkNoYW5nZSA9IChyb3cpID0+IHtcbiAgICAgIHRoaXMuYWN0aXZlVGFza3MudXBkYXRlKHRhc2tJZCwge1xuICAgICAgICBjb21wbGV0ZWRfaXRlbXM6ICsrY29tcGFjdGVkRG9jc1xuICAgICAgfSk7XG4gICAgICBwcm9taXNlcy5wdXNoKHRoaXMuY29tcGFjdERvY3VtZW50KHJvdy5pZCwgMCkpO1xuICAgIH07XG4gICAgY29uc3Qgb25FcnJvciA9IChlcnIpID0+IHtcbiAgICAgIHRoaXMuYWN0aXZlVGFza3MucmVtb3ZlKHRhc2tJZCwgZXJyKTtcbiAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgfTtcbiAgICBjb25zdCBvbkNvbXBsZXRlID0gKHJlc3ApID0+IHtcbiAgICAgIHZhciBsYXN0U2VxID0gcmVzcC5sYXN0X3NlcTtcbiAgICAgIFByb21pc2UuYWxsKHByb21pc2VzKS50aGVuKCgpID0+IHtcbiAgICAgICAgcmV0dXJuIHVwc2VydCh0aGlzLCAnX2xvY2FsL2NvbXBhY3Rpb24nLCAoZG9jKSA9PiB7XG4gICAgICAgICAgaWYgKCFkb2MubGFzdF9zZXEgfHwgZG9jLmxhc3Rfc2VxIDwgbGFzdFNlcSkge1xuICAgICAgICAgICAgZG9jLmxhc3Rfc2VxID0gbGFzdFNlcTtcbiAgICAgICAgICAgIHJldHVybiBkb2M7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBmYWxzZTsgLy8gc29tZWJvZHkgZWxzZSBnb3QgaGVyZSBmaXJzdCwgZG9uJ3QgdXBkYXRlXG4gICAgICAgIH0pO1xuICAgICAgfSkudGhlbigoKSA9PiB7XG4gICAgICAgIHRoaXMuYWN0aXZlVGFza3MucmVtb3ZlKHRhc2tJZCk7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHtvazogdHJ1ZX0pO1xuICAgICAgfSkuY2F0Y2gob25FcnJvcik7XG4gICAgfTtcblxuICAgIHRoaXMuaW5mbygpLnRoZW4oKGluZm8pID0+IHtcbiAgICAgIHRhc2tJZCA9IHRoaXMuYWN0aXZlVGFza3MuYWRkKHtcbiAgICAgICAgbmFtZTogJ2RhdGFiYXNlX2NvbXBhY3Rpb24nLFxuICAgICAgICB0b3RhbF9pdGVtczogaW5mby51cGRhdGVfc2VxIC0gY2hhbmdlc09wdHMubGFzdF9zZXEsXG4gICAgICB9KTtcblxuICAgICAgdGhpcy5jaGFuZ2VzKGNoYW5nZXNPcHRzKVxuICAgICAgICAub24oJ2NoYW5nZScsIG9uQ2hhbmdlKVxuICAgICAgICAub24oJ2NvbXBsZXRlJywgb25Db21wbGV0ZSlcbiAgICAgICAgLm9uKCdlcnJvcicsIG9uRXJyb3IpO1xuICAgIH0pO1xuICB9XG5cbiAgY2hhbmdlcyhvcHRzLCBjYWxsYmFjaykge1xuICAgIGlmICh0eXBlb2Ygb3B0cyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY2FsbGJhY2sgPSBvcHRzO1xuICAgICAgb3B0cyA9IHt9O1xuICAgIH1cblxuICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuXG4gICAgLy8gQnkgZGVmYXVsdCBzZXQgcmV0dXJuX2RvY3MgdG8gZmFsc2UgaWYgdGhlIGNhbGxlciBoYXMgb3B0cy5saXZlID0gdHJ1ZSxcbiAgICAvLyB0aGlzIHdpbGwgcHJldmVudCB1cyBmcm9tIGNvbGxlY3RpbmcgdGhlIHNldCBvZiBjaGFuZ2VzIGluZGVmaW5pdGVseVxuICAgIC8vIHJlc3VsdGluZyBpbiBncm93aW5nIG1lbW9yeVxuICAgIG9wdHMucmV0dXJuX2RvY3MgPSAoJ3JldHVybl9kb2NzJyBpbiBvcHRzKSA/IG9wdHMucmV0dXJuX2RvY3MgOiAhb3B0cy5saXZlO1xuXG4gICAgcmV0dXJuIG5ldyBDaGFuZ2VzKHRoaXMsIG9wdHMsIGNhbGxiYWNrKTtcbiAgfVxuXG4gIHR5cGUoKSB7XG4gICAgcmV0dXJuICh0eXBlb2YgdGhpcy5fdHlwZSA9PT0gJ2Z1bmN0aW9uJykgPyB0aGlzLl90eXBlKCkgOiB0aGlzLmFkYXB0ZXI7XG4gIH1cbn1cblxuLy8gVGhlIGFic3RyYWN0IHB1cmdlIGltcGxlbWVudGF0aW9uIGV4cGVjdHMgYSBkb2MgaWQgYW5kIHRoZSByZXYgb2YgYSBsZWFmIG5vZGUgaW4gdGhhdCBkb2MuXG4vLyBJdCB3aWxsIHJldHVybiBlcnJvcnMgaWYgdGhlIHJldiBkb2VzbuKAmXQgZXhpc3Qgb3IgaXNu4oCZdCBhIGxlYWYuXG5BYnN0cmFjdFBvdWNoREIucHJvdG90eXBlLnB1cmdlID0gYWRhcHRlckZ1bignX3B1cmdlJywgZnVuY3Rpb24gKGRvY0lkLCByZXYsIGNhbGxiYWNrKSB7XG4gIGlmICh0eXBlb2YgdGhpcy5fcHVyZ2UgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgcmV0dXJuIGNhbGxiYWNrKGNyZWF0ZUVycm9yKFVOS05PV05fRVJST1IsICdQdXJnZSBpcyBub3QgaW1wbGVtZW50ZWQgaW4gdGhlICcgKyB0aGlzLmFkYXB0ZXIgKyAnIGFkYXB0ZXIuJykpO1xuICB9XG4gIHZhciBzZWxmID0gdGhpcztcblxuICBzZWxmLl9nZXRSZXZpc2lvblRyZWUoZG9jSWQsIChlcnJvciwgcmV2cykgPT4ge1xuICAgIGlmIChlcnJvcikge1xuICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycm9yKTtcbiAgICB9XG4gICAgaWYgKCFyZXZzKSB7XG4gICAgICByZXR1cm4gY2FsbGJhY2soY3JlYXRlRXJyb3IoTUlTU0lOR19ET0MpKTtcbiAgICB9XG4gICAgbGV0IHBhdGg7XG4gICAgdHJ5IHtcbiAgICAgIHBhdGggPSBmaW5kUGF0aFRvTGVhZihyZXZzLCByZXYpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICByZXR1cm4gY2FsbGJhY2soZXJyb3IubWVzc2FnZSB8fCBlcnJvcik7XG4gICAgfVxuICAgIHNlbGYuX3B1cmdlKGRvY0lkLCBwYXRoLCAoZXJyb3IsIHJlc3VsdCkgPT4ge1xuICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjayhlcnJvcik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhcHBlbmRQdXJnZVNlcShzZWxmLCBkb2NJZCwgcmV2KS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICByZXR1cm4gY2FsbGJhY2sobnVsbCwgcmVzdWx0KTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0pO1xufSk7XG5cbmV4cG9ydCBkZWZhdWx0IEFic3RyYWN0UG91Y2hEQjtcbiIsImV4cG9ydCBkZWZhdWx0IGNsYXNzIFRhc2tRdWV1ZSB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuaXNSZWFkeSA9IGZhbHNlO1xuICAgIHRoaXMuZmFpbGVkID0gZmFsc2U7XG4gICAgdGhpcy5xdWV1ZSA9IFtdO1xuICB9XG5cbiAgZXhlY3V0ZSgpIHtcbiAgICB2YXIgZnVuO1xuICAgIGlmICh0aGlzLmZhaWxlZCkge1xuICAgICAgd2hpbGUgKChmdW4gPSB0aGlzLnF1ZXVlLnNoaWZ0KCkpKSB7XG4gICAgICAgIGZ1bih0aGlzLmZhaWxlZCk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHdoaWxlICgoZnVuID0gdGhpcy5xdWV1ZS5zaGlmdCgpKSkge1xuICAgICAgICBmdW4oKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmYWlsKGVycikge1xuICAgIHRoaXMuZmFpbGVkID0gZXJyO1xuICAgIHRoaXMuZXhlY3V0ZSgpO1xuICB9XG5cbiAgcmVhZHkoZGIpIHtcbiAgICB0aGlzLmlzUmVhZHkgPSB0cnVlO1xuICAgIHRoaXMuZGIgPSBkYjtcbiAgICB0aGlzLmV4ZWN1dGUoKTtcbiAgfVxuXG4gIGFkZFRhc2soZnVuKSB7XG4gICAgdGhpcy5xdWV1ZS5wdXNoKGZ1bik7XG4gICAgaWYgKHRoaXMuZmFpbGVkKSB7XG4gICAgICB0aGlzLmV4ZWN1dGUoKTtcbiAgICB9XG4gIH1cbn1cbiIsImltcG9ydCB7IGd1YXJkZWRDb25zb2xlLCBoYXNMb2NhbFN0b3JhZ2UgfSBmcm9tICdwb3VjaGRiLXV0aWxzJztcblxuY29uc3QgZ2V0UGFyc2VBZGFwdGVyID0gKFBvdWNoREIpID0+IGZ1bmN0aW9uIHBhcnNlQWRhcHRlcihuYW1lLCBvcHRzKSB7XG4gIHZhciBtYXRjaCA9IG5hbWUubWF0Y2goLyhbYS16LV0qKTpcXC9cXC8oLiopLyk7XG4gIGlmIChtYXRjaCkge1xuICAgIC8vIHRoZSBodHRwIGFkYXB0ZXIgZXhwZWN0cyB0aGUgZnVsbHkgcXVhbGlmaWVkIG5hbWVcbiAgICByZXR1cm4ge1xuICAgICAgbmFtZTogL2h0dHBzPy8udGVzdChtYXRjaFsxXSkgPyBtYXRjaFsxXSArICc6Ly8nICsgbWF0Y2hbMl0gOiBtYXRjaFsyXSxcbiAgICAgIGFkYXB0ZXI6IG1hdGNoWzFdXG4gICAgfTtcbiAgfVxuXG4gIHZhciBhZGFwdGVycyA9IFBvdWNoREIuYWRhcHRlcnM7XG4gIHZhciBwcmVmZXJyZWRBZGFwdGVycyA9IFBvdWNoREIucHJlZmVycmVkQWRhcHRlcnM7XG4gIHZhciBwcmVmaXggPSBQb3VjaERCLnByZWZpeDtcbiAgdmFyIGFkYXB0ZXJOYW1lID0gb3B0cy5hZGFwdGVyO1xuXG4gIGlmICghYWRhcHRlck5hbWUpIHsgLy8gYXV0b21hdGljYWxseSBkZXRlcm1pbmUgYWRhcHRlclxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcHJlZmVycmVkQWRhcHRlcnMubGVuZ3RoOyArK2kpIHtcbiAgICAgIGFkYXB0ZXJOYW1lID0gcHJlZmVycmVkQWRhcHRlcnNbaV07XG4gICAgICAvLyBjaGVjayBmb3IgYnJvd3NlcnMgdGhhdCBoYXZlIGJlZW4gdXBncmFkZWQgZnJvbSB3ZWJzcWwtb25seSB0byB3ZWJzcWwraWRiXG4gICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICAgIGlmIChhZGFwdGVyTmFtZSA9PT0gJ2lkYicgJiYgJ3dlYnNxbCcgaW4gYWRhcHRlcnMgJiZcbiAgICAgICAgICBoYXNMb2NhbFN0b3JhZ2UoKSAmJiBsb2NhbFN0b3JhZ2VbJ19wb3VjaF9fd2Vic3FsZGJfJyArIHByZWZpeCArIG5hbWVdKSB7XG4gICAgICAgIC8vIGxvZyBpdCwgYmVjYXVzZSB0aGlzIGNhbiBiZSBjb25mdXNpbmcgZHVyaW5nIGRldmVsb3BtZW50XG4gICAgICAgIGd1YXJkZWRDb25zb2xlKCdsb2cnLCAnUG91Y2hEQiBpcyBkb3duZ3JhZGluZyBcIicgKyBuYW1lICsgJ1wiIHRvIFdlYlNRTCB0bycgK1xuICAgICAgICAgICcgYXZvaWQgZGF0YSBsb3NzLCBiZWNhdXNlIGl0IHdhcyBhbHJlYWR5IG9wZW5lZCB3aXRoIFdlYlNRTC4nKTtcbiAgICAgICAgY29udGludWU7IC8vIGtlZXAgdXNpbmcgd2Vic3FsIHRvIGF2b2lkIHVzZXIgZGF0YSBsb3NzXG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICB2YXIgYWRhcHRlciA9IGFkYXB0ZXJzW2FkYXB0ZXJOYW1lXTtcblxuICAvLyBpZiBhZGFwdGVyIGlzIGludmFsaWQsIHRoZW4gYW4gZXJyb3Igd2lsbCBiZSB0aHJvd24gbGF0ZXJcbiAgdmFyIHVzZVByZWZpeCA9IChhZGFwdGVyICYmICd1c2VfcHJlZml4JyBpbiBhZGFwdGVyKSA/XG4gICAgYWRhcHRlci51c2VfcHJlZml4IDogdHJ1ZTtcblxuICByZXR1cm4ge1xuICAgIG5hbWU6IHVzZVByZWZpeCA/IChwcmVmaXggKyBuYW1lKSA6IG5hbWUsXG4gICAgYWRhcHRlcjogYWRhcHRlck5hbWVcbiAgfTtcbn07XG5cblxuXG5leHBvcnQgZGVmYXVsdCBnZXRQYXJzZUFkYXB0ZXI7IiwiZnVuY3Rpb24gaW5oZXJpdHMoQSwgQikge1xuICBBLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoQi5wcm90b3R5cGUsIHtcbiAgICBjb25zdHJ1Y3RvcjogeyB2YWx1ZTogQSB9XG4gIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ2xhc3MocGFyZW50LCBpbml0KSB7XG4gIGxldCBrbGFzcyA9IGZ1bmN0aW9uICguLi5hcmdzKSB7XG4gICAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIGtsYXNzKSkge1xuICAgICAgcmV0dXJuIG5ldyBrbGFzcyguLi5hcmdzKTtcbiAgICB9XG4gICAgaW5pdC5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfTtcbiAgaW5oZXJpdHMoa2xhc3MsIHBhcmVudCk7XG4gIHJldHVybiBrbGFzcztcbn1cbiIsImltcG9ydCBBZGFwdGVyIGZyb20gJy4vYWRhcHRlci5qcyc7XG5pbXBvcnQgVGFza1F1ZXVlIGZyb20gJy4vdGFza3F1ZXVlJztcbmltcG9ydCB7IGNsb25lIH0gZnJvbSAncG91Y2hkYi11dGlscyc7XG5pbXBvcnQgZ2V0UGFyc2VBZGFwdGVyIGZyb20gJy4vcGFyc2VBZGFwdGVyJztcbmltcG9ydCB7IGNyZWF0ZUNsYXNzIH0gZnJvbSAnLi91dGlscyc7XG5cbi8vIE9LLCBzbyBoZXJlJ3MgdGhlIGRlYWwuIENvbnNpZGVyIHRoaXMgY29kZTpcbi8vICAgICB2YXIgZGIxID0gbmV3IFBvdWNoREIoJ2ZvbycpO1xuLy8gICAgIHZhciBkYjIgPSBuZXcgUG91Y2hEQignZm9vJyk7XG4vLyAgICAgZGIxLmRlc3Ryb3koKTtcbi8vIF4gdGhlc2UgdHdvIGJvdGggbmVlZCB0byBlbWl0ICdkZXN0cm95ZWQnIGV2ZW50cyxcbi8vIGFzIHdlbGwgYXMgdGhlIFBvdWNoREIgY29uc3RydWN0b3IgaXRzZWxmLlxuLy8gU28gd2UgaGF2ZSBvbmUgZGIgb2JqZWN0ICh3aGljaGV2ZXIgb25lIGdvdCBkZXN0cm95KCkgY2FsbGVkIG9uIGl0KVxuLy8gcmVzcG9uc2libGUgZm9yIGVtaXR0aW5nIHRoZSBpbml0aWFsIGV2ZW50LCB3aGljaCB0aGVuIGdldHMgZW1pdHRlZFxuLy8gYnkgdGhlIGNvbnN0cnVjdG9yLCB3aGljaCB0aGVuIGJyb2FkY2FzdHMgaXQgdG8gYW55IG90aGVyIGRic1xuLy8gdGhhdCBtYXkgaGF2ZSBiZWVuIGNyZWF0ZWQgd2l0aCB0aGUgc2FtZSBuYW1lLlxuZnVuY3Rpb24gcHJlcGFyZUZvckRlc3RydWN0aW9uKHNlbGYpIHtcblxuICBmdW5jdGlvbiBvbkRlc3Ryb3llZChmcm9tX2NvbnN0cnVjdG9yKSB7XG4gICAgc2VsZi5yZW1vdmVMaXN0ZW5lcignY2xvc2VkJywgb25DbG9zZWQpO1xuICAgIGlmICghZnJvbV9jb25zdHJ1Y3Rvcikge1xuICAgICAgc2VsZi5jb25zdHJ1Y3Rvci5lbWl0KCdkZXN0cm95ZWQnLCBzZWxmLm5hbWUpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG9uQ2xvc2VkKCkge1xuICAgIHNlbGYucmVtb3ZlTGlzdGVuZXIoJ2Rlc3Ryb3llZCcsIG9uRGVzdHJveWVkKTtcbiAgICBzZWxmLmNvbnN0cnVjdG9yLmVtaXQoJ3VucmVmJywgc2VsZik7XG4gIH1cblxuICBzZWxmLm9uY2UoJ2Rlc3Ryb3llZCcsIG9uRGVzdHJveWVkKTtcbiAgc2VsZi5vbmNlKCdjbG9zZWQnLCBvbkNsb3NlZCk7XG4gIHNlbGYuY29uc3RydWN0b3IuZW1pdCgncmVmJywgc2VsZik7XG59XG5cbmNsYXNzIFBvdWNoSW50ZXJuYWwgZXh0ZW5kcyBBZGFwdGVyIHtcbiAgY29uc3RydWN0b3IobmFtZSwgb3B0cykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5fc2V0dXAobmFtZSwgb3B0cyk7XG4gIH1cblxuICBfc2V0dXAobmFtZSwgb3B0cykge1xuICAgIHN1cGVyLl9zZXR1cCgpO1xuICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuXG4gICAgaWYgKG5hbWUgJiYgdHlwZW9mIG5hbWUgPT09ICdvYmplY3QnKSB7XG4gICAgICBvcHRzID0gbmFtZTtcbiAgICAgIG5hbWUgPSBvcHRzLm5hbWU7XG4gICAgICBkZWxldGUgb3B0cy5uYW1lO1xuICAgIH1cblxuICAgIGlmIChvcHRzLmRldGVybWluaXN0aWNfcmV2cyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBvcHRzLmRldGVybWluaXN0aWNfcmV2cyA9IHRydWU7XG4gICAgfVxuXG4gICAgdGhpcy5fX29wdHMgPSBvcHRzID0gY2xvbmUob3B0cyk7XG5cbiAgICB0aGlzLmF1dG9fY29tcGFjdGlvbiA9IG9wdHMuYXV0b19jb21wYWN0aW9uO1xuICAgIHRoaXMucHVyZ2VkX2luZm9zX2xpbWl0ID0gb3B0cy5wdXJnZWRfaW5mb3NfbGltaXQgfHwgMTAwMDtcbiAgICB0aGlzLnByZWZpeCA9IFBvdWNoREIucHJlZml4O1xuXG4gICAgaWYgKHR5cGVvZiBuYW1lICE9PSAnc3RyaW5nJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdNaXNzaW5nL2ludmFsaWQgREIgbmFtZScpO1xuICAgIH1cblxuICAgIHZhciBwcmVmaXhlZE5hbWUgPSAob3B0cy5wcmVmaXggfHwgJycpICsgbmFtZTtcbiAgICB2YXIgYmFja2VuZCA9IHBhcnNlQWRhcHRlcihwcmVmaXhlZE5hbWUsIG9wdHMpO1xuXG4gICAgb3B0cy5uYW1lID0gYmFja2VuZC5uYW1lO1xuICAgIG9wdHMuYWRhcHRlciA9IG9wdHMuYWRhcHRlciB8fCBiYWNrZW5kLmFkYXB0ZXI7XG5cbiAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgIHRoaXMuX2FkYXB0ZXIgPSBvcHRzLmFkYXB0ZXI7XG4gICAgUG91Y2hEQi5lbWl0KCdkZWJ1ZycsIFsnYWRhcHRlcicsICdQaWNrZWQgYWRhcHRlcjogJywgb3B0cy5hZGFwdGVyXSk7XG5cbiAgICBpZiAoIVBvdWNoREIuYWRhcHRlcnNbb3B0cy5hZGFwdGVyXSB8fFxuICAgICAgICAhUG91Y2hEQi5hZGFwdGVyc1tvcHRzLmFkYXB0ZXJdLnZhbGlkKCkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBBZGFwdGVyOiAnICsgb3B0cy5hZGFwdGVyKTtcbiAgICB9XG5cbiAgICBpZiAob3B0cy52aWV3X2FkYXB0ZXIpIHtcbiAgICAgIGlmICghUG91Y2hEQi5hZGFwdGVyc1tvcHRzLnZpZXdfYWRhcHRlcl0gfHxcbiAgICAgICAgICAhUG91Y2hEQi5hZGFwdGVyc1tvcHRzLnZpZXdfYWRhcHRlcl0udmFsaWQoKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgVmlldyBBZGFwdGVyOiAnICsgb3B0cy52aWV3X2FkYXB0ZXIpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMudGFza3F1ZXVlID0gbmV3IFRhc2tRdWV1ZSgpO1xuXG4gICAgdGhpcy5hZGFwdGVyID0gb3B0cy5hZGFwdGVyO1xuXG4gICAgUG91Y2hEQi5hZGFwdGVyc1tvcHRzLmFkYXB0ZXJdLmNhbGwodGhpcywgb3B0cywgKGVycikgPT4ge1xuICAgICAgaWYgKGVycikge1xuICAgICAgICByZXR1cm4gdGhpcy50YXNrcXVldWUuZmFpbChlcnIpO1xuICAgICAgfVxuICAgICAgcHJlcGFyZUZvckRlc3RydWN0aW9uKHRoaXMpO1xuXG4gICAgICB0aGlzLmVtaXQoJ2NyZWF0ZWQnLCB0aGlzKTtcbiAgICAgIFBvdWNoREIuZW1pdCgnY3JlYXRlZCcsIHRoaXMubmFtZSk7XG4gICAgICB0aGlzLnRhc2txdWV1ZS5yZWFkeSh0aGlzKTtcbiAgICB9KTtcbiAgfVxufVxuXG5jb25zdCBQb3VjaERCID0gY3JlYXRlQ2xhc3MoUG91Y2hJbnRlcm5hbCwgZnVuY3Rpb24gKG5hbWUsIG9wdHMpIHtcbiAgUG91Y2hJbnRlcm5hbC5wcm90b3R5cGUuX3NldHVwLmNhbGwodGhpcywgbmFtZSwgb3B0cyk7XG59KTtcblxuY29uc3QgcGFyc2VBZGFwdGVyID0gZ2V0UGFyc2VBZGFwdGVyKFBvdWNoREIpO1xuXG5leHBvcnQgZGVmYXVsdCBQb3VjaERCO1xuIiwiaW1wb3J0IHt2NCBhcyB1dWlkdjR9IGZyb20gXCJ1dWlkXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEFjdGl2ZVRhc2tzIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy50YXNrcyA9IHt9O1xuICB9XG5cbiAgbGlzdCgpIHtcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLnRhc2tzKTtcbiAgfVxuXG4gIGFkZCh0YXNrKSB7XG4gICAgY29uc3QgaWQgPSB1dWlkdjQoKTtcbiAgICB0aGlzLnRhc2tzW2lkXSA9IHtcbiAgICAgIGlkLFxuICAgICAgbmFtZTogdGFzay5uYW1lLFxuICAgICAgdG90YWxfaXRlbXM6IHRhc2sudG90YWxfaXRlbXMsXG4gICAgICBjcmVhdGVkX2F0OiBuZXcgRGF0ZSgpLnRvSlNPTigpXG4gICAgfTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cblxuICBnZXQoaWQpIHtcbiAgICByZXR1cm4gdGhpcy50YXNrc1tpZF07XG4gIH1cblxuICAvKiBlc2xpbnQtZGlzYWJsZSBuby11bnVzZWQtdmFycyAqL1xuICByZW1vdmUoaWQsIHJlYXNvbikge1xuICAgIGRlbGV0ZSB0aGlzLnRhc2tzW2lkXTtcbiAgICByZXR1cm4gdGhpcy50YXNrcztcbiAgfVxuXG4gIHVwZGF0ZShpZCwgdXBkYXRlZFRhc2spIHtcbiAgICBjb25zdCB0YXNrID0gdGhpcy50YXNrc1tpZF07XG4gICAgaWYgKHR5cGVvZiB0YXNrICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgY29uc3QgbWVyZ2VkVGFzayA9IHtcbiAgICAgICAgaWQ6IHRhc2suaWQsXG4gICAgICAgIG5hbWU6IHRhc2submFtZSxcbiAgICAgICAgY3JlYXRlZF9hdDogdGFzay5jcmVhdGVkX2F0LFxuICAgICAgICB0b3RhbF9pdGVtczogdXBkYXRlZFRhc2sudG90YWxfaXRlbXMgfHwgdGFzay50b3RhbF9pdGVtcyxcbiAgICAgICAgY29tcGxldGVkX2l0ZW1zOiB1cGRhdGVkVGFzay5jb21wbGV0ZWRfaXRlbXMgfHwgdGFzay5jb21wbGV0ZWRfaXRlbXMsXG4gICAgICAgIHVwZGF0ZWRfYXQ6IG5ldyBEYXRlKCkudG9KU09OKClcbiAgICAgIH07XG4gICAgICB0aGlzLnRhc2tzW2lkXSA9IG1lcmdlZFRhc2s7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnRhc2tzO1xuICB9XG59XG4iLCIvLyAndXNlIHN0cmljdCc7IGlzIGRlZmF1bHQgd2hlbiBFU01cblxuaW1wb3J0IFBvdWNoREIgZnJvbSAnLi9jb25zdHJ1Y3Rvcic7XG5pbXBvcnQgRUUgZnJvbSAnZXZlbnRzJztcbmltcG9ydCB7IGZldGNoIH0gZnJvbSAncG91Y2hkYi1mZXRjaCc7XG5pbXBvcnQgQWN0aXZlVGFza3MgZnJvbSAnLi9hY3RpdmUtdGFza3MnO1xuaW1wb3J0IHsgY3JlYXRlQ2xhc3MgfSBmcm9tICcuL3V0aWxzJztcblxuUG91Y2hEQi5hZGFwdGVycyA9IHt9O1xuUG91Y2hEQi5wcmVmZXJyZWRBZGFwdGVycyA9IFtdO1xuXG5Qb3VjaERCLnByZWZpeCA9ICdfcG91Y2hfJztcblxudmFyIGV2ZW50RW1pdHRlciA9IG5ldyBFRSgpO1xuXG5mdW5jdGlvbiBzZXRVcEV2ZW50RW1pdHRlcihQb3VjaCkge1xuICBPYmplY3Qua2V5cyhFRS5wcm90b3R5cGUpLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgIGlmICh0eXBlb2YgRUUucHJvdG90eXBlW2tleV0gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIFBvdWNoW2tleV0gPSBldmVudEVtaXR0ZXJba2V5XS5iaW5kKGV2ZW50RW1pdHRlcik7XG4gICAgfVxuICB9KTtcblxuICAvLyB0aGVzZSBhcmUgY3JlYXRlZCBpbiBjb25zdHJ1Y3Rvci5qcywgYW5kIGFsbG93IHVzIHRvIG5vdGlmeSBlYWNoIERCIHdpdGhcbiAgLy8gdGhlIHNhbWUgbmFtZSB0aGF0IGl0IHdhcyBkZXN0cm95ZWQsIHZpYSB0aGUgY29uc3RydWN0b3Igb2JqZWN0XG4gIHZhciBkZXN0cnVjdExpc3RlbmVycyA9IFBvdWNoLl9kZXN0cnVjdGlvbkxpc3RlbmVycyA9IG5ldyBNYXAoKTtcblxuICBQb3VjaC5vbigncmVmJywgZnVuY3Rpb24gb25Db25zdHJ1Y3RvclJlZihkYikge1xuICAgIGlmICghZGVzdHJ1Y3RMaXN0ZW5lcnMuaGFzKGRiLm5hbWUpKSB7XG4gICAgICBkZXN0cnVjdExpc3RlbmVycy5zZXQoZGIubmFtZSwgW10pO1xuICAgIH1cbiAgICBkZXN0cnVjdExpc3RlbmVycy5nZXQoZGIubmFtZSkucHVzaChkYik7XG4gIH0pO1xuXG4gIFBvdWNoLm9uKCd1bnJlZicsIGZ1bmN0aW9uIG9uQ29uc3RydWN0b3JVbnJlZihkYikge1xuICAgIGlmICghZGVzdHJ1Y3RMaXN0ZW5lcnMuaGFzKGRiLm5hbWUpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciBkYkxpc3QgPSBkZXN0cnVjdExpc3RlbmVycy5nZXQoZGIubmFtZSk7XG4gICAgdmFyIHBvcyA9IGRiTGlzdC5pbmRleE9mKGRiKTtcbiAgICBpZiAocG9zIDwgMCkge1xuICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZGJMaXN0LnNwbGljZShwb3MsIDEpO1xuICAgIGlmIChkYkxpc3QubGVuZ3RoID4gMSkge1xuICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICAgIGRlc3RydWN0TGlzdGVuZXJzLnNldChkYi5uYW1lLCBkYkxpc3QpO1xuICAgIH0gZWxzZSB7XG4gICAgICBkZXN0cnVjdExpc3RlbmVycy5kZWxldGUoZGIubmFtZSk7XG4gICAgfVxuICB9KTtcblxuICBQb3VjaC5vbignZGVzdHJveWVkJywgZnVuY3Rpb24gb25Db25zdHJ1Y3RvckRlc3Ryb3llZChuYW1lKSB7XG4gICAgaWYgKCFkZXN0cnVjdExpc3RlbmVycy5oYXMobmFtZSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIGRiTGlzdCA9IGRlc3RydWN0TGlzdGVuZXJzLmdldChuYW1lKTtcbiAgICBkZXN0cnVjdExpc3RlbmVycy5kZWxldGUobmFtZSk7XG4gICAgZGJMaXN0LmZvckVhY2goZnVuY3Rpb24gKGRiKSB7XG4gICAgICBkYi5lbWl0KCdkZXN0cm95ZWQnLHRydWUpO1xuICAgIH0pO1xuICB9KTtcbn1cblxuc2V0VXBFdmVudEVtaXR0ZXIoUG91Y2hEQik7XG5cblBvdWNoREIuYWRhcHRlciA9IGZ1bmN0aW9uIChpZCwgb2JqLCBhZGRUb1ByZWZlcnJlZEFkYXB0ZXJzKSB7XG4gIC8qIGlzdGFuYnVsIGlnbm9yZSBlbHNlICovXG4gIGlmIChvYmoudmFsaWQoKSkge1xuICAgIFBvdWNoREIuYWRhcHRlcnNbaWRdID0gb2JqO1xuICAgIGlmIChhZGRUb1ByZWZlcnJlZEFkYXB0ZXJzKSB7XG4gICAgICBQb3VjaERCLnByZWZlcnJlZEFkYXB0ZXJzLnB1c2goaWQpO1xuICAgIH1cbiAgfVxufTtcblxuUG91Y2hEQi5wbHVnaW4gPSBmdW5jdGlvbiAob2JqKSB7XG4gIGlmICh0eXBlb2Ygb2JqID09PSAnZnVuY3Rpb24nKSB7IC8vIGZ1bmN0aW9uIHN0eWxlIGZvciBwbHVnaW5zXG4gICAgb2JqKFBvdWNoREIpO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBvYmogIT09ICdvYmplY3QnIHx8IE9iamVjdC5rZXlzKG9iaikubGVuZ3RoID09PSAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHBsdWdpbjogZ290IFwiJyArIG9iaiArICdcIiwgZXhwZWN0ZWQgYW4gb2JqZWN0IG9yIGEgZnVuY3Rpb24nKTtcbiAgfSBlbHNlIHtcbiAgICBPYmplY3Qua2V5cyhvYmopLmZvckVhY2goZnVuY3Rpb24gKGlkKSB7IC8vIG9iamVjdCBzdHlsZSBmb3IgcGx1Z2luc1xuICAgICAgUG91Y2hEQi5wcm90b3R5cGVbaWRdID0gb2JqW2lkXTtcbiAgICB9KTtcbiAgfVxuICBpZiAodGhpcy5fX2RlZmF1bHRzKSB7XG4gICAgUG91Y2hEQi5fX2RlZmF1bHRzID0gT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5fX2RlZmF1bHRzKTtcbiAgfVxuICByZXR1cm4gUG91Y2hEQjtcbn07XG5cblBvdWNoREIuZGVmYXVsdHMgPSBmdW5jdGlvbiAoZGVmYXVsdE9wdHMpIHtcbiAgbGV0IFBvdWNoV2l0aERlZmF1bHRzID0gY3JlYXRlQ2xhc3MoUG91Y2hEQiwgZnVuY3Rpb24gKG5hbWUsIG9wdHMpIHtcbiAgICBvcHRzID0gb3B0cyB8fCB7fTtcblxuICAgIGlmIChuYW1lICYmIHR5cGVvZiBuYW1lID09PSAnb2JqZWN0Jykge1xuICAgICAgb3B0cyA9IG5hbWU7XG4gICAgICBuYW1lID0gb3B0cy5uYW1lO1xuICAgICAgZGVsZXRlIG9wdHMubmFtZTtcbiAgICB9XG5cbiAgICBvcHRzID0gT2JqZWN0LmFzc2lnbih7fSwgUG91Y2hXaXRoRGVmYXVsdHMuX19kZWZhdWx0cywgb3B0cyk7XG4gICAgUG91Y2hEQi5jYWxsKHRoaXMsIG5hbWUsIG9wdHMpO1xuICB9KTtcblxuICBQb3VjaFdpdGhEZWZhdWx0cy5wcmVmZXJyZWRBZGFwdGVycyA9IFBvdWNoREIucHJlZmVycmVkQWRhcHRlcnMuc2xpY2UoKTtcbiAgT2JqZWN0LmtleXMoUG91Y2hEQikuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgaWYgKCEoa2V5IGluIFBvdWNoV2l0aERlZmF1bHRzKSkge1xuICAgICAgUG91Y2hXaXRoRGVmYXVsdHNba2V5XSA9IFBvdWNoREJba2V5XTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIG1ha2UgZGVmYXVsdCBvcHRpb25zIHRyYW5zaXRpdmVcbiAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3BvdWNoZGIvcG91Y2hkYi9pc3N1ZXMvNTkyMlxuICBQb3VjaFdpdGhEZWZhdWx0cy5fX2RlZmF1bHRzID0gT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5fX2RlZmF1bHRzLCBkZWZhdWx0T3B0cyk7XG5cbiAgcmV0dXJuIFBvdWNoV2l0aERlZmF1bHRzO1xufTtcblxuUG91Y2hEQi5mZXRjaCA9IGZ1bmN0aW9uICh1cmwsIG9wdHMpIHtcbiAgcmV0dXJuIGZldGNoKHVybCwgb3B0cyk7XG59O1xuXG5Qb3VjaERCLnByb3RvdHlwZS5hY3RpdmVUYXNrcyA9IFBvdWNoREIuYWN0aXZlVGFza3MgPSBuZXcgQWN0aXZlVGFza3MoKTtcblxuZXhwb3J0IGRlZmF1bHQgUG91Y2hEQjtcbiIsIi8vIG1hbmFnZWQgYXV0b21hdGljYWxseSBieSBzZXQtdmVyc2lvbi5qc1xuZXhwb3J0IGRlZmF1bHQgXCI3LjAuMC1wcmVyZWxlYXNlXCI7XG4iLCJpbXBvcnQgUG91Y2hEQiBmcm9tICcuL3NldHVwJztcbmltcG9ydCB2ZXJzaW9uIGZyb20gJy4vdmVyc2lvbic7XG5pbXBvcnQgcG91Y2hDaGFuZ2VzRmlsdGVyIGZyb20gJ3BvdWNoZGItY2hhbmdlcy1maWx0ZXInO1xuXG4vLyBUT0RPOiByZW1vdmUgZnJvbSBwb3VjaGRiLWNvcmUgKGJyZWFraW5nKVxuUG91Y2hEQi5wbHVnaW4ocG91Y2hDaGFuZ2VzRmlsdGVyKTtcblxuUG91Y2hEQi52ZXJzaW9uID0gdmVyc2lvbjtcblxuZXhwb3J0IGRlZmF1bHQgUG91Y2hEQjtcbiJdLCJuYW1lcyI6WyJQb3VjaERCIiwibmV4dFRpY2siLCJFdmVudEVtaXR0ZXIiLCJidWxrR2V0U2hpbSIsIkFkYXB0ZXIiLCJ1dWlkdjQiLCJFRSIsInBvdWNoQ2hhbmdlc0ZpbHRlciJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQWVBLFNBQVMsd0JBQXdCLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFO0FBQ2xFO0FBQ0EsRUFBRSxJQUFJO0FBQ04sSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQ2xELEdBQUcsQ0FBQyxPQUFPLENBQUMsRUFBRTtBQUNkLElBQUksY0FBYyxDQUFDLE9BQU8sRUFBRSxtQ0FBbUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUNwRSxHQUFHO0FBQ0gsQ0FBQztBQUNEO0FBQ0EsU0FBUyxhQUFhLENBQUMsR0FBRyxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUU7QUFDNUMsRUFBRSxJQUFJLFVBQVUsR0FBRyxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQ3JDLEVBQUUsSUFBSSxJQUFJLENBQUMsS0FBSyxLQUFLLFVBQVUsRUFBRTtBQUNqQyxJQUFJLFVBQVUsR0FBRyxhQUFhLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQztBQUNqRCxLQUFLLEdBQUcsQ0FBQyxVQUFVLENBQUMsRUFBRSxFQUFFLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ2hELEdBQUc7QUFDSCxFQUFFLElBQUksTUFBTSxHQUFHO0FBQ2YsSUFBSSxFQUFFLEVBQUUsUUFBUSxDQUFDLEVBQUU7QUFDbkIsSUFBSSxPQUFPLEVBQUUsVUFBVTtBQUN2QixJQUFJLEdBQUcsRUFBRSxHQUFHO0FBQ1osR0FBRyxDQUFDO0FBQ0o7QUFDQSxFQUFFLElBQUksU0FBUyxDQUFDLFFBQVEsRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUU7QUFDckMsSUFBSSxNQUFNLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQztBQUMxQixHQUFHO0FBQ0gsRUFBRSxJQUFJLElBQUksQ0FBQyxTQUFTLEVBQUU7QUFDdEIsSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLFVBQVUsR0FBRyxnQkFBZ0IsQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUN2RCxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxNQUFNLEVBQUU7QUFDdkMsTUFBTSxPQUFPLE1BQU0sQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDO0FBQ25DLEtBQUs7QUFDTCxHQUFHO0FBQ0gsRUFBRSxPQUFPLE1BQU0sQ0FBQztBQUNoQixDQUFDO0FBQ0Q7QUFDQSxNQUFNLE9BQU8sU0FBUyxNQUFNLENBQUM7QUFDN0IsRUFBRSxXQUFXLENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUU7QUFDbEMsSUFBSSxLQUFLLEVBQUUsQ0FBQztBQUNaLElBQUksSUFBSSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUM7QUFDakIsSUFBSSxJQUFJLEdBQUcsSUFBSSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7QUFDbkMsSUFBSSxJQUFJLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxDQUFDLEdBQUcsRUFBRSxJQUFJLEtBQUs7QUFDdkQsTUFBTSxJQUFJLEdBQUcsRUFBRTtBQUNmLFFBQVEsSUFBSSxhQUFhLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRTtBQUM5QyxVQUFVLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQ2xDLFNBQVM7QUFDVCxPQUFPLE1BQU07QUFDYixRQUFRLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQ3BDLE9BQU87QUFDUCxNQUFNLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO0FBQ2hDLE1BQU0sRUFBRSxDQUFDLGNBQWMsQ0FBQyxXQUFXLEVBQUUsU0FBUyxDQUFDLENBQUM7QUFDaEQsS0FBSyxDQUFDLENBQUM7QUFDUCxJQUFJLElBQUksUUFBUSxFQUFFO0FBQ2xCLE1BQU0sSUFBSSxDQUFDLEVBQUUsQ0FBQyxVQUFVLEVBQUUsVUFBVSxJQUFJLEVBQUU7QUFDMUMsUUFBUSxRQUFRLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQzdCLE9BQU8sQ0FBQyxDQUFDO0FBQ1QsTUFBTSxJQUFJLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxRQUFRLENBQUMsQ0FBQztBQUNqQyxLQUFLO0FBQ0wsSUFBSSxNQUFNLFNBQVMsR0FBRyxNQUFNO0FBQzVCLE1BQU0sSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO0FBQ3BCLEtBQUssQ0FBQztBQUNOLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsU0FBUyxDQUFDLENBQUM7QUFDcEM7QUFDQSxJQUFJLElBQUksQ0FBQyxRQUFRLEdBQUcsQ0FBQyxNQUFNLEVBQUUsT0FBTyxFQUFFLE9BQU8sS0FBSztBQUNsRDtBQUNBLE1BQU0sSUFBSSxJQUFJLENBQUMsV0FBVyxFQUFFO0FBQzVCLFFBQVEsT0FBTztBQUNmLE9BQU87QUFDUCxNQUFNLHdCQUF3QixDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQy9ELEtBQUssQ0FBQztBQUNOO0FBQ0EsSUFBSSxJQUFJLE9BQU8sR0FBRyxJQUFJLE9BQU8sQ0FBQyxVQUFVLE9BQU8sRUFBRSxNQUFNLEVBQUU7QUFDekQsTUFBTSxJQUFJLENBQUMsUUFBUSxHQUFHLFVBQVUsR0FBRyxFQUFFLEdBQUcsRUFBRTtBQUMxQyxRQUFRLElBQUksR0FBRyxFQUFFO0FBQ2pCLFVBQVUsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3RCLFNBQVMsTUFBTTtBQUNmLFVBQVUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3ZCLFNBQVM7QUFDVCxPQUFPLENBQUM7QUFDUixLQUFLLENBQUMsQ0FBQztBQUNQLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsWUFBWTtBQUNwQyxNQUFNLEVBQUUsQ0FBQyxjQUFjLENBQUMsV0FBVyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0FBQ2hELE1BQU0sSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxNQUFNLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQztBQUNqRCxLQUFLLENBQUMsQ0FBQztBQUNQLElBQUksSUFBSSxDQUFDLElBQUksR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUMzQyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQ25ELElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLE1BQU0sRUFBRTtBQUNoQyxNQUFNLFFBQVEsQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFDN0IsS0FBSyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0FBQ2pCO0FBQ0E7QUFDQTtBQUNBLElBQUksSUFBSSxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsT0FBTyxFQUFFO0FBQy9CLE1BQU0sRUFBRSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxNQUFNLEtBQUs7QUFDdkMsUUFBUSxJQUFJLE1BQU0sRUFBRTtBQUNwQixVQUFVLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDaEMsU0FBUyxNQUFNLElBQUksSUFBSSxDQUFDLFdBQVcsRUFBRTtBQUNyQyxVQUFVLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDOUIsU0FBUyxNQUFNO0FBQ2YsVUFBVSxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3JDLFNBQVM7QUFDVCxPQUFPLENBQUMsQ0FBQztBQUNULEtBQUssTUFBTTtBQUNYLE1BQU0sSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNqQyxLQUFLO0FBQ0wsR0FBRztBQUNIO0FBQ0EsRUFBRSxNQUFNLEdBQUc7QUFDWCxJQUFJLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDO0FBQzVCLElBQUksSUFBSSxJQUFJLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxPQUFPLEVBQUU7QUFDbkMsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQzFCLEtBQUs7QUFDTCxHQUFHO0FBQ0g7QUFDQSxFQUFFLGVBQWUsQ0FBQyxJQUFJLEVBQUU7QUFDeEIsSUFBSSxJQUFJLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDO0FBQ2pDO0FBQ0E7QUFDQSxJQUFJLElBQUlBLFNBQU8sQ0FBQyxvQkFBb0IsRUFBRTtBQUN0QyxNQUFNQSxTQUFPLENBQUMsb0JBQW9CLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxDQUFDLEdBQUcsS0FBSztBQUMzRCxRQUFRLElBQUksR0FBRyxFQUFFO0FBQ2pCLFVBQVUsT0FBTyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDL0IsU0FBUztBQUNULFFBQVEsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUM3QixPQUFPLENBQUMsQ0FBQztBQUNULEtBQUssTUFBTTtBQUNYLE1BQU0sSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUMzQixLQUFLO0FBQ0wsR0FBRztBQUNIO0FBQ0EsRUFBRSxTQUFTLENBQUMsSUFBSSxFQUFFO0FBQ2xCLElBQUksSUFBSSxRQUFRLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQztBQUNqQztBQUNBLElBQUksSUFBSSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUN2QixJQUFJLElBQUksTUFBTSxJQUFJLElBQUksSUFBSSxFQUFFLFlBQVksSUFBSSxJQUFJLENBQUMsRUFBRTtBQUNuRCxNQUFNLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQztBQUNsQyxLQUFLO0FBQ0wsSUFBSSxJQUFJLENBQUMsYUFBYSxHQUFHLGFBQWEsQ0FBQztBQUN2QztBQUNBLElBQUksSUFBSSxJQUFJLENBQUMsS0FBSyxLQUFLLFFBQVEsRUFBRTtBQUNqQyxNQUFNLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO0FBQ3pCLEtBQUs7QUFDTCxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFO0FBQ3JCLE1BQU0sSUFBSSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUM7QUFDckIsS0FBSztBQUNMLElBQUksSUFBSSxJQUFJLENBQUMsS0FBSyxLQUFLLEtBQUssRUFBRTtBQUM5QixNQUFNLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxLQUFLO0FBQ3BDO0FBQ0EsUUFBUSxJQUFJLElBQUksQ0FBQyxXQUFXLEVBQUU7QUFDOUIsVUFBVSxRQUFRLENBQUMsSUFBSSxFQUFFLENBQUMsTUFBTSxFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUM7QUFDaEQsVUFBVSxPQUFPO0FBQ2pCLFNBQVM7QUFDVCxRQUFRLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQztBQUNyQyxRQUFRLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDN0IsT0FBTyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0FBQ25CLE1BQU0sT0FBTztBQUNiLEtBQUs7QUFDTDtBQUNBO0FBQ0EsSUFBSSxJQUFJQSxTQUFPLENBQUMsb0JBQW9CLEVBQUU7QUFDdEMsTUFBTUEsU0FBTyxDQUFDLG9CQUFvQixDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNuRCxNQUFNLElBQUlBLFNBQU8sQ0FBQyxvQkFBb0IsQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFO0FBQ2pFLFFBQVEsT0FBT0EsU0FBTyxDQUFDLG9CQUFvQixDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDL0QsT0FBTztBQUNQLEtBQUssTUFBTTtBQUNYLE1BQU0sQ0FBQyxTQUFTLEVBQUUsUUFBUSxFQUFFLFVBQVUsRUFBRSxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBVSxHQUFHLEVBQUU7QUFDdkUsUUFBUSxJQUFJLEdBQUcsSUFBSSxJQUFJLEVBQUU7QUFDekIsVUFBVSxjQUFjLENBQUMsTUFBTTtBQUMvQixZQUFZLE9BQU8sR0FBRyxHQUFHLEdBQUcsK0NBQStDO0FBQzNFLFlBQVksNERBQTREO0FBQ3hFLFlBQVksNkRBQTZEO0FBQ3pFLFdBQVcsQ0FBQztBQUNaLFNBQVM7QUFDVCxPQUFPLENBQUMsQ0FBQztBQUNULEtBQUs7QUFDTDtBQUNBLElBQUksSUFBSSxFQUFFLFlBQVksSUFBSSxJQUFJLENBQUMsRUFBRTtBQUNqQyxNQUFNLElBQUksQ0FBQyxVQUFVLEdBQUcsS0FBSyxDQUFDO0FBQzlCLEtBQUs7QUFDTDtBQUNBO0FBQ0EsSUFBSSxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDO0FBQ25ELElBQUksSUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7QUFDN0IsSUFBSSxJQUFJLFVBQVUsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUM1QztBQUNBLElBQUksSUFBSSxVQUFVLElBQUksT0FBTyxVQUFVLENBQUMsTUFBTSxLQUFLLFVBQVUsRUFBRTtBQUMvRCxNQUFNLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUM7QUFDakMsTUFBTSxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsR0FBRyxJQUFJLEtBQUs7QUFDakMsUUFBUSxVQUFVLENBQUMsTUFBTSxFQUFFLENBQUM7QUFDNUIsUUFBUSxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztBQUNqQyxPQUFPLENBQUM7QUFDUixLQUFLO0FBQ0wsR0FBRztBQUNIOztBQzNLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVMsT0FBTyxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUU7QUFDOUIsRUFBRSxPQUFPLElBQUksR0FBRyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEdBQUcsSUFBSSxHQUFHLEtBQUssR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ2xELENBQUM7QUFDRDtBQUNBO0FBQ0E7QUFDQSxTQUFTLFNBQVMsQ0FBQyxRQUFRLEVBQUUsS0FBSyxFQUFFO0FBQ3BDLEVBQUUsT0FBTyxVQUFVLEdBQUcsRUFBRSxPQUFPLEVBQUU7QUFDakMsSUFBSSxJQUFJLEdBQUcsS0FBSyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxFQUFFO0FBQ2pELE1BQU0sR0FBRyxHQUFHLEdBQUcsSUFBSSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDOUIsTUFBTSxHQUFHLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztBQUN4QixNQUFNLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUNwQixLQUFLLE1BQU07QUFDWCxNQUFNLFFBQVEsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLE1BQU0sR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksT0FBTyxDQUFDLENBQUM7QUFDN0QsS0FBSztBQUNMLEdBQUcsQ0FBQztBQUNKLENBQUM7QUFDRDtBQUNBO0FBQ0EsU0FBUyxTQUFTLENBQUMsSUFBSSxFQUFFO0FBQ3pCLEVBQUUsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7QUFDeEMsSUFBSSxJQUFJLEdBQUcsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDdEIsSUFBSSxJQUFJLEdBQUcsQ0FBQyxRQUFRLEVBQUU7QUFDdEIsTUFBTSxPQUFPLEdBQUcsQ0FBQyxZQUFZLENBQUM7QUFDOUIsS0FBSyxNQUFNLElBQUksR0FBRyxDQUFDLFlBQVksRUFBRTtBQUNqQztBQUNBLE1BQU0sSUFBSSxJQUFJLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUM7QUFDL0MsTUFBTSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtBQUM1QyxRQUFRLElBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUMxQixRQUFRLEdBQUcsQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDO0FBQzFELFVBQVUsQ0FBQyxNQUFNLEVBQUUsUUFBUSxFQUFFLGNBQWMsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUM7QUFDMUUsT0FBTztBQUNQLEtBQUs7QUFDTCxHQUFHO0FBQ0gsQ0FBQztBQUNEO0FBQ0E7QUFDQSxTQUFTLGtCQUFrQixDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUU7QUFDbEMsRUFBRSxJQUFJLFNBQVMsR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDeEMsRUFBRSxJQUFJLFNBQVMsS0FBSyxDQUFDLEVBQUU7QUFDdkIsSUFBSSxPQUFPLFNBQVMsQ0FBQztBQUNyQixHQUFHO0FBQ0gsRUFBRSxJQUFJLE1BQU0sR0FBRyxDQUFDLENBQUMsVUFBVSxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQztBQUNyRCxFQUFFLElBQUksTUFBTSxHQUFHLENBQUMsQ0FBQyxVQUFVLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDO0FBQ3JELEVBQUUsT0FBTyxPQUFPLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQ2pDLENBQUM7QUFDRDtBQUNBO0FBQ0E7QUFDQSxTQUFTLGFBQWEsQ0FBQyxJQUFJLEVBQUU7QUFDN0IsRUFBRSxJQUFJLE1BQU0sR0FBRyxFQUFFLENBQUM7QUFDbEIsRUFBRSxJQUFJLEtBQUssR0FBRyxFQUFFLENBQUM7QUFDakIsRUFBRSxlQUFlLENBQUMsSUFBSSxFQUFFLFVBQVUsTUFBTSxFQUFFLEdBQUcsRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFO0FBQ3pELElBQUksSUFBSSxHQUFHLEdBQUcsR0FBRyxHQUFHLEdBQUcsR0FBRyxFQUFFLENBQUM7QUFDN0IsSUFBSSxJQUFJLE1BQU0sRUFBRTtBQUNoQixNQUFNLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDdEIsS0FBSztBQUNMLElBQUksSUFBSSxJQUFJLEtBQUssU0FBUyxFQUFFO0FBQzVCLE1BQU0sS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDeEMsS0FBSztBQUNMLElBQUksT0FBTyxHQUFHLENBQUM7QUFDZixHQUFHLENBQUMsQ0FBQztBQUNMO0FBQ0EsRUFBRSxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7QUFDbEIsRUFBRSxLQUFLLENBQUMsT0FBTyxDQUFDLFVBQVUsSUFBSSxFQUFFO0FBQ2hDLElBQUksSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLFNBQVMsRUFBRTtBQUN6QyxNQUFNLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDOUMsS0FBSyxNQUFNO0FBQ1gsTUFBTSxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQzNFLEtBQUs7QUFDTCxHQUFHLENBQUMsQ0FBQztBQUNMLEVBQUUsT0FBTyxNQUFNLENBQUM7QUFDaEIsQ0FBQztBQUNEO0FBQ0EsU0FBUyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUU7QUFDaEMsRUFBRSxJQUFJLElBQUksSUFBSSxDQUFDLE9BQU8sSUFBSSxJQUFJO0FBQzlCLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7QUFDdEQsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO0FBQzdELEVBQUUsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7QUFDbkIsRUFBRSxJQUFJLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQztBQUNoQixFQUFFLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQztBQUNwQixFQUFFLElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRTtBQUN2QixJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUNuQixJQUFJLElBQUksQ0FBQyxVQUFVLEdBQUcsS0FBSyxDQUFDO0FBQzVCLEdBQUc7QUFDSCxDQUFDO0FBQ0Q7QUFDQTtBQUNBO0FBQ0EsU0FBUyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUU7QUFDaEMsRUFBRSxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDdEMsRUFBRSxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO0FBQ3ZCLEVBQUUsSUFBSSxRQUFRLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQztBQUMvQixFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxLQUFLLENBQUMsWUFBWTtBQUNsRCxJQUFJLE9BQU8sS0FBSyxDQUFDO0FBQ2pCLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLEdBQUcsRUFBRTtBQUN6QixJQUFJLElBQUksR0FBRyxJQUFJLEdBQUcsQ0FBQyxRQUFRLEVBQUU7QUFDN0IsTUFBTSxJQUFJLENBQUMsUUFBUSxHQUFHLEdBQUcsQ0FBQyxRQUFRLENBQUM7QUFDbkMsS0FBSztBQUNMLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsVUFBVSxHQUFHLEVBQUUsR0FBRyxFQUFFO0FBQzVDO0FBQ0EsTUFBTSxJQUFJLEdBQUcsRUFBRTtBQUNmLFFBQVEsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3RCLE9BQU8sTUFBTTtBQUNiLFFBQVEsUUFBUSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztBQUM1QixPQUFPO0FBQ1AsTUFBTUMsU0FBUSxDQUFDLFlBQVk7QUFDM0IsUUFBUSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxFQUFFLENBQUM7QUFDdEMsUUFBUSxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLEVBQUU7QUFDMUMsVUFBVSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNqQyxTQUFTO0FBQ1QsT0FBTyxDQUFDLENBQUM7QUFDVCxLQUFLLENBQUMsQ0FBQztBQUNQLEdBQUcsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUNEO0FBQ0EsU0FBUyxjQUFjLENBQUMsRUFBRSxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUU7QUFDeEMsRUFBRSxPQUFPLEVBQUUsQ0FBQyxHQUFHLENBQUMsZUFBZSxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsR0FBRyxFQUFFO0FBQ3JELElBQUksTUFBTSxRQUFRLEdBQUcsR0FBRyxDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUM7QUFDdEMsSUFBSSxHQUFHLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQztBQUNwQixNQUFNLEtBQUs7QUFDWCxNQUFNLEdBQUc7QUFDVCxNQUFNLFFBQVE7QUFDZCxLQUFLLENBQUMsQ0FBQztBQUNQLElBQUksSUFBSSxHQUFHLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsa0JBQWtCLEVBQUU7QUFDckQsTUFBTSxHQUFHLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUM7QUFDeEUsS0FBSztBQUNMLElBQUksR0FBRyxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7QUFDNUIsSUFBSSxPQUFPLEdBQUcsQ0FBQztBQUNmLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxVQUFVLEdBQUcsRUFBRTtBQUMxQixJQUFJLElBQUksR0FBRyxDQUFDLE1BQU0sS0FBSyxHQUFHLEVBQUU7QUFDNUIsTUFBTSxNQUFNLEdBQUcsQ0FBQztBQUNoQixLQUFLO0FBQ0wsSUFBSSxPQUFPO0FBQ1gsTUFBTSxHQUFHLEVBQUUsZUFBZTtBQUMxQixNQUFNLE1BQU0sRUFBRSxDQUFDO0FBQ2YsUUFBUSxLQUFLO0FBQ2IsUUFBUSxHQUFHO0FBQ1gsUUFBUSxRQUFRLEVBQUUsQ0FBQztBQUNuQixPQUFPLENBQUM7QUFDUixNQUFNLFFBQVEsRUFBRSxDQUFDO0FBQ2pCLEtBQUssQ0FBQztBQUNOLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLEdBQUcsRUFBRTtBQUN6QixJQUFJLE9BQU8sRUFBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUN2QixHQUFHLENBQUMsQ0FBQztBQUNMLENBQUM7QUFDRDtBQUNBLFNBQVMsbUJBQW1CLENBQUMsSUFBSSxFQUFFO0FBQ25DLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsRUFBRTtBQUM5QixJQUFJLE9BQU8sSUFBSSxHQUFHLDhDQUE4QztBQUNoRSxNQUFNLCtCQUErQixDQUFDO0FBQ3RDLEdBQUc7QUFDSCxFQUFFLE9BQU8sS0FBSyxDQUFDO0FBQ2YsQ0FBQztBQUNEO0FBQ0EsTUFBTSxlQUFlLFNBQVNDLFFBQVksQ0FBQztBQUMzQyxFQUFFLE1BQU0sR0FBRztBQUNYLElBQUksSUFBSSxDQUFDLElBQUksR0FBRyxVQUFVLENBQUMsTUFBTSxFQUFFLFVBQVUsR0FBRyxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUU7QUFDbEUsTUFBTSxJQUFJLE9BQU8sSUFBSSxLQUFLLFVBQVUsRUFBRTtBQUN0QyxRQUFRLFFBQVEsR0FBRyxJQUFJLENBQUM7QUFDeEIsUUFBUSxJQUFJLEdBQUcsRUFBRSxDQUFDO0FBQ2xCLE9BQU87QUFDUCxNQUFNLElBQUksT0FBTyxHQUFHLEtBQUssUUFBUSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUU7QUFDekQsUUFBUSxPQUFPLFFBQVEsQ0FBQyxXQUFXLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQztBQUNwRCxPQUFPO0FBQ1AsTUFBTSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsU0FBUyxDQUFDLFFBQVEsRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUN2RSxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDbEI7QUFDQSxJQUFJLElBQUksQ0FBQyxHQUFHLEdBQUcsVUFBVSxDQUFDLEtBQUssRUFBRSxVQUFVLEdBQUcsRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFO0FBQzFELE1BQU0sSUFBSSxPQUFPLElBQUksS0FBSyxVQUFVLEVBQUU7QUFDdEMsUUFBUSxFQUFFLEdBQUcsSUFBSSxDQUFDO0FBQ2xCLFFBQVEsSUFBSSxHQUFHLEVBQUUsQ0FBQztBQUNsQixPQUFPO0FBQ1AsTUFBTSxJQUFJLE9BQU8sR0FBRyxLQUFLLFFBQVEsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFO0FBQ3pELFFBQVEsT0FBTyxFQUFFLENBQUMsV0FBVyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUM7QUFDOUMsT0FBTztBQUNQLE1BQU0sY0FBYyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUM5QixNQUFNLElBQUksU0FBUyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxPQUFPLElBQUksQ0FBQyxTQUFTLEtBQUssVUFBVSxFQUFFO0FBQ3RFLFFBQVEsSUFBSSxHQUFHLENBQUMsUUFBUSxFQUFFO0FBQzFCLFVBQVUsT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztBQUM1QyxTQUFTLE1BQU07QUFDZixVQUFVLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFDekMsU0FBUztBQUNULE9BQU87QUFDUDtBQUNBLE1BQU0sTUFBTSxNQUFNLEdBQUcsQ0FBQyxJQUFJLEtBQUs7QUFDL0IsUUFBUSxJQUFJLE9BQU8sSUFBSSxDQUFDLElBQUksS0FBSyxVQUFVLElBQUksSUFBSSxDQUFDLFNBQVMsS0FBSyxLQUFLLEVBQUU7QUFDekUsVUFBVSxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDckMsU0FBUyxNQUFNO0FBQ2YsVUFBVSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsU0FBUyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUN2RSxTQUFTO0FBQ1QsT0FBTyxDQUFDO0FBQ1I7QUFDQSxNQUFNLElBQUksSUFBSSxDQUFDLEtBQUssSUFBSSxHQUFHLENBQUMsSUFBSSxFQUFFO0FBQ2xDLFFBQVEsb0NBQW9DLEVBQUUsQ0FBQztBQUMvQyxRQUFRLE1BQU0sQ0FBQyxVQUFVLEdBQUcsRUFBRTtBQUM5QixVQUFVLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRSxHQUFHLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDM0UsVUFBVSxFQUFFLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQzFCLFNBQVMsQ0FBQyxDQUFDO0FBQ1gsT0FBTyxNQUFNO0FBQ2IsUUFBUSxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDbkIsT0FBTztBQUNQO0FBQ0EsTUFBTSxTQUFTLG9DQUFvQyxHQUFHO0FBQ3RELFFBQVEsSUFBSSxLQUFLLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDeEMsUUFBUSxJQUFJLFFBQVEsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDaEMsUUFBUSxJQUFJLFNBQVMsR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0FBQy9DO0FBQ0EsUUFBUSxJQUFJLFNBQVMsR0FBRyxTQUFTLEdBQUcsQ0FBQyxDQUFDO0FBQ3RDLFFBQVEsSUFBSSxRQUFRLEdBQUcsR0FBRyxFQUFFLENBQUM7QUFDN0I7QUFDQSxRQUFRLEdBQUcsQ0FBQyxVQUFVLEdBQUc7QUFDekIsVUFBVSxLQUFLLEVBQUUsU0FBUztBQUMxQixVQUFVLEdBQUcsRUFBRSxDQUFDLFFBQVEsRUFBRSxRQUFRLENBQUM7QUFDbkMsU0FBUyxDQUFDO0FBQ1YsUUFBUSxHQUFHLENBQUMsSUFBSSxHQUFHLFNBQVMsR0FBRyxHQUFHLEdBQUcsUUFBUSxDQUFDO0FBQzlDLFFBQVEsSUFBSSxDQUFDLFNBQVMsR0FBRyxLQUFLLENBQUM7QUFDL0IsT0FBTztBQUNQLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNsQjtBQUNBLElBQUksSUFBSSxDQUFDLGFBQWEsR0FBRyxVQUFVLENBQUMsZUFBZSxFQUFFLFVBQVUsS0FBSyxFQUFFLFlBQVksRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRTtBQUNyRyxNQUFNLElBQUksR0FBRyxHQUFHLElBQUksQ0FBQztBQUNyQixNQUFNLElBQUksT0FBTyxJQUFJLEtBQUssVUFBVSxFQUFFO0FBQ3RDLFFBQVEsSUFBSSxHQUFHLElBQUksQ0FBQztBQUNwQixRQUFRLElBQUksR0FBRyxHQUFHLENBQUM7QUFDbkIsUUFBUSxHQUFHLEdBQUcsSUFBSSxDQUFDO0FBQ25CLE9BQU87QUFDUDtBQUNBO0FBQ0EsTUFBTSxJQUFJLE9BQU8sSUFBSSxLQUFLLFdBQVcsRUFBRTtBQUN2QyxRQUFRLElBQUksR0FBRyxJQUFJLENBQUM7QUFDcEIsUUFBUSxJQUFJLEdBQUcsR0FBRyxDQUFDO0FBQ25CLFFBQVEsR0FBRyxHQUFHLElBQUksQ0FBQztBQUNuQixPQUFPO0FBQ1AsTUFBTSxJQUFJLENBQUMsSUFBSSxFQUFFO0FBQ2pCLFFBQVEsY0FBYyxDQUFDLE1BQU0sRUFBRSxZQUFZLEVBQUUsWUFBWSxFQUFFLGFBQWEsRUFBRSxLQUFLLEVBQUUseUJBQXlCLENBQUMsQ0FBQztBQUM1RyxPQUFPO0FBQ1A7QUFDQSxNQUFNLFNBQVMsZ0JBQWdCLENBQUMsR0FBRyxFQUFFO0FBQ3JDLFFBQVEsSUFBSSxVQUFVLEdBQUcsTUFBTSxJQUFJLEdBQUcsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDcEUsUUFBUSxHQUFHLENBQUMsWUFBWSxHQUFHLEdBQUcsQ0FBQyxZQUFZLElBQUksRUFBRSxDQUFDO0FBQ2xELFFBQVEsR0FBRyxDQUFDLFlBQVksQ0FBQyxZQUFZLENBQUMsR0FBRztBQUN6QyxVQUFVLFlBQVksRUFBRSxJQUFJO0FBQzVCLFVBQVUsSUFBSSxFQUFFLElBQUk7QUFDcEIsVUFBVSxNQUFNLEVBQUUsRUFBRSxVQUFVO0FBQzlCLFNBQVMsQ0FBQztBQUNWLFFBQVEsT0FBTyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQzVCLE9BQU87QUFDUDtBQUNBLE1BQU0sT0FBTyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLEdBQUcsRUFBRTtBQUNoRCxRQUFRLElBQUksR0FBRyxDQUFDLElBQUksS0FBSyxHQUFHLEVBQUU7QUFDOUIsVUFBVSxNQUFNLFdBQVcsQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUMxQyxTQUFTO0FBQ1Q7QUFDQSxRQUFRLE9BQU8sZ0JBQWdCLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDckMsT0FBTyxFQUFFLFVBQVUsR0FBRyxFQUFFO0FBQ3hCO0FBQ0E7QUFDQSxRQUFRLElBQUksR0FBRyxDQUFDLE1BQU0sS0FBSyxXQUFXLENBQUMsT0FBTyxFQUFFO0FBQ2hELFVBQVUsT0FBTyxnQkFBZ0IsQ0FBQyxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDO0FBQ2hELFNBQVMsTUFBTTtBQUNmLFVBQVUsTUFBTSxHQUFHLENBQUM7QUFDcEIsU0FBUztBQUNULE9BQU8sQ0FBQyxDQUFDO0FBQ1QsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ2xCO0FBQ0EsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsVUFBVSxDQUFDLGtCQUFrQixFQUFFLFVBQVUsS0FBSyxFQUFFLFlBQVksRUFBRSxHQUFHLEVBQUUsUUFBUSxFQUFFO0FBQ3pHLE1BQU0sSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxLQUFLO0FBQ3BDO0FBQ0EsUUFBUSxJQUFJLEdBQUcsRUFBRTtBQUNqQixVQUFVLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUN4QixVQUFVLE9BQU87QUFDakIsU0FBUztBQUNULFFBQVEsSUFBSSxHQUFHLENBQUMsSUFBSSxLQUFLLEdBQUcsRUFBRTtBQUM5QixVQUFVLFFBQVEsQ0FBQyxXQUFXLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztBQUM5QyxVQUFVLE9BQU87QUFDakIsU0FBUztBQUNUO0FBQ0EsUUFBUSxJQUFJLENBQUMsR0FBRyxDQUFDLFlBQVksRUFBRTtBQUMvQixVQUFVLE9BQU8sUUFBUSxFQUFFLENBQUM7QUFDNUIsU0FBUztBQUNULFFBQVEsT0FBTyxHQUFHLENBQUMsWUFBWSxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBQzlDLFFBQVEsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO0FBQ3hELFVBQVUsT0FBTyxHQUFHLENBQUMsWUFBWSxDQUFDO0FBQ2xDLFNBQVM7QUFDVCxRQUFRLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0FBQ2hDLE9BQU8sQ0FBQyxDQUFDO0FBQ1QsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ2xCO0FBQ0EsSUFBSSxJQUFJLENBQUMsTUFBTSxHQUFHLFVBQVUsQ0FBQyxRQUFRLEVBQUUsVUFBVSxPQUFPLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUU7QUFDckYsTUFBTSxJQUFJLEdBQUcsQ0FBQztBQUNkLE1BQU0sSUFBSSxPQUFPLFNBQVMsS0FBSyxRQUFRLEVBQUU7QUFDekM7QUFDQSxRQUFRLEdBQUcsR0FBRztBQUNkLFVBQVUsR0FBRyxFQUFFLE9BQU87QUFDdEIsVUFBVSxJQUFJLEVBQUUsU0FBUztBQUN6QixTQUFTLENBQUM7QUFDVixRQUFRLElBQUksT0FBTyxJQUFJLEtBQUssVUFBVSxFQUFFO0FBQ3hDLFVBQVUsUUFBUSxHQUFHLElBQUksQ0FBQztBQUMxQixVQUFVLElBQUksR0FBRyxFQUFFLENBQUM7QUFDcEIsU0FBUztBQUNULE9BQU8sTUFBTTtBQUNiO0FBQ0EsUUFBUSxHQUFHLEdBQUcsT0FBTyxDQUFDO0FBQ3RCLFFBQVEsSUFBSSxPQUFPLFNBQVMsS0FBSyxVQUFVLEVBQUU7QUFDN0MsVUFBVSxRQUFRLEdBQUcsU0FBUyxDQUFDO0FBQy9CLFVBQVUsSUFBSSxHQUFHLEVBQUUsQ0FBQztBQUNwQixTQUFTLE1BQU07QUFDZixVQUFVLFFBQVEsR0FBRyxJQUFJLENBQUM7QUFDMUIsVUFBVSxJQUFJLEdBQUcsU0FBUyxDQUFDO0FBQzNCLFNBQVM7QUFDVCxPQUFPO0FBQ1AsTUFBTSxJQUFJLEdBQUcsSUFBSSxJQUFJLEVBQUUsQ0FBQztBQUN4QixNQUFNLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDO0FBQzdCLE1BQU0sSUFBSSxNQUFNLEdBQUcsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLEdBQUcsRUFBRSxJQUFJLEdBQUcsR0FBRyxDQUFDLElBQUksSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUNoRSxNQUFNLE1BQU0sQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDO0FBQzdCLE1BQU0sSUFBSSxTQUFTLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLE9BQU8sSUFBSSxDQUFDLFlBQVksS0FBSyxVQUFVLEVBQUU7QUFDNUUsUUFBUSxPQUFPLElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0FBQ2hELE9BQU87QUFDUCxNQUFNLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxTQUFTLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQzdFLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNsQjtBQUNBLElBQUksSUFBSSxDQUFDLFFBQVEsR0FBRyxVQUFVLENBQUMsVUFBVSxFQUFFLFVBQVUsR0FBRyxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUU7QUFDMUUsTUFBTSxJQUFJLE9BQU8sSUFBSSxLQUFLLFVBQVUsRUFBRTtBQUN0QyxRQUFRLFFBQVEsR0FBRyxJQUFJLENBQUM7QUFDeEIsUUFBUSxJQUFJLEdBQUcsRUFBRSxDQUFDO0FBQ2xCLE9BQU87QUFDUCxNQUFNLElBQUksR0FBRyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDakM7QUFDQSxNQUFNLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFO0FBQ3ZCLFFBQVEsT0FBTyxRQUFRLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO0FBQ2xDLE9BQU87QUFDUDtBQUNBLE1BQU0sSUFBSSxLQUFLLEdBQUcsQ0FBQyxDQUFDO0FBQ3BCLE1BQU0sSUFBSSxPQUFPLEdBQUcsSUFBSSxHQUFHLEVBQUUsQ0FBQztBQUM5QjtBQUNBLE1BQU0sU0FBUyxZQUFZLENBQUMsRUFBRSxFQUFFLEtBQUssRUFBRTtBQUN2QyxRQUFRLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFO0FBQzlCLFVBQVUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUN6QyxTQUFTO0FBQ1QsUUFBUSxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDNUMsT0FBTztBQUNQO0FBQ0EsTUFBTSxTQUFTLFVBQVUsQ0FBQyxFQUFFLEVBQUUsUUFBUSxFQUFFO0FBQ3hDO0FBQ0EsUUFBUSxJQUFJLFlBQVksR0FBRyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzVDLFFBQVEsZUFBZSxDQUFDLFFBQVEsRUFBRSxVQUFVLE1BQU0sRUFBRSxHQUFHLEVBQUUsT0FBTyxFQUFFLEdBQUc7QUFDckUsVUFBVSxJQUFJLEVBQUU7QUFDaEIsWUFBWSxJQUFJLEdBQUcsR0FBRyxHQUFHLEdBQUcsR0FBRyxHQUFHLE9BQU8sQ0FBQztBQUMxQyxZQUFZLElBQUksR0FBRyxHQUFHLFlBQVksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDaEQsWUFBWSxJQUFJLEdBQUcsS0FBSyxDQUFDLENBQUMsRUFBRTtBQUM1QixjQUFjLE9BQU87QUFDckIsYUFBYTtBQUNiO0FBQ0EsWUFBWSxZQUFZLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUN4QztBQUNBLFlBQVksSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLFdBQVcsRUFBRTtBQUM3QyxjQUFjLFlBQVksQ0FBQyxFQUFFLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDcEMsYUFBYTtBQUNiLFdBQVcsQ0FBQyxDQUFDO0FBQ2I7QUFDQTtBQUNBO0FBQ0EsUUFBUSxZQUFZLENBQUMsT0FBTyxDQUFDLFVBQVUsR0FBRyxFQUFFO0FBQzVDLFVBQVUsWUFBWSxDQUFDLEVBQUUsRUFBRSxHQUFHLENBQUMsQ0FBQztBQUNoQyxTQUFTLENBQUMsQ0FBQztBQUNYLE9BQU87QUFDUDtBQUNBLE1BQU0sR0FBRyxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsRUFBRTtBQUM1QixRQUFRLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLEVBQUUsVUFBVSxHQUFHLEVBQUUsUUFBUSxFQUFFO0FBQzNELFVBQVUsSUFBSSxHQUFHLElBQUksR0FBRyxDQUFDLE1BQU0sS0FBSyxHQUFHLElBQUksR0FBRyxDQUFDLE9BQU8sS0FBSyxTQUFTLEVBQUU7QUFDdEUsWUFBWSxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxDQUFDLE9BQU8sRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2hELFdBQVcsTUFBTSxJQUFJLEdBQUcsRUFBRTtBQUMxQjtBQUNBLFlBQVksT0FBTyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDakMsV0FBVyxNQUFNO0FBQ2pCLFlBQVksVUFBVSxDQUFDLEVBQUUsRUFBRSxRQUFRLENBQUMsQ0FBQztBQUNyQyxXQUFXO0FBQ1g7QUFDQSxVQUFVLElBQUksRUFBRSxLQUFLLEtBQUssR0FBRyxDQUFDLE1BQU0sRUFBRTtBQUN0QztBQUNBLFlBQVksSUFBSSxVQUFVLEdBQUcsRUFBRSxDQUFDO0FBQ2hDLFlBQVksT0FBTyxDQUFDLE9BQU8sQ0FBQyxVQUFVLEtBQUssRUFBRSxHQUFHLEVBQUU7QUFDbEQsY0FBYyxVQUFVLENBQUMsR0FBRyxDQUFDLEdBQUcsS0FBSyxDQUFDO0FBQ3RDLGFBQWEsQ0FBQyxDQUFDO0FBQ2YsWUFBWSxPQUFPLFFBQVEsQ0FBQyxJQUFJLEVBQUUsVUFBVSxDQUFDLENBQUM7QUFDOUMsV0FBVztBQUNYLFNBQVMsQ0FBQyxDQUFDO0FBQ1gsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQ2YsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ2xCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFJLElBQUksQ0FBQyxPQUFPLEdBQUcsVUFBVSxDQUFDLFNBQVMsRUFBRSxVQUFVLElBQUksRUFBRSxRQUFRLEVBQUU7QUFDbkUsTUFBTUMsT0FBVyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDeEMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ2xCO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBSSxJQUFJLENBQUMsZUFBZSxHQUFHLFVBQVUsQ0FBQyxpQkFBaUIsRUFBRSxVQUFVLEtBQUssRUFBRSxTQUFTLEVBQUUsUUFBUSxFQUFFO0FBQy9GLE1BQU0sSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssRUFBRSxDQUFDLEdBQUcsRUFBRSxPQUFPLEtBQUs7QUFDckQ7QUFDQSxRQUFRLElBQUksR0FBRyxFQUFFO0FBQ2pCLFVBQVUsT0FBTyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDL0IsU0FBUztBQUNULFFBQVEsSUFBSSxNQUFNLEdBQUcsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQzVDLFFBQVEsSUFBSSxVQUFVLEdBQUcsRUFBRSxDQUFDO0FBQzVCLFFBQVEsSUFBSSxJQUFJLEdBQUcsRUFBRSxDQUFDO0FBQ3RCLFFBQVEsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBVSxHQUFHLEVBQUU7QUFDbkQsVUFBVSxJQUFJLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxTQUFTLEVBQUU7QUFDdkMsWUFBWSxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ2pDLFdBQVc7QUFDWCxTQUFTLENBQUMsQ0FBQztBQUNYO0FBQ0EsUUFBUSxlQUFlLENBQUMsT0FBTyxFQUFFLFVBQVUsTUFBTSxFQUFFLEdBQUcsRUFBRSxPQUFPLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRTtBQUM1RSxVQUFVLElBQUksR0FBRyxHQUFHLEdBQUcsR0FBRyxHQUFHLEdBQUcsT0FBTyxDQUFDO0FBQ3hDLFVBQVUsSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLFdBQVcsSUFBSSxVQUFVLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFO0FBQzdFLFlBQVksSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUMzQixXQUFXO0FBQ1gsU0FBUyxDQUFDLENBQUM7QUFDWCxRQUFRLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQztBQUNsRCxPQUFPLENBQUMsQ0FBQztBQUNULEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNsQjtBQUNBO0FBQ0E7QUFDQSxJQUFJLElBQUksQ0FBQyxPQUFPLEdBQUcsVUFBVSxDQUFDLFNBQVMsRUFBRSxVQUFVLElBQUksRUFBRSxRQUFRLEVBQUU7QUFDbkUsTUFBTSxJQUFJLE9BQU8sSUFBSSxLQUFLLFVBQVUsRUFBRTtBQUN0QyxRQUFRLFFBQVEsR0FBRyxJQUFJLENBQUM7QUFDeEIsUUFBUSxJQUFJLEdBQUcsRUFBRSxDQUFDO0FBQ2xCLE9BQU87QUFDUDtBQUNBLE1BQU0sSUFBSSxHQUFHLElBQUksSUFBSSxFQUFFLENBQUM7QUFDeEI7QUFDQSxNQUFNLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLElBQUksRUFBRSxDQUFDO0FBQzFELE1BQU0sSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUM7QUFDbkUsTUFBTSxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO0FBQzlDLFFBQVEsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDL0IsT0FBTztBQUNQLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNsQjtBQUNBO0FBQ0EsSUFBSSxJQUFJLENBQUMsR0FBRyxHQUFHLFVBQVUsQ0FBQyxLQUFLLEVBQUUsVUFBVSxFQUFFLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRTtBQUN6RCxNQUFNLElBQUksT0FBTyxJQUFJLEtBQUssVUFBVSxFQUFFO0FBQ3RDLFFBQVEsRUFBRSxHQUFHLElBQUksQ0FBQztBQUNsQixRQUFRLElBQUksR0FBRyxFQUFFLENBQUM7QUFDbEIsT0FBTztBQUNQLE1BQU0sSUFBSSxPQUFPLEVBQUUsS0FBSyxRQUFRLEVBQUU7QUFDbEMsUUFBUSxPQUFPLEVBQUUsQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztBQUMzQyxPQUFPO0FBQ1AsTUFBTSxJQUFJLFNBQVMsQ0FBQyxFQUFFLENBQUMsSUFBSSxPQUFPLElBQUksQ0FBQyxTQUFTLEtBQUssVUFBVSxFQUFFO0FBQ2pFLFFBQVEsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztBQUN0QyxPQUFPO0FBQ1AsTUFBTSxJQUFJLE1BQU0sR0FBRyxFQUFFLENBQUM7QUFDdEI7QUFDQSxNQUFNLE1BQU0sY0FBYyxHQUFHLE1BQU07QUFDbkMsUUFBUSxJQUFJLE1BQU0sR0FBRyxFQUFFLENBQUM7QUFDeEIsUUFBUSxJQUFJLEtBQUssR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDO0FBQ2xDO0FBQ0EsUUFBUSxJQUFJLENBQUMsS0FBSyxFQUFFO0FBQ3BCLFVBQVUsT0FBTyxFQUFFLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQ2xDLFNBQVM7QUFDVDtBQUNBO0FBQ0EsUUFBUSxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxLQUFLO0FBQ2pDLFVBQVUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUU7QUFDdkIsWUFBWSxHQUFHLEVBQUUsSUFBSTtBQUNyQixZQUFZLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSTtBQUMzQixZQUFZLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTTtBQUMvQixZQUFZLFdBQVcsRUFBRSxJQUFJLENBQUMsV0FBVztBQUN6QyxZQUFZLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTTtBQUMvQixXQUFXLEVBQUUsVUFBVSxHQUFHLEVBQUUsR0FBRyxFQUFFO0FBQ2pDLFlBQVksSUFBSSxDQUFDLEdBQUcsRUFBRTtBQUN0QjtBQUNBLGNBQWMsSUFBSSxRQUFRLENBQUM7QUFDM0IsY0FBYyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQzdELGdCQUFnQixJQUFJLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEtBQUssR0FBRyxDQUFDLElBQUksRUFBRTtBQUNwRSxrQkFBa0IsUUFBUSxHQUFHLElBQUksQ0FBQztBQUNsQyxrQkFBa0IsTUFBTTtBQUN4QixpQkFBaUI7QUFDakIsZUFBZTtBQUNmLGNBQWMsSUFBSSxDQUFDLFFBQVEsRUFBRTtBQUM3QixnQkFBZ0IsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ3ZDLGVBQWU7QUFDZixhQUFhLE1BQU07QUFDbkIsY0FBYyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7QUFDM0MsYUFBYTtBQUNiLFlBQVksS0FBSyxFQUFFLENBQUM7QUFDcEIsWUFBWSxJQUFJLENBQUMsS0FBSyxFQUFFO0FBQ3hCLGNBQWMsRUFBRSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztBQUMvQixhQUFhO0FBQ2IsV0FBVyxDQUFDLENBQUM7QUFDYixTQUFTLENBQUMsQ0FBQztBQUNYLE9BQU8sQ0FBQztBQUNSO0FBQ0EsTUFBTSxJQUFJLElBQUksQ0FBQyxTQUFTLEVBQUU7QUFDMUIsUUFBUSxJQUFJLElBQUksQ0FBQyxTQUFTLEtBQUssS0FBSyxFQUFFO0FBQ3RDLFVBQVUsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEVBQUUsRUFBRSxVQUFVLEdBQUcsRUFBRSxRQUFRLEVBQUU7QUFDN0Q7QUFDQSxZQUFZLElBQUksR0FBRyxFQUFFO0FBQ3JCLGNBQWMsT0FBTyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDN0IsYUFBYTtBQUNiLFlBQVksTUFBTSxHQUFHLGFBQWEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLENBQUMsVUFBVSxJQUFJLEVBQUU7QUFDakUsY0FBYyxPQUFPLElBQUksQ0FBQyxHQUFHLENBQUM7QUFDOUIsYUFBYSxDQUFDLENBQUM7QUFDZixZQUFZLGNBQWMsRUFBRSxDQUFDO0FBQzdCLFdBQVcsQ0FBQyxDQUFDO0FBQ2IsU0FBUyxNQUFNO0FBQ2YsVUFBVSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFO0FBQzdDLFlBQVksTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7QUFDcEMsWUFBWSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtBQUNwRCxjQUFjLElBQUksQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNoQztBQUNBLGNBQWMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDLEtBQUssUUFBUSxJQUFJLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRTtBQUNqRSxnQkFBZ0IsT0FBTyxFQUFFLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7QUFDcEQsZUFBZTtBQUNmLGFBQWE7QUFDYixZQUFZLGNBQWMsRUFBRSxDQUFDO0FBQzdCLFdBQVcsTUFBTTtBQUNqQixZQUFZLE9BQU8sRUFBRSxDQUFDLFdBQVcsQ0FBQyxhQUFhLEVBQUUsaUJBQWlCLENBQUMsQ0FBQyxDQUFDO0FBQ3JFLFdBQVc7QUFDWCxTQUFTO0FBQ1QsUUFBUSxPQUFPO0FBQ2YsT0FBTztBQUNQO0FBQ0EsTUFBTSxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxDQUFDLEdBQUcsRUFBRSxNQUFNLEtBQUs7QUFDbEQsUUFBUSxJQUFJLEdBQUcsRUFBRTtBQUNqQixVQUFVLEdBQUcsQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDO0FBQ3pCLFVBQVUsT0FBTyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDekIsU0FBUztBQUNUO0FBQ0EsUUFBUSxJQUFJLEdBQUcsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDO0FBQzdCLFFBQVEsSUFBSSxRQUFRLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQztBQUN2QyxRQUFRLElBQUksR0FBRyxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUM7QUFDN0I7QUFDQSxRQUFRLElBQUksSUFBSSxDQUFDLFNBQVMsRUFBRTtBQUM1QixVQUFVLElBQUksU0FBUyxHQUFHLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQ3JELFVBQVUsSUFBSSxTQUFTLENBQUMsTUFBTSxFQUFFO0FBQ2hDLFlBQVksR0FBRyxDQUFDLFVBQVUsR0FBRyxTQUFTLENBQUM7QUFDdkMsV0FBVztBQUNYLFNBQVM7QUFDVDtBQUNBLFFBQVEsSUFBSSxTQUFTLENBQUMsUUFBUSxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRTtBQUMzQyxVQUFVLEdBQUcsQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDO0FBQzlCLFNBQVM7QUFDVDtBQUNBLFFBQVEsSUFBSSxJQUFJLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxTQUFTLEVBQUU7QUFDekMsVUFBVSxJQUFJLFdBQVcsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUNoRCxVQUFVLElBQUksS0FBSyxTQUFTLFFBQVEsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFDekQsVUFBVSxJQUFJLE9BQU8sT0FBTyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDM0M7QUFDQSxVQUFVLElBQUksS0FBSyxHQUFHLFVBQVUsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDcEQsVUFBVSxJQUFJLElBQUksR0FBRyxJQUFJLENBQUM7QUFDMUI7QUFDQSxVQUFVLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQ2pELFlBQVksSUFBSSxXQUFXLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3ZDLFlBQVksSUFBSSxTQUFTLEdBQUcsV0FBVyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLEVBQUUsRUFBRSxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDO0FBQzlFLGVBQWUsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQ2hDLFlBQVksSUFBSSxpQkFBaUIsR0FBRyxTQUFTLE1BQU0sS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQzlEO0FBQ0EsWUFBWSxJQUFJLGlCQUFpQixLQUFLLENBQUMsSUFBSSxJQUFJLFNBQVMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFO0FBQ2xFLGNBQWMsSUFBSSxHQUFHLFdBQVcsQ0FBQztBQUNqQyxhQUFhO0FBQ2IsV0FBVztBQUNYO0FBQ0E7QUFDQSxVQUFVLElBQUksQ0FBQyxJQUFJLEVBQUU7QUFDckIsWUFBWSxHQUFHLEdBQUcsSUFBSSxLQUFLLENBQUMsa0JBQWtCLENBQUMsQ0FBQztBQUNoRCxZQUFZLEdBQUcsQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDO0FBQzNCLFlBQVksT0FBTyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDM0IsV0FBVztBQUNYO0FBQ0EsVUFBVSxJQUFJLFVBQVUsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsRUFBRSxFQUFFLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUM7QUFDdEUsYUFBYSxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDakQsVUFBVSxJQUFJLE9BQU8sR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sR0FBRyxVQUFVLENBQUM7QUFDckQsVUFBVSxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxVQUFVLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDL0MsVUFBVSxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxDQUFDO0FBQzdCO0FBQ0EsVUFBVSxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUU7QUFDekIsWUFBWSxHQUFHLENBQUMsVUFBVSxHQUFHO0FBQzdCLGNBQWMsS0FBSyxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sSUFBSSxDQUFDO0FBQ3JELGNBQWMsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLFVBQVUsR0FBRyxFQUFFO0FBQy9DLGdCQUFnQixPQUFPLEdBQUcsQ0FBQyxFQUFFLENBQUM7QUFDOUIsZUFBZSxDQUFDO0FBQ2hCLGFBQWEsQ0FBQztBQUNkLFdBQVc7QUFDWCxVQUFVLElBQUksSUFBSSxDQUFDLFNBQVMsRUFBRTtBQUM5QixZQUFZLElBQUksR0FBRyxJQUFJLElBQUksQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUM7QUFDbEQsWUFBWSxHQUFHLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLFVBQVUsR0FBRyxFQUFFO0FBQ3pELGNBQWMsR0FBRyxFQUFFLENBQUM7QUFDcEIsY0FBYyxPQUFPO0FBQ3JCLGdCQUFnQixHQUFHLEVBQUUsR0FBRyxHQUFHLEdBQUcsR0FBRyxHQUFHLENBQUMsRUFBRTtBQUN2QyxnQkFBZ0IsTUFBTSxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTTtBQUN2QyxlQUFlLENBQUM7QUFDaEIsYUFBYSxDQUFDLENBQUM7QUFDZixXQUFXO0FBQ1gsU0FBUztBQUNUO0FBQ0EsUUFBUSxJQUFJLElBQUksQ0FBQyxXQUFXLElBQUksR0FBRyxDQUFDLFlBQVksRUFBRTtBQUNsRCxVQUFVLElBQUksV0FBVyxHQUFHLEdBQUcsQ0FBQyxZQUFZLENBQUM7QUFDN0MsVUFBVSxJQUFJLEtBQUssR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLE1BQU0sQ0FBQztBQUN0RCxVQUFVLElBQUksS0FBSyxLQUFLLENBQUMsRUFBRTtBQUMzQixZQUFZLE9BQU8sRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztBQUNqQyxXQUFXO0FBQ1gsVUFBVSxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEdBQUcsS0FBSztBQUNwRCxZQUFZLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsV0FBVyxDQUFDLEdBQUcsQ0FBQyxFQUFFO0FBQ2hFO0FBQ0E7QUFDQTtBQUNBLGNBQWMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxJQUFJO0FBQzNCLGNBQWMsTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNO0FBQ2pDLGNBQWMsR0FBRyxFQUFFLEdBQUc7QUFDdEIsYUFBYSxFQUFFLFVBQVUsR0FBRyxFQUFFLElBQUksRUFBRTtBQUNwQyxjQUFjLElBQUksR0FBRyxHQUFHLEdBQUcsQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDOUMsY0FBYyxHQUFHLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztBQUM5QixjQUFjLE9BQU8sR0FBRyxDQUFDLElBQUksQ0FBQztBQUM5QixjQUFjLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQztBQUNoQyxjQUFjLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRTtBQUM1QixnQkFBZ0IsRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztBQUM5QixlQUFlO0FBQ2YsYUFBYSxDQUFDLENBQUM7QUFDZixXQUFXLENBQUMsQ0FBQztBQUNiLFNBQVMsTUFBTTtBQUNmLFVBQVUsSUFBSSxHQUFHLENBQUMsWUFBWSxFQUFFO0FBQ2hDLFlBQVksS0FBSyxJQUFJLEdBQUcsSUFBSSxHQUFHLENBQUMsWUFBWSxFQUFFO0FBQzlDO0FBQ0EsY0FBYyxJQUFJLE1BQU0sQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsWUFBWSxFQUFFLEdBQUcsQ0FBQyxFQUFFO0FBQy9FLGdCQUFnQixHQUFHLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7QUFDbEQsZUFBZTtBQUNmLGFBQWE7QUFDYixXQUFXO0FBQ1gsVUFBVSxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQ3hCLFNBQVM7QUFDVCxPQUFPLENBQUMsQ0FBQztBQUNULEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNsQjtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUksSUFBSSxDQUFDLGFBQWEsR0FBRyxVQUFVLENBQUMsZUFBZSxFQUFFLFVBQVUsS0FBSyxFQUFFLFlBQVksRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFO0FBQ3BHLE1BQU0sSUFBSSxJQUFJLFlBQVksUUFBUSxFQUFFO0FBQ3BDLFFBQVEsUUFBUSxHQUFHLElBQUksQ0FBQztBQUN4QixRQUFRLElBQUksR0FBRyxFQUFFLENBQUM7QUFDbEIsT0FBTztBQUNQLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsS0FBSztBQUMzQyxRQUFRLElBQUksR0FBRyxFQUFFO0FBQ2pCLFVBQVUsT0FBTyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDL0IsU0FBUztBQUNULFFBQVEsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLFlBQVksSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxZQUFZLENBQUMsRUFBRTtBQUN4RSxVQUFVLElBQUksQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQztBQUM3QixVQUFVLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDO0FBQzdCLFVBQVUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLEVBQUUsWUFBWTtBQUNqRCw4QkFBOEIsR0FBRyxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsWUFBWSxDQUFDLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0FBQ2xGLFNBQVMsTUFBTTtBQUNmLFVBQVUsT0FBTyxRQUFRLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7QUFDcEQsU0FBUztBQUNULE9BQU8sQ0FBQyxDQUFDO0FBQ1QsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ2xCO0FBQ0EsSUFBSSxJQUFJLENBQUMsT0FBTyxHQUFHLFVBQVUsQ0FBQyxTQUFTLEVBQUUsVUFBVSxJQUFJLEVBQUUsUUFBUSxFQUFFO0FBQ25FLE1BQU0sSUFBSSxPQUFPLElBQUksS0FBSyxVQUFVLEVBQUU7QUFDdEMsUUFBUSxRQUFRLEdBQUcsSUFBSSxDQUFDO0FBQ3hCLFFBQVEsSUFBSSxHQUFHLEVBQUUsQ0FBQztBQUNsQixPQUFPO0FBQ1AsTUFBTSxJQUFJLENBQUMsSUFBSSxHQUFHLE9BQU8sSUFBSSxDQUFDLElBQUksS0FBSyxXQUFXLEdBQUcsSUFBSSxDQUFDLElBQUksR0FBRyxDQUFDLENBQUM7QUFDbkUsTUFBTSxJQUFJLElBQUksQ0FBQyxTQUFTLEVBQUU7QUFDMUIsUUFBUSxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7QUFDdkMsT0FBTztBQUNQLE1BQU0sSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFO0FBQ3hCLFFBQVEsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDO0FBQ25DLE9BQU87QUFDUCxNQUFNLElBQUksTUFBTSxJQUFJLElBQUksRUFBRTtBQUMxQixRQUFRLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRTtBQUN2QyxVQUFVLE9BQU8sUUFBUSxDQUFDLElBQUksU0FBUyxDQUFDLCtCQUErQixDQUFDLENBQUMsQ0FBQztBQUMxRSxTQUFTO0FBQ1QsUUFBUSxJQUFJLGVBQWU7QUFDM0IsVUFBVSxDQUFDLFVBQVUsRUFBRSxRQUFRLEVBQUUsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLFVBQVUsZUFBZSxFQUFFO0FBQzFFLFVBQVUsT0FBTyxlQUFlLElBQUksSUFBSSxDQUFDO0FBQ3pDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2QsUUFBUSxJQUFJLGVBQWUsRUFBRTtBQUM3QixVQUFVLFFBQVEsQ0FBQyxXQUFXLENBQUMsaUJBQWlCO0FBQ2hELFlBQVksbUJBQW1CLEdBQUcsZUFBZTtBQUNqRCxZQUFZLG9DQUFvQztBQUNoRCxXQUFXLENBQUMsQ0FBQztBQUNiLFVBQVUsT0FBTztBQUNqQixTQUFTO0FBQ1QsUUFBUSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFO0FBQzdCLFVBQVUsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDakMsVUFBVSxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtBQUN0QyxZQUFZLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsRUFBRSxRQUFRLENBQUMsQ0FBQztBQUN2RCxXQUFXO0FBQ1gsU0FBUztBQUNULE9BQU87QUFDUDtBQUNBLE1BQU0sT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQztBQUMzQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDbEI7QUFDQSxJQUFJLElBQUksQ0FBQyxLQUFLLEdBQUcsVUFBVSxDQUFDLE9BQU8sRUFBRSxVQUFVLFFBQVEsRUFBRTtBQUN6RCxNQUFNLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDO0FBQzFCLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUMxQixNQUFNLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUNuQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDbEI7QUFDQSxJQUFJLElBQUksQ0FBQyxJQUFJLEdBQUcsVUFBVSxDQUFDLE1BQU0sRUFBRSxVQUFVLFFBQVEsRUFBRTtBQUN2RCxNQUFNLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLEVBQUUsSUFBSSxLQUFLO0FBQ2hDLFFBQVEsSUFBSSxHQUFHLEVBQUU7QUFDakIsVUFBVSxPQUFPLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUMvQixTQUFTO0FBQ1Q7QUFDQSxRQUFRLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDO0FBQ2pELFFBQVEsSUFBSSxDQUFDLGVBQWUsR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDLGVBQWUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQzNFLFFBQVEsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDO0FBQ3BDLFFBQVEsUUFBUSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztBQUM3QixPQUFPLENBQUMsQ0FBQztBQUNULEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNsQjtBQUNBLElBQUksSUFBSSxDQUFDLEVBQUUsR0FBRyxVQUFVLENBQUMsSUFBSSxFQUFFLFVBQVUsUUFBUSxFQUFFO0FBQ25ELE1BQU0sT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQ2hDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNsQjtBQUNBLElBQUksSUFBSSxDQUFDLFFBQVEsR0FBRyxVQUFVLENBQUMsVUFBVSxFQUFFLFVBQVUsR0FBRyxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUU7QUFDMUUsTUFBTSxJQUFJLE9BQU8sSUFBSSxLQUFLLFVBQVUsRUFBRTtBQUN0QyxRQUFRLFFBQVEsR0FBRyxJQUFJLENBQUM7QUFDeEIsUUFBUSxJQUFJLEdBQUcsRUFBRSxDQUFDO0FBQ2xCLE9BQU87QUFDUDtBQUNBLE1BQU0sSUFBSSxHQUFHLElBQUksSUFBSSxFQUFFLENBQUM7QUFDeEI7QUFDQSxNQUFNLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRTtBQUM5QixRQUFRLEdBQUcsR0FBRztBQUNkLFVBQVUsSUFBSSxFQUFFLEdBQUc7QUFDbkIsU0FBUyxDQUFDO0FBQ1YsT0FBTztBQUNQO0FBQ0EsTUFBTSxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFO0FBQ3pELFFBQVEsT0FBTyxRQUFRLENBQUMsV0FBVyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQztBQUN4RCxPQUFPO0FBQ1A7QUFDQSxNQUFNLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsRUFBRTtBQUNoRCxRQUFRLElBQUksT0FBTyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLFFBQVEsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRTtBQUMzRSxVQUFVLE9BQU8sUUFBUSxDQUFDLFdBQVcsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO0FBQ3RELFNBQVM7QUFDVCxPQUFPO0FBQ1A7QUFDQSxNQUFNLElBQUksZUFBZSxDQUFDO0FBQzFCLE1BQU0sR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxHQUFHLEVBQUU7QUFDdEMsUUFBUSxJQUFJLEdBQUcsQ0FBQyxZQUFZLEVBQUU7QUFDOUIsVUFBVSxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBVSxJQUFJLEVBQUU7QUFDaEUsWUFBWSxlQUFlLEdBQUcsZUFBZSxJQUFJLG1CQUFtQixDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzNFLFlBQVksSUFBSSxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUMsWUFBWSxFQUFFO0FBQ3RELGNBQWMsY0FBYyxDQUFDLE1BQU0sRUFBRSxZQUFZLEVBQUUsSUFBSSxFQUFFLGFBQWEsRUFBRSxHQUFHLENBQUMsR0FBRyxFQUFFLHlCQUF5QixDQUFDLENBQUM7QUFDNUcsYUFBYTtBQUNiLFdBQVcsQ0FBQyxDQUFDO0FBQ2IsU0FBUztBQUNULE9BQU8sQ0FBQyxDQUFDO0FBQ1Q7QUFDQSxNQUFNLElBQUksZUFBZSxFQUFFO0FBQzNCLFFBQVEsT0FBTyxRQUFRLENBQUMsV0FBVyxDQUFDLFdBQVcsRUFBRSxlQUFlLENBQUMsQ0FBQyxDQUFDO0FBQ25FLE9BQU87QUFDUDtBQUNBLE1BQU0sSUFBSSxFQUFFLFdBQVcsSUFBSSxJQUFJLENBQUMsRUFBRTtBQUNsQyxRQUFRLElBQUksV0FBVyxJQUFJLEdBQUcsRUFBRTtBQUNoQyxVQUFVLElBQUksQ0FBQyxTQUFTLEdBQUcsR0FBRyxDQUFDLFNBQVMsQ0FBQztBQUN6QyxTQUFTLE1BQU07QUFDZixVQUFVLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDO0FBQ2hDLFNBQVM7QUFDVCxPQUFPO0FBQ1A7QUFDQSxNQUFNLElBQUksT0FBTyxHQUFHLElBQUksQ0FBQztBQUN6QixNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFO0FBQ2pEO0FBQ0E7QUFDQSxRQUFRLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUM7QUFDMUMsT0FBTztBQUNQO0FBQ0EsTUFBTSxTQUFTLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTSxJQUFJLEdBQUcsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEdBQUcsRUFBRTtBQUM1QyxRQUFRLE9BQU8sR0FBRyxDQUFDLEdBQUcsQ0FBQztBQUN2QixPQUFPLENBQUMsQ0FBQztBQUNUO0FBQ0EsTUFBTSxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsVUFBVSxHQUFHLEVBQUUsR0FBRyxFQUFFO0FBQ3BELFFBQVEsSUFBSSxHQUFHLEVBQUU7QUFDakIsVUFBVSxPQUFPLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUMvQixTQUFTO0FBQ1QsUUFBUSxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRTtBQUM3QjtBQUNBLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLEVBQUU7QUFDeEMsWUFBWSxPQUFPLENBQUMsQ0FBQyxLQUFLLENBQUM7QUFDM0IsV0FBVyxDQUFDLENBQUM7QUFDYixTQUFTO0FBQ1Q7QUFDQSxRQUFRLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUU7QUFDaEMsVUFBVSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQ3RELFlBQVksR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM1QyxXQUFXO0FBQ1gsU0FBUztBQUNUO0FBQ0EsUUFBUSxRQUFRLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQzVCLE9BQU8sQ0FBQyxDQUFDO0FBQ1QsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ2xCO0FBQ0EsSUFBSSxJQUFJLENBQUMseUJBQXlCLEdBQUcsVUFBVSxDQUFDLDJCQUEyQixFQUFFLFVBQVUsV0FBVyxFQUFFLFFBQVEsRUFBRTtBQUM5RyxNQUFNLElBQUksU0FBUyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDekMsTUFBTSxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsWUFBWSxFQUFFO0FBQ3BDLFFBQVEsU0FBUyxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQztBQUNyRCxPQUFPO0FBQ1A7QUFDQSxNQUFNLElBQUksS0FBSyxHQUFHLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxXQUFXLEVBQUUsU0FBUyxDQUFDLENBQUM7QUFDL0Q7QUFDQSxNQUFNLFNBQVMsT0FBTyxDQUFDLEdBQUcsRUFBRTtBQUM1QixRQUFRLEdBQUcsQ0FBQyxZQUFZLEdBQUcsR0FBRyxDQUFDLFlBQVksSUFBSSxFQUFFLENBQUM7QUFDbEQsUUFBUSxJQUFJLEdBQUcsQ0FBQyxZQUFZLENBQUMsV0FBVyxDQUFDLEVBQUU7QUFDM0MsVUFBVSxPQUFPLEtBQUssQ0FBQztBQUN2QixTQUFTO0FBQ1QsUUFBUSxHQUFHLENBQUMsWUFBWSxDQUFDLFdBQVcsQ0FBQyxHQUFHLElBQUksQ0FBQztBQUM3QyxRQUFRLE9BQU8sR0FBRyxDQUFDO0FBQ25CLE9BQU87QUFDUCxNQUFNLE1BQU0sQ0FBQyxJQUFJLEVBQUUsNEJBQTRCLEVBQUUsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLFlBQVk7QUFDM0UsUUFBUSxRQUFRLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUM7QUFDcEMsT0FBTyxDQUFDLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQ3pCLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNsQjtBQUNBLElBQUksSUFBSSxDQUFDLE9BQU8sR0FBRyxVQUFVLENBQUMsU0FBUyxFQUFFLFVBQVUsSUFBSSxFQUFFLFFBQVEsRUFBRTtBQUNuRTtBQUNBLE1BQU0sSUFBSSxPQUFPLElBQUksS0FBSyxVQUFVLEVBQUU7QUFDdEMsUUFBUSxRQUFRLEdBQUcsSUFBSSxDQUFDO0FBQ3hCLFFBQVEsSUFBSSxHQUFHLEVBQUUsQ0FBQztBQUNsQixPQUFPO0FBQ1A7QUFDQSxNQUFNLElBQUksU0FBUyxHQUFHLFlBQVksSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUM7QUFDcEU7QUFDQSxNQUFNLE1BQU0sU0FBUyxHQUFHLE1BQU07QUFDOUI7QUFDQSxRQUFRLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLENBQUMsR0FBRyxFQUFFLElBQUksS0FBSztBQUMzQyxVQUFVLElBQUksR0FBRyxFQUFFO0FBQ25CLFlBQVksT0FBTyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDakMsV0FBVztBQUNYLFVBQVUsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUM7QUFDakMsVUFBVSxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBQ2pDLFVBQVUsUUFBUSxDQUFDLElBQUksRUFBRSxJQUFJLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztBQUNqRCxTQUFTLENBQUMsQ0FBQztBQUNYLE9BQU8sQ0FBQztBQUNSO0FBQ0EsTUFBTSxJQUFJLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRTtBQUMxQjtBQUNBLFFBQVEsT0FBTyxTQUFTLEVBQUUsQ0FBQztBQUMzQixPQUFPO0FBQ1A7QUFDQSxNQUFNLElBQUksQ0FBQyxHQUFHLENBQUMsNEJBQTRCLEVBQUUsQ0FBQyxHQUFHLEVBQUUsUUFBUSxLQUFLO0FBQ2hFLFFBQVEsSUFBSSxHQUFHLEVBQUU7QUFDakI7QUFDQSxVQUFVLElBQUksR0FBRyxDQUFDLE1BQU0sS0FBSyxHQUFHLEVBQUU7QUFDbEMsWUFBWSxPQUFPLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUNqQyxXQUFXLE1BQU07QUFDakIsWUFBWSxPQUFPLFNBQVMsRUFBRSxDQUFDO0FBQy9CLFdBQVc7QUFDWCxTQUFTO0FBQ1QsUUFBUSxJQUFJLFlBQVksR0FBRyxRQUFRLENBQUMsWUFBWSxDQUFDO0FBQ2pELFFBQVEsSUFBSSxPQUFPLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQztBQUN2QyxRQUFRLElBQUksVUFBVSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxLQUFLO0FBQ2pFO0FBQ0E7QUFDQSxVQUFVLElBQUksUUFBUSxHQUFHLFNBQVM7QUFDbEMsWUFBWSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksTUFBTSxDQUFDLEdBQUcsR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDO0FBQ3RFLFVBQVUsT0FBTyxJQUFJLE9BQU8sQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO0FBQzlELFNBQVMsQ0FBQyxDQUFDO0FBQ1gsUUFBUSxPQUFPLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDMUQsT0FBTyxDQUFDLENBQUM7QUFDVCxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDbEIsR0FBRztBQUNIO0FBQ0EsRUFBRSxRQUFRLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRTtBQUMzQixJQUFJLElBQUksV0FBVyxHQUFHO0FBQ3RCLE1BQU0sV0FBVyxFQUFFLEtBQUs7QUFDeEIsTUFBTSxRQUFRLEVBQUUsSUFBSSxDQUFDLFFBQVEsSUFBSSxDQUFDO0FBQ2xDLEtBQUssQ0FBQztBQUNOLElBQUksSUFBSSxRQUFRLEdBQUcsRUFBRSxDQUFDO0FBQ3RCO0FBQ0EsSUFBSSxJQUFJLE1BQU0sQ0FBQztBQUNmLElBQUksSUFBSSxhQUFhLEdBQUcsQ0FBQyxDQUFDO0FBQzFCO0FBQ0EsSUFBSSxNQUFNLFFBQVEsR0FBRyxDQUFDLEdBQUcsS0FBSztBQUM5QixNQUFNLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRTtBQUN0QyxRQUFRLGVBQWUsRUFBRSxFQUFFLGFBQWE7QUFDeEMsT0FBTyxDQUFDLENBQUM7QUFDVCxNQUFNLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDckQsS0FBSyxDQUFDO0FBQ04sSUFBSSxNQUFNLE9BQU8sR0FBRyxDQUFDLEdBQUcsS0FBSztBQUM3QixNQUFNLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxHQUFHLENBQUMsQ0FBQztBQUMzQyxNQUFNLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUNwQixLQUFLLENBQUM7QUFDTixJQUFJLE1BQU0sVUFBVSxHQUFHLENBQUMsSUFBSSxLQUFLO0FBQ2pDLE1BQU0sSUFBSSxPQUFPLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQztBQUNsQyxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU07QUFDdkMsUUFBUSxPQUFPLE1BQU0sQ0FBQyxJQUFJLEVBQUUsbUJBQW1CLEVBQUUsQ0FBQyxHQUFHLEtBQUs7QUFDMUQsVUFBVSxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsSUFBSSxHQUFHLENBQUMsUUFBUSxHQUFHLE9BQU8sRUFBRTtBQUN2RCxZQUFZLEdBQUcsQ0FBQyxRQUFRLEdBQUcsT0FBTyxDQUFDO0FBQ25DLFlBQVksT0FBTyxHQUFHLENBQUM7QUFDdkIsV0FBVztBQUNYLFVBQVUsT0FBTyxLQUFLLENBQUM7QUFDdkIsU0FBUyxDQUFDLENBQUM7QUFDWCxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTTtBQUNwQixRQUFRLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ3hDLFFBQVEsUUFBUSxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQ25DLE9BQU8sQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUN4QixLQUFLLENBQUM7QUFDTjtBQUNBLElBQUksSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksS0FBSztBQUMvQixNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQztBQUNwQyxRQUFRLElBQUksRUFBRSxxQkFBcUI7QUFDbkMsUUFBUSxXQUFXLEVBQUUsSUFBSSxDQUFDLFVBQVUsR0FBRyxXQUFXLENBQUMsUUFBUTtBQUMzRCxPQUFPLENBQUMsQ0FBQztBQUNUO0FBQ0EsTUFBTSxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQztBQUMvQixTQUFTLEVBQUUsQ0FBQyxRQUFRLEVBQUUsUUFBUSxDQUFDO0FBQy9CLFNBQVMsRUFBRSxDQUFDLFVBQVUsRUFBRSxVQUFVLENBQUM7QUFDbkMsU0FBUyxFQUFFLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQzlCLEtBQUssQ0FBQyxDQUFDO0FBQ1AsR0FBRztBQUNIO0FBQ0EsRUFBRSxPQUFPLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRTtBQUMxQixJQUFJLElBQUksT0FBTyxJQUFJLEtBQUssVUFBVSxFQUFFO0FBQ3BDLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQztBQUN0QixNQUFNLElBQUksR0FBRyxFQUFFLENBQUM7QUFDaEIsS0FBSztBQUNMO0FBQ0EsSUFBSSxJQUFJLEdBQUcsSUFBSSxJQUFJLEVBQUUsQ0FBQztBQUN0QjtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUksSUFBSSxDQUFDLFdBQVcsR0FBRyxDQUFDLGFBQWEsSUFBSSxJQUFJLElBQUksSUFBSSxDQUFDLFdBQVcsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7QUFDL0U7QUFDQSxJQUFJLE9BQU8sSUFBSSxPQUFPLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQztBQUM3QyxHQUFHO0FBQ0g7QUFDQSxFQUFFLElBQUksR0FBRztBQUNULElBQUksT0FBTyxDQUFDLE9BQU8sSUFBSSxDQUFDLEtBQUssS0FBSyxVQUFVLElBQUksSUFBSSxDQUFDLEtBQUssRUFBRSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUM7QUFDNUUsR0FBRztBQUNILENBQUM7QUFDRDtBQUNBO0FBQ0E7QUFDQSxlQUFlLENBQUMsU0FBUyxDQUFDLEtBQUssR0FBRyxVQUFVLENBQUMsUUFBUSxFQUFFLFVBQVUsS0FBSyxFQUFFLEdBQUcsRUFBRSxRQUFRLEVBQUU7QUFDdkYsRUFBRSxJQUFJLE9BQU8sSUFBSSxDQUFDLE1BQU0sS0FBSyxXQUFXLEVBQUU7QUFDMUMsSUFBSSxPQUFPLFFBQVEsQ0FBQyxXQUFXLENBQUMsYUFBYSxFQUFFLGtDQUFrQyxHQUFHLElBQUksQ0FBQyxPQUFPLEdBQUcsV0FBVyxDQUFDLENBQUMsQ0FBQztBQUNqSCxHQUFHO0FBQ0gsRUFBRSxJQUFJLElBQUksR0FBRyxJQUFJLENBQUM7QUFDbEI7QUFDQSxFQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxLQUFLLEVBQUUsSUFBSSxLQUFLO0FBQ2hELElBQUksSUFBSSxLQUFLLEVBQUU7QUFDZixNQUFNLE9BQU8sUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQzdCLEtBQUs7QUFDTCxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUU7QUFDZixNQUFNLE9BQU8sUUFBUSxDQUFDLFdBQVcsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO0FBQ2hELEtBQUs7QUFDTCxJQUFJLElBQUksSUFBSSxDQUFDO0FBQ2IsSUFBSSxJQUFJO0FBQ1IsTUFBTSxJQUFJLEdBQUcsY0FBYyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztBQUN2QyxLQUFLLENBQUMsT0FBTyxLQUFLLEVBQUU7QUFDcEIsTUFBTSxPQUFPLFFBQVEsQ0FBQyxLQUFLLENBQUMsT0FBTyxJQUFJLEtBQUssQ0FBQyxDQUFDO0FBQzlDLEtBQUs7QUFDTCxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxDQUFDLEtBQUssRUFBRSxNQUFNLEtBQUs7QUFDaEQsTUFBTSxJQUFJLEtBQUssRUFBRTtBQUNqQixRQUFRLE9BQU8sUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQy9CLE9BQU8sTUFBTTtBQUNiLFFBQVEsY0FBYyxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLFlBQVk7QUFDMUQsVUFBVSxPQUFPLFFBQVEsQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFDeEMsU0FBUyxDQUFDLENBQUM7QUFDWCxPQUFPO0FBQ1AsS0FBSyxDQUFDLENBQUM7QUFDUCxHQUFHLENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQzs7QUM1L0JhLE1BQU0sU0FBUyxDQUFDO0FBQy9CLEVBQUUsV0FBVyxHQUFHO0FBQ2hCLElBQUksSUFBSSxDQUFDLE9BQU8sR0FBRyxLQUFLLENBQUM7QUFDekIsSUFBSSxJQUFJLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQztBQUN4QixJQUFJLElBQUksQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDO0FBQ3BCLEdBQUc7QUFDSDtBQUNBLEVBQUUsT0FBTyxHQUFHO0FBQ1osSUFBSSxJQUFJLEdBQUcsQ0FBQztBQUNaLElBQUksSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO0FBQ3JCLE1BQU0sUUFBUSxHQUFHLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsR0FBRztBQUN6QyxRQUFRLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDekIsT0FBTztBQUNQLEtBQUssTUFBTTtBQUNYLE1BQU0sUUFBUSxHQUFHLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsR0FBRztBQUN6QyxRQUFRLEdBQUcsRUFBRSxDQUFDO0FBQ2QsT0FBTztBQUNQLEtBQUs7QUFDTCxHQUFHO0FBQ0g7QUFDQSxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUU7QUFDWixJQUFJLElBQUksQ0FBQyxNQUFNLEdBQUcsR0FBRyxDQUFDO0FBQ3RCLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO0FBQ25CLEdBQUc7QUFDSDtBQUNBLEVBQUUsS0FBSyxDQUFDLEVBQUUsRUFBRTtBQUNaLElBQUksSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUM7QUFDeEIsSUFBSSxJQUFJLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQztBQUNqQixJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUNuQixHQUFHO0FBQ0g7QUFDQSxFQUFFLE9BQU8sQ0FBQyxHQUFHLEVBQUU7QUFDZixJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3pCLElBQUksSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO0FBQ3JCLE1BQU0sSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO0FBQ3JCLEtBQUs7QUFDTCxHQUFHO0FBQ0g7O0FDbkNBLE1BQU0sZUFBZSxHQUFHLENBQUMsT0FBTyxLQUFLLFNBQVMsWUFBWSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUU7QUFDdkUsRUFBRSxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLG9CQUFvQixDQUFDLENBQUM7QUFDL0MsRUFBRSxJQUFJLEtBQUssRUFBRTtBQUNiO0FBQ0EsSUFBSSxPQUFPO0FBQ1gsTUFBTSxJQUFJLEVBQUUsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsS0FBSyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDO0FBQzVFLE1BQU0sT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUM7QUFDdkIsS0FBSyxDQUFDO0FBQ04sR0FBRztBQUNIO0FBQ0EsRUFBRSxJQUFJLFFBQVEsR0FBRyxPQUFPLENBQUMsUUFBUSxDQUFDO0FBQ2xDLEVBQUUsSUFBSSxpQkFBaUIsR0FBRyxPQUFPLENBQUMsaUJBQWlCLENBQUM7QUFDcEQsRUFBRSxJQUFJLE1BQU0sR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDO0FBQzlCLEVBQUUsSUFBSSxXQUFXLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQztBQUNqQztBQUNBLEVBQUUsSUFBSSxDQUFDLFdBQVcsRUFBRTtBQUNwQixJQUFJLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxpQkFBaUIsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLEVBQUU7QUFDdkQsTUFBTSxXQUFXLEdBQUcsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDekM7QUFDQTtBQUNBLE1BQU0sSUFBSSxXQUFXLEtBQUssS0FBSyxJQUFJLFFBQVEsSUFBSSxRQUFRO0FBQ3ZELFVBQVUsZUFBZSxFQUFFLElBQUksWUFBWSxDQUFDLG1CQUFtQixHQUFHLE1BQU0sR0FBRyxJQUFJLENBQUMsRUFBRTtBQUNsRjtBQUNBLFFBQVEsY0FBYyxDQUFDLEtBQUssRUFBRSwwQkFBMEIsR0FBRyxJQUFJLEdBQUcsZ0JBQWdCO0FBQ2xGLFVBQVUsOERBQThELENBQUMsQ0FBQztBQUMxRSxRQUFRLFNBQVM7QUFDakIsT0FBTztBQUNQLE1BQU0sTUFBTTtBQUNaLEtBQUs7QUFDTCxHQUFHO0FBQ0g7QUFDQSxFQUFFLElBQUksT0FBTyxHQUFHLFFBQVEsQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUN0QztBQUNBO0FBQ0EsRUFBRSxJQUFJLFNBQVMsR0FBRyxDQUFDLE9BQU8sSUFBSSxZQUFZLElBQUksT0FBTztBQUNyRCxJQUFJLE9BQU8sQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDO0FBQzlCO0FBQ0EsRUFBRSxPQUFPO0FBQ1QsSUFBSSxJQUFJLEVBQUUsU0FBUyxJQUFJLE1BQU0sR0FBRyxJQUFJLElBQUksSUFBSTtBQUM1QyxJQUFJLE9BQU8sRUFBRSxXQUFXO0FBQ3hCLEdBQUcsQ0FBQztBQUNKLENBQUM7O0FDM0NELFNBQVMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUU7QUFDeEIsRUFBRSxDQUFDLENBQUMsU0FBUyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFNBQVMsRUFBRTtBQUMzQyxJQUFJLFdBQVcsRUFBRSxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUU7QUFDN0IsR0FBRyxDQUFDLENBQUM7QUFDTCxDQUFDO0FBQ0Q7QUFDTyxTQUFTLFdBQVcsQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFO0FBQzFDLEVBQUUsSUFBSSxLQUFLLEdBQUcsVUFBVSxHQUFHLElBQUksRUFBRTtBQUNqQyxJQUFJLElBQUksRUFBRSxJQUFJLFlBQVksS0FBSyxDQUFDLEVBQUU7QUFDbEMsTUFBTSxPQUFPLElBQUksS0FBSyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUM7QUFDaEMsS0FBSztBQUNMLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDM0IsR0FBRyxDQUFDO0FBQ0osRUFBRSxRQUFRLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQzFCLEVBQUUsT0FBTyxLQUFLLENBQUM7QUFDZjs7QUNUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVMscUJBQXFCLENBQUMsSUFBSSxFQUFFO0FBQ3JDO0FBQ0EsRUFBRSxTQUFTLFdBQVcsQ0FBQyxnQkFBZ0IsRUFBRTtBQUN6QyxJQUFJLElBQUksQ0FBQyxjQUFjLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0FBQzVDLElBQUksSUFBSSxDQUFDLGdCQUFnQixFQUFFO0FBQzNCLE1BQU0sSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNwRCxLQUFLO0FBQ0wsR0FBRztBQUNIO0FBQ0EsRUFBRSxTQUFTLFFBQVEsR0FBRztBQUN0QixJQUFJLElBQUksQ0FBQyxjQUFjLENBQUMsV0FBVyxFQUFFLFdBQVcsQ0FBQyxDQUFDO0FBQ2xELElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQ3pDLEdBQUc7QUFDSDtBQUNBLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsV0FBVyxDQUFDLENBQUM7QUFDdEMsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxRQUFRLENBQUMsQ0FBQztBQUNoQyxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQztBQUNyQyxDQUFDO0FBQ0Q7QUFDQSxNQUFNLGFBQWEsU0FBU0MsZUFBTyxDQUFDO0FBQ3BDLEVBQUUsV0FBVyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUU7QUFDMUIsSUFBSSxLQUFLLEVBQUUsQ0FBQztBQUNaLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDNUIsR0FBRztBQUNIO0FBQ0EsRUFBRSxNQUFNLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRTtBQUNyQixJQUFJLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQztBQUNuQixJQUFJLElBQUksR0FBRyxJQUFJLElBQUksRUFBRSxDQUFDO0FBQ3RCO0FBQ0EsSUFBSSxJQUFJLElBQUksSUFBSSxPQUFPLElBQUksS0FBSyxRQUFRLEVBQUU7QUFDMUMsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDO0FBQ2xCLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7QUFDdkIsTUFBTSxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUM7QUFDdkIsS0FBSztBQUNMO0FBQ0EsSUFBSSxJQUFJLElBQUksQ0FBQyxrQkFBa0IsS0FBSyxTQUFTLEVBQUU7QUFDL0MsTUFBTSxJQUFJLENBQUMsa0JBQWtCLEdBQUcsSUFBSSxDQUFDO0FBQ3JDLEtBQUs7QUFDTDtBQUNBLElBQUksSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3JDO0FBQ0EsSUFBSSxJQUFJLENBQUMsZUFBZSxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUM7QUFDaEQsSUFBSSxJQUFJLENBQUMsa0JBQWtCLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixJQUFJLElBQUksQ0FBQztBQUM5RCxJQUFJLElBQUksQ0FBQyxNQUFNLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQztBQUNqQztBQUNBLElBQUksSUFBSSxPQUFPLElBQUksS0FBSyxRQUFRLEVBQUU7QUFDbEMsTUFBTSxNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7QUFDakQsS0FBSztBQUNMO0FBQ0EsSUFBSSxJQUFJLFlBQVksR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLElBQUksRUFBRSxJQUFJLElBQUksQ0FBQztBQUNsRCxJQUFJLElBQUksT0FBTyxHQUFHLFlBQVksQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDbkQ7QUFDQSxJQUFJLElBQUksQ0FBQyxJQUFJLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQztBQUM3QixJQUFJLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sSUFBSSxPQUFPLENBQUMsT0FBTyxDQUFDO0FBQ25EO0FBQ0EsSUFBSSxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztBQUNyQixJQUFJLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQztBQUNqQyxJQUFJLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUMsU0FBUyxFQUFFLGtCQUFrQixFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0FBQ3pFO0FBQ0EsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDO0FBQ3ZDLFFBQVEsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRTtBQUNqRCxNQUFNLE1BQU0sSUFBSSxLQUFLLENBQUMsbUJBQW1CLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQzFELEtBQUs7QUFDTDtBQUNBLElBQUksSUFBSSxJQUFJLENBQUMsWUFBWSxFQUFFO0FBQzNCLE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQztBQUM5QyxVQUFVLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUU7QUFDeEQsUUFBUSxNQUFNLElBQUksS0FBSyxDQUFDLHdCQUF3QixHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUN0RSxPQUFPO0FBQ1AsS0FBSztBQUNMO0FBQ0EsSUFBSSxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksU0FBUyxFQUFFLENBQUM7QUFDckM7QUFDQSxJQUFJLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQztBQUNoQztBQUNBLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsQ0FBQyxHQUFHLEtBQUs7QUFDN0QsTUFBTSxJQUFJLEdBQUcsRUFBRTtBQUNmLFFBQVEsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUN4QyxPQUFPO0FBQ1AsTUFBTSxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNsQztBQUNBLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDakMsTUFBTSxPQUFPLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDekMsTUFBTSxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNqQyxLQUFLLENBQUMsQ0FBQztBQUNQLEdBQUc7QUFDSCxDQUFDO0FBQ0Q7QUFDQSxNQUFNLE9BQU8sR0FBRyxXQUFXLENBQUMsYUFBYSxFQUFFLFVBQVUsSUFBSSxFQUFFLElBQUksRUFBRTtBQUNqRSxFQUFFLGFBQWEsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQ3hELENBQUMsQ0FBQyxDQUFDO0FBQ0g7QUFDQSxNQUFNLFlBQVksR0FBRyxlQUFlLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDOUM7QUFDQSxnQkFBZSxPQUFPOztBQzVHUCxNQUFNLFdBQVcsQ0FBQztBQUNqQyxFQUFFLFdBQVcsR0FBRztBQUNoQixJQUFJLElBQUksQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDO0FBQ3BCLEdBQUc7QUFDSDtBQUNBLEVBQUUsSUFBSSxHQUFHO0FBQ1QsSUFBSSxPQUFPLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ3JDLEdBQUc7QUFDSDtBQUNBLEVBQUUsR0FBRyxDQUFDLElBQUksRUFBRTtBQUNaLElBQUksTUFBTSxFQUFFLEdBQUdDLEVBQU0sRUFBRSxDQUFDO0FBQ3hCLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsR0FBRztBQUNyQixNQUFNLEVBQUU7QUFDUixNQUFNLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSTtBQUNyQixNQUFNLFdBQVcsRUFBRSxJQUFJLENBQUMsV0FBVztBQUNuQyxNQUFNLFVBQVUsRUFBRSxJQUFJLElBQUksRUFBRSxDQUFDLE1BQU0sRUFBRTtBQUNyQyxLQUFLLENBQUM7QUFDTixJQUFJLE9BQU8sRUFBRSxDQUFDO0FBQ2QsR0FBRztBQUNIO0FBQ0EsRUFBRSxHQUFHLENBQUMsRUFBRSxFQUFFO0FBQ1YsSUFBSSxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDMUIsR0FBRztBQUNIO0FBQ0E7QUFDQSxFQUFFLE1BQU0sQ0FBQyxFQUFFLEVBQUUsTUFBTSxFQUFFO0FBQ3JCLElBQUksT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQzFCLElBQUksT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDO0FBQ3RCLEdBQUc7QUFDSDtBQUNBLEVBQUUsTUFBTSxDQUFDLEVBQUUsRUFBRSxXQUFXLEVBQUU7QUFDMUIsSUFBSSxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ2hDLElBQUksSUFBSSxPQUFPLElBQUksS0FBSyxXQUFXLEVBQUU7QUFDckMsTUFBTSxNQUFNLFVBQVUsR0FBRztBQUN6QixRQUFRLEVBQUUsRUFBRSxJQUFJLENBQUMsRUFBRTtBQUNuQixRQUFRLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSTtBQUN2QixRQUFRLFVBQVUsRUFBRSxJQUFJLENBQUMsVUFBVTtBQUNuQyxRQUFRLFdBQVcsRUFBRSxXQUFXLENBQUMsV0FBVyxJQUFJLElBQUksQ0FBQyxXQUFXO0FBQ2hFLFFBQVEsZUFBZSxFQUFFLFdBQVcsQ0FBQyxlQUFlLElBQUksSUFBSSxDQUFDLGVBQWU7QUFDNUUsUUFBUSxVQUFVLEVBQUUsSUFBSSxJQUFJLEVBQUUsQ0FBQyxNQUFNLEVBQUU7QUFDdkMsT0FBTyxDQUFDO0FBQ1IsTUFBTSxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFVBQVUsQ0FBQztBQUNsQyxLQUFLO0FBQ0wsSUFBSSxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUM7QUFDdEIsR0FBRztBQUNIOztBQy9DQTtBQUNBO0FBTUE7QUFDQUwsU0FBTyxDQUFDLFFBQVEsR0FBRyxFQUFFLENBQUM7QUFDdEJBLFNBQU8sQ0FBQyxpQkFBaUIsR0FBRyxFQUFFLENBQUM7QUFDL0I7QUFDQUEsU0FBTyxDQUFDLE1BQU0sR0FBRyxTQUFTLENBQUM7QUFDM0I7QUFDQSxJQUFJLFlBQVksR0FBRyxJQUFJTSxRQUFFLEVBQUUsQ0FBQztBQUM1QjtBQUNBLFNBQVMsaUJBQWlCLENBQUMsS0FBSyxFQUFFO0FBQ2xDLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQ0EsUUFBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFVLEdBQUcsRUFBRTtBQUNuRCxJQUFJLElBQUksT0FBT0EsUUFBRSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsS0FBSyxVQUFVLEVBQUU7QUFDakQsTUFBTSxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUN4RCxLQUFLO0FBQ0wsR0FBRyxDQUFDLENBQUM7QUFDTDtBQUNBO0FBQ0E7QUFDQSxFQUFFLElBQUksaUJBQWlCLEdBQUcsS0FBSyxDQUFDLHFCQUFxQixHQUFHLElBQUksR0FBRyxFQUFFLENBQUM7QUFDbEU7QUFDQSxFQUFFLEtBQUssQ0FBQyxFQUFFLENBQUMsS0FBSyxFQUFFLFNBQVMsZ0JBQWdCLENBQUMsRUFBRSxFQUFFO0FBQ2hELElBQUksSUFBSSxDQUFDLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUU7QUFDekMsTUFBTSxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQztBQUN6QyxLQUFLO0FBQ0wsSUFBSSxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUM1QyxHQUFHLENBQUMsQ0FBQztBQUNMO0FBQ0EsRUFBRSxLQUFLLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxTQUFTLGtCQUFrQixDQUFDLEVBQUUsRUFBRTtBQUNwRCxJQUFJLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFO0FBQ3pDLE1BQU0sT0FBTztBQUNiLEtBQUs7QUFDTCxJQUFJLElBQUksTUFBTSxHQUFHLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDaEQsSUFBSSxJQUFJLEdBQUcsR0FBRyxNQUFNLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ2pDLElBQUksSUFBSSxHQUFHLEdBQUcsQ0FBQyxFQUFFO0FBQ2pCO0FBQ0EsTUFBTSxPQUFPO0FBQ2IsS0FBSztBQUNMLElBQUksTUFBTSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDMUIsSUFBSSxJQUFJLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO0FBQzNCO0FBQ0EsTUFBTSxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztBQUM3QyxLQUFLLE1BQU07QUFDWCxNQUFNLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDeEMsS0FBSztBQUNMLEdBQUcsQ0FBQyxDQUFDO0FBQ0w7QUFDQSxFQUFFLEtBQUssQ0FBQyxFQUFFLENBQUMsV0FBVyxFQUFFLFNBQVMsc0JBQXNCLENBQUMsSUFBSSxFQUFFO0FBQzlELElBQUksSUFBSSxDQUFDLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRTtBQUN0QyxNQUFNLE9BQU87QUFDYixLQUFLO0FBQ0wsSUFBSSxJQUFJLE1BQU0sR0FBRyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDN0MsSUFBSSxpQkFBaUIsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDbkMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxFQUFFO0FBQ2pDLE1BQU0sRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDaEMsS0FBSyxDQUFDLENBQUM7QUFDUCxHQUFHLENBQUMsQ0FBQztBQUNMLENBQUM7QUFDRDtBQUNBLGlCQUFpQixDQUFDTixTQUFPLENBQUMsQ0FBQztBQUMzQjtBQUNBQSxTQUFPLENBQUMsT0FBTyxHQUFHLFVBQVUsRUFBRSxFQUFFLEdBQUcsRUFBRSxzQkFBc0IsRUFBRTtBQUM3RDtBQUNBLEVBQUUsSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFLEVBQUU7QUFDbkIsSUFBSUEsU0FBTyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsR0FBRyxHQUFHLENBQUM7QUFDL0IsSUFBSSxJQUFJLHNCQUFzQixFQUFFO0FBQ2hDLE1BQU1BLFNBQU8sQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDekMsS0FBSztBQUNMLEdBQUc7QUFDSCxDQUFDLENBQUM7QUFDRjtBQUNBQSxTQUFPLENBQUMsTUFBTSxHQUFHLFVBQVUsR0FBRyxFQUFFO0FBQ2hDLEVBQUUsSUFBSSxPQUFPLEdBQUcsS0FBSyxVQUFVLEVBQUU7QUFDakMsSUFBSSxHQUFHLENBQUNBLFNBQU8sQ0FBQyxDQUFDO0FBQ2pCLEdBQUcsTUFBTSxJQUFJLE9BQU8sR0FBRyxLQUFLLFFBQVEsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7QUFDdkUsSUFBSSxNQUFNLElBQUksS0FBSyxDQUFDLHVCQUF1QixHQUFHLEdBQUcsR0FBRyxxQ0FBcUMsQ0FBQyxDQUFDO0FBQzNGLEdBQUcsTUFBTTtBQUNULElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLEVBQUU7QUFDM0MsTUFBTUEsU0FBTyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsR0FBRyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDdEMsS0FBSyxDQUFDLENBQUM7QUFDUCxHQUFHO0FBQ0gsRUFBRSxJQUFJLElBQUksQ0FBQyxVQUFVLEVBQUU7QUFDdkIsSUFBSUEsU0FBTyxDQUFDLFVBQVUsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDNUQsR0FBRztBQUNILEVBQUUsT0FBT0EsU0FBTyxDQUFDO0FBQ2pCLENBQUMsQ0FBQztBQUNGO0FBQ0FBLFNBQU8sQ0FBQyxRQUFRLEdBQUcsVUFBVSxXQUFXLEVBQUU7QUFDMUMsRUFBRSxJQUFJLGlCQUFpQixHQUFHLFdBQVcsQ0FBQ0EsU0FBTyxFQUFFLFVBQVUsSUFBSSxFQUFFLElBQUksRUFBRTtBQUNyRSxJQUFJLElBQUksR0FBRyxJQUFJLElBQUksRUFBRSxDQUFDO0FBQ3RCO0FBQ0EsSUFBSSxJQUFJLElBQUksSUFBSSxPQUFPLElBQUksS0FBSyxRQUFRLEVBQUU7QUFDMUMsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDO0FBQ2xCLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7QUFDdkIsTUFBTSxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUM7QUFDdkIsS0FBSztBQUNMO0FBQ0EsSUFBSSxJQUFJLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsaUJBQWlCLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQ2pFLElBQUlBLFNBQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztBQUNuQyxHQUFHLENBQUMsQ0FBQztBQUNMO0FBQ0EsRUFBRSxpQkFBaUIsQ0FBQyxpQkFBaUIsR0FBR0EsU0FBTyxDQUFDLGlCQUFpQixDQUFDLEtBQUssRUFBRSxDQUFDO0FBQzFFLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQ0EsU0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQVUsR0FBRyxFQUFFO0FBQzlDLElBQUksSUFBSSxFQUFFLEdBQUcsSUFBSSxpQkFBaUIsQ0FBQyxFQUFFO0FBQ3JDLE1BQU0saUJBQWlCLENBQUMsR0FBRyxDQUFDLEdBQUdBLFNBQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUM1QyxLQUFLO0FBQ0wsR0FBRyxDQUFDLENBQUM7QUFDTDtBQUNBO0FBQ0E7QUFDQSxFQUFFLGlCQUFpQixDQUFDLFVBQVUsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsVUFBVSxFQUFFLFdBQVcsQ0FBQyxDQUFDO0FBQ2pGO0FBQ0EsRUFBRSxPQUFPLGlCQUFpQixDQUFDO0FBQzNCLENBQUMsQ0FBQztBQUNGO0FBQ0FBLFNBQU8sQ0FBQyxLQUFLLEdBQUcsVUFBVSxHQUFHLEVBQUUsSUFBSSxFQUFFO0FBQ3JDLEVBQUUsT0FBTyxLQUFLLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQzFCLENBQUMsQ0FBQztBQUNGO0FBQ0FBLFNBQU8sQ0FBQyxTQUFTLENBQUMsV0FBVyxHQUFHQSxTQUFPLENBQUMsV0FBVyxHQUFHLElBQUksV0FBVyxFQUFFOztBQzVIdkU7QUFDQSxjQUFlLGtCQUFrQjs7QUNHakM7QUFDQUEsU0FBTyxDQUFDLE1BQU0sQ0FBQ08sd0JBQWtCLENBQUMsQ0FBQztBQUNuQztBQUNBUCxTQUFPLENBQUMsT0FBTyxHQUFHLE9BQU87Ozs7In0=
