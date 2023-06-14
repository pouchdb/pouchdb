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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG91Y2hkYi1jb3JlLmJyb3dzZXIuanMiLCJzb3VyY2VzIjpbIi4uL3BhY2thZ2VzL3BvdWNoZGItY29yZS9zcmMvY2hhbmdlcy5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItY29yZS9zcmMvYWRhcHRlci5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItY29yZS9zcmMvdGFza3F1ZXVlLmpzIiwiLi4vcGFja2FnZXMvcG91Y2hkYi1jb3JlL3NyYy9wYXJzZUFkYXB0ZXIuanMiLCIuLi9wYWNrYWdlcy9wb3VjaGRiLWNvcmUvc3JjL3V0aWxzLmpzIiwiLi4vcGFja2FnZXMvcG91Y2hkYi1jb3JlL3NyYy9jb25zdHJ1Y3Rvci5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItY29yZS9zcmMvYWN0aXZlLXRhc2tzLmpzIiwiLi4vcGFja2FnZXMvcG91Y2hkYi1jb3JlL3NyYy9zZXR1cC5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItY29yZS9zcmMvdmVyc2lvbi5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItY29yZS9zcmMvaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcbiAgY2xvbmUsXG4gIGxpc3RlbmVyQ291bnQsXG4gIG9uY2UsXG4gIGd1YXJkZWRDb25zb2xlXG59IGZyb20gJ3BvdWNoZGItdXRpbHMnO1xuaW1wb3J0IHtcbiAgaXNEZWxldGVkLFxuICBjb2xsZWN0TGVhdmVzLFxuICBjb2xsZWN0Q29uZmxpY3RzXG59IGZyb20gJ3BvdWNoZGItbWVyZ2UnO1xuaW1wb3J0IGV2ZW50cyBmcm9tICdub2RlOmV2ZW50cyc7XG5cbmltcG9ydCBQb3VjaERCIGZyb20gJy4vc2V0dXAnO1xuXG5mdW5jdGlvbiB0cnlDYXRjaEluQ2hhbmdlTGlzdGVuZXIoc2VsZiwgY2hhbmdlLCBwZW5kaW5nLCBsYXN0U2VxKSB7XG4gIC8vIGlzb2xhdGUgdHJ5L2NhdGNoZXMgdG8gYXZvaWQgVjggZGVvcHRpbWl6YXRpb25zXG4gIHRyeSB7XG4gICAgc2VsZi5lbWl0KCdjaGFuZ2UnLCBjaGFuZ2UsIHBlbmRpbmcsIGxhc3RTZXEpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgZ3VhcmRlZENvbnNvbGUoJ2Vycm9yJywgJ0Vycm9yIGluIC5vbihcImNoYW5nZVwiLCBmdW5jdGlvbik6JywgZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcHJvY2Vzc0NoYW5nZShkb2MsIG1ldGFkYXRhLCBvcHRzKSB7XG4gIHZhciBjaGFuZ2VMaXN0ID0gW3tyZXY6IGRvYy5fcmV2fV07XG4gIGlmIChvcHRzLnN0eWxlID09PSAnYWxsX2RvY3MnKSB7XG4gICAgY2hhbmdlTGlzdCA9IGNvbGxlY3RMZWF2ZXMobWV0YWRhdGEucmV2X3RyZWUpXG4gICAgLm1hcChmdW5jdGlvbiAoeCkgeyByZXR1cm4ge3JldjogeC5yZXZ9OyB9KTtcbiAgfVxuICB2YXIgY2hhbmdlID0ge1xuICAgIGlkOiBtZXRhZGF0YS5pZCxcbiAgICBjaGFuZ2VzOiBjaGFuZ2VMaXN0LFxuICAgIGRvYzogZG9jXG4gIH07XG5cbiAgaWYgKGlzRGVsZXRlZChtZXRhZGF0YSwgZG9jLl9yZXYpKSB7XG4gICAgY2hhbmdlLmRlbGV0ZWQgPSB0cnVlO1xuICB9XG4gIGlmIChvcHRzLmNvbmZsaWN0cykge1xuICAgIGNoYW5nZS5kb2MuX2NvbmZsaWN0cyA9IGNvbGxlY3RDb25mbGljdHMobWV0YWRhdGEpO1xuICAgIGlmICghY2hhbmdlLmRvYy5fY29uZmxpY3RzLmxlbmd0aCkge1xuICAgICAgZGVsZXRlIGNoYW5nZS5kb2MuX2NvbmZsaWN0cztcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGNoYW5nZTtcbn1cblxuY2xhc3MgQ2hhbmdlcyBleHRlbmRzIGV2ZW50cyB7XG4gIGNvbnN0cnVjdG9yKGRiLCBvcHRzLCBjYWxsYmFjaykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5kYiA9IGRiO1xuICAgIG9wdHMgPSBvcHRzID8gY2xvbmUob3B0cykgOiB7fTtcbiAgICB2YXIgY29tcGxldGUgPSBvcHRzLmNvbXBsZXRlID0gb25jZSgoZXJyLCByZXNwKSA9PiB7XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIGlmIChsaXN0ZW5lckNvdW50KHRoaXMsICdlcnJvcicpID4gMCkge1xuICAgICAgICAgIHRoaXMuZW1pdCgnZXJyb3InLCBlcnIpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmVtaXQoJ2NvbXBsZXRlJywgcmVzcCk7XG4gICAgICB9XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygpO1xuICAgICAgZGIucmVtb3ZlTGlzdGVuZXIoJ2Rlc3Ryb3llZCcsIG9uRGVzdHJveSk7XG4gICAgfSk7XG4gICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICB0aGlzLm9uKCdjb21wbGV0ZScsIGZ1bmN0aW9uIChyZXNwKSB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3ApO1xuICAgICAgfSk7XG4gICAgICB0aGlzLm9uKCdlcnJvcicsIGNhbGxiYWNrKTtcbiAgICB9XG4gICAgY29uc3Qgb25EZXN0cm95ID0gKCkgPT4ge1xuICAgICAgdGhpcy5jYW5jZWwoKTtcbiAgICB9O1xuICAgIGRiLm9uY2UoJ2Rlc3Ryb3llZCcsIG9uRGVzdHJveSk7XG4gIFxuICAgIG9wdHMub25DaGFuZ2UgPSAoY2hhbmdlLCBwZW5kaW5nLCBsYXN0U2VxKSA9PiB7XG4gICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICAgIGlmICh0aGlzLmlzQ2FuY2VsbGVkKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHRyeUNhdGNoSW5DaGFuZ2VMaXN0ZW5lcih0aGlzLCBjaGFuZ2UsIHBlbmRpbmcsIGxhc3RTZXEpO1xuICAgIH07XG4gIFxuICAgIHZhciBwcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24gKGZ1bGZpbGwsIHJlamVjdCkge1xuICAgICAgb3B0cy5jb21wbGV0ZSA9IGZ1bmN0aW9uIChlcnIsIHJlcykge1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZnVsZmlsbChyZXMpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH0pO1xuICAgIHRoaXMub25jZSgnY2FuY2VsJywgZnVuY3Rpb24gKCkge1xuICAgICAgZGIucmVtb3ZlTGlzdGVuZXIoJ2Rlc3Ryb3llZCcsIG9uRGVzdHJveSk7XG4gICAgICBvcHRzLmNvbXBsZXRlKG51bGwsIHtzdGF0dXM6ICdjYW5jZWxsZWQnfSk7XG4gICAgfSk7XG4gICAgdGhpcy50aGVuID0gcHJvbWlzZS50aGVuLmJpbmQocHJvbWlzZSk7XG4gICAgdGhpc1snY2F0Y2gnXSA9IHByb21pc2VbJ2NhdGNoJ10uYmluZChwcm9taXNlKTtcbiAgICB0aGlzLnRoZW4oZnVuY3Rpb24gKHJlc3VsdCkge1xuICAgICAgY29tcGxldGUobnVsbCwgcmVzdWx0KTtcbiAgICB9LCBjb21wbGV0ZSk7XG4gIFxuICBcbiAgXG4gICAgaWYgKCFkYi50YXNrcXVldWUuaXNSZWFkeSkge1xuICAgICAgZGIudGFza3F1ZXVlLmFkZFRhc2soKGZhaWxlZCkgPT4ge1xuICAgICAgICBpZiAoZmFpbGVkKSB7XG4gICAgICAgICAgb3B0cy5jb21wbGV0ZShmYWlsZWQpO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuaXNDYW5jZWxsZWQpIHtcbiAgICAgICAgICB0aGlzLmVtaXQoJ2NhbmNlbCcpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMudmFsaWRhdGVDaGFuZ2VzKG9wdHMpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy52YWxpZGF0ZUNoYW5nZXMob3B0cyk7XG4gICAgfVxuICB9XG5cbiAgY2FuY2VsKCkge1xuICAgIHRoaXMuaXNDYW5jZWxsZWQgPSB0cnVlO1xuICAgIGlmICh0aGlzLmRiLnRhc2txdWV1ZS5pc1JlYWR5KSB7XG4gICAgICB0aGlzLmVtaXQoJ2NhbmNlbCcpO1xuICAgIH1cbiAgfVxuXG4gIHZhbGlkYXRlQ2hhbmdlcyhvcHRzKSB7XG4gICAgdmFyIGNhbGxiYWNrID0gb3B0cy5jb21wbGV0ZTtcbiAgXG4gICAgLyogaXN0YW5idWwgaWdub3JlIGVsc2UgKi9cbiAgICBpZiAoUG91Y2hEQi5fY2hhbmdlc0ZpbHRlclBsdWdpbikge1xuICAgICAgUG91Y2hEQi5fY2hhbmdlc0ZpbHRlclBsdWdpbi52YWxpZGF0ZShvcHRzLCAoZXJyKSA9PiB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmRvQ2hhbmdlcyhvcHRzKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRvQ2hhbmdlcyhvcHRzKTtcbiAgICB9XG4gIH1cblxuICBkb0NoYW5nZXMob3B0cykge1xuICAgIHZhciBjYWxsYmFjayA9IG9wdHMuY29tcGxldGU7XG4gIFxuICAgIG9wdHMgPSBjbG9uZShvcHRzKTtcbiAgICBpZiAoJ2xpdmUnIGluIG9wdHMgJiYgISgnY29udGludW91cycgaW4gb3B0cykpIHtcbiAgICAgIG9wdHMuY29udGludW91cyA9IG9wdHMubGl2ZTtcbiAgICB9XG4gICAgb3B0cy5wcm9jZXNzQ2hhbmdlID0gcHJvY2Vzc0NoYW5nZTtcbiAgXG4gICAgaWYgKG9wdHMuc2luY2UgPT09ICdsYXRlc3QnKSB7XG4gICAgICBvcHRzLnNpbmNlID0gJ25vdyc7XG4gICAgfVxuICAgIGlmICghb3B0cy5zaW5jZSkge1xuICAgICAgb3B0cy5zaW5jZSA9IDA7XG4gICAgfVxuICAgIGlmIChvcHRzLnNpbmNlID09PSAnbm93Jykge1xuICAgICAgdGhpcy5kYi5pbmZvKCkudGhlbigoaW5mbykgPT4ge1xuICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICAgICAgaWYgKHRoaXMuaXNDYW5jZWxsZWQpIHtcbiAgICAgICAgICBjYWxsYmFjayhudWxsLCB7c3RhdHVzOiAnY2FuY2VsbGVkJ30pO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBvcHRzLnNpbmNlID0gaW5mby51cGRhdGVfc2VxO1xuICAgICAgICB0aGlzLmRvQ2hhbmdlcyhvcHRzKTtcbiAgICAgIH0sIGNhbGxiYWNrKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gIFxuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBlbHNlICovXG4gICAgaWYgKFBvdWNoREIuX2NoYW5nZXNGaWx0ZXJQbHVnaW4pIHtcbiAgICAgIFBvdWNoREIuX2NoYW5nZXNGaWx0ZXJQbHVnaW4ubm9ybWFsaXplKG9wdHMpO1xuICAgICAgaWYgKFBvdWNoREIuX2NoYW5nZXNGaWx0ZXJQbHVnaW4uc2hvdWxkRmlsdGVyKHRoaXMsIG9wdHMpKSB7XG4gICAgICAgIHJldHVybiBQb3VjaERCLl9jaGFuZ2VzRmlsdGVyUGx1Z2luLmZpbHRlcih0aGlzLCBvcHRzKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgWydkb2NfaWRzJywgJ2ZpbHRlcicsICdzZWxlY3RvcicsICd2aWV3J10uZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgIGlmIChrZXkgaW4gb3B0cykge1xuICAgICAgICAgIGd1YXJkZWRDb25zb2xlKCd3YXJuJyxcbiAgICAgICAgICAgICdUaGUgXCInICsga2V5ICsgJ1wiIG9wdGlvbiB3YXMgcGFzc2VkIGluIHRvIGNoYW5nZXMvcmVwbGljYXRlLCAnICtcbiAgICAgICAgICAgICdidXQgcG91Y2hkYi1jaGFuZ2VzLWZpbHRlciBwbHVnaW4gaXMgbm90IGluc3RhbGxlZCwgc28gaXQgJyArXG4gICAgICAgICAgICAnd2FzIGlnbm9yZWQuIFBsZWFzZSBpbnN0YWxsIHRoZSBwbHVnaW4gdG8gZW5hYmxlIGZpbHRlcmluZy4nXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICBcbiAgICBpZiAoISgnZGVzY2VuZGluZycgaW4gb3B0cykpIHtcbiAgICAgIG9wdHMuZGVzY2VuZGluZyA9IGZhbHNlO1xuICAgIH1cbiAgXG4gICAgLy8gMCBhbmQgMSBzaG91bGQgcmV0dXJuIDEgZG9jdW1lbnRcbiAgICBvcHRzLmxpbWl0ID0gb3B0cy5saW1pdCA9PT0gMCA/IDEgOiBvcHRzLmxpbWl0O1xuICAgIG9wdHMuY29tcGxldGUgPSBjYWxsYmFjaztcbiAgICB2YXIgbmV3UHJvbWlzZSA9IHRoaXMuZGIuX2NoYW5nZXMob3B0cyk7XG4gICAgLyogaXN0YW5idWwgaWdub3JlIGVsc2UgKi9cbiAgICBpZiAobmV3UHJvbWlzZSAmJiB0eXBlb2YgbmV3UHJvbWlzZS5jYW5jZWwgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNvbnN0IGNhbmNlbCA9IHRoaXMuY2FuY2VsO1xuICAgICAgdGhpcy5jYW5jZWwgPSAoLi4uYXJncykgPT4ge1xuICAgICAgICBuZXdQcm9taXNlLmNhbmNlbCgpO1xuICAgICAgICBjYW5jZWwuYXBwbHkodGhpcywgYXJncyk7XG4gICAgICB9O1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBDaGFuZ2VzO1xuIiwiaW1wb3J0IHtcbiAgcmV2LFxuICBndWFyZGVkQ29uc29sZSxcbiAgaXNSZW1vdGVcbn0gZnJvbSAncG91Y2hkYi11dGlscyc7XG5pbXBvcnQgRXZlbnRFbWl0dGVyIGZyb20gJ2V2ZW50cyc7XG5pbXBvcnQgQ2hhbmdlcyBmcm9tICcuL2NoYW5nZXMnO1xuaW1wb3J0IHtcbiAgcGljayxcbiAgYWRhcHRlckZ1bixcbiAgdXBzZXJ0LFxuICBidWxrR2V0U2hpbSxcbiAgaW52YWxpZElkRXJyb3IsXG4gIG5leHRUaWNrLFxuICBjbG9uZVxufSBmcm9tICdwb3VjaGRiLXV0aWxzJztcbmltcG9ydCB7XG4gIHRyYXZlcnNlUmV2VHJlZSxcbiAgY29sbGVjdExlYXZlcyxcbiAgcm9vdFRvTGVhZixcbiAgY29sbGVjdENvbmZsaWN0cyxcbiAgaXNEZWxldGVkLFxuICBpc0xvY2FsSWQsXG4gIGZpbmRQYXRoVG9MZWFmXG59IGZyb20gJ3BvdWNoZGItbWVyZ2UnO1xuaW1wb3J0IHtcbiAgTUlTU0lOR19CVUxLX0RPQ1MsXG4gIE1JU1NJTkdfRE9DLFxuICBSRVZfQ09ORkxJQ1QsXG4gIElOVkFMSURfSUQsXG4gIFVOS05PV05fRVJST1IsXG4gIFFVRVJZX1BBUlNFX0VSUk9SLFxuICBCQURfUkVRVUVTVCxcbiAgTk9UX0FOX09CSkVDVCxcbiAgSU5WQUxJRF9SRVYsXG4gIGNyZWF0ZUVycm9yXG59IGZyb20gJ3BvdWNoZGItZXJyb3JzJztcblxuLypcbiAqIEEgZ2VuZXJpYyBwb3VjaCBhZGFwdGVyXG4gKi9cblxuZnVuY3Rpb24gY29tcGFyZShsZWZ0LCByaWdodCkge1xuICByZXR1cm4gbGVmdCA8IHJpZ2h0ID8gLTEgOiBsZWZ0ID4gcmlnaHQgPyAxIDogMDtcbn1cblxuLy8gV3JhcHBlciBmb3IgZnVuY3Rpb25zIHRoYXQgY2FsbCB0aGUgYnVsa2RvY3MgYXBpIHdpdGggYSBzaW5nbGUgZG9jLFxuLy8gaWYgdGhlIGZpcnN0IHJlc3VsdCBpcyBhbiBlcnJvciwgcmV0dXJuIGFuIGVycm9yXG5mdW5jdGlvbiB5YW5rRXJyb3IoY2FsbGJhY2ssIGRvY0lkKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoZXJyLCByZXN1bHRzKSB7XG4gICAgaWYgKGVyciB8fCAocmVzdWx0c1swXSAmJiByZXN1bHRzWzBdLmVycm9yKSkge1xuICAgICAgZXJyID0gZXJyIHx8IHJlc3VsdHNbMF07XG4gICAgICBlcnIuZG9jSWQgPSBkb2NJZDtcbiAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdHMubGVuZ3RoID8gcmVzdWx0c1swXSAgOiByZXN1bHRzKTtcbiAgICB9XG4gIH07XG59XG5cbi8vIGNsZWFuIGRvY3MgZ2l2ZW4gdG8gdXMgYnkgdGhlIHVzZXJcbmZ1bmN0aW9uIGNsZWFuRG9jcyhkb2NzKSB7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgZG9jcy5sZW5ndGg7IGkrKykge1xuICAgIHZhciBkb2MgPSBkb2NzW2ldO1xuICAgIGlmIChkb2MuX2RlbGV0ZWQpIHtcbiAgICAgIGRlbGV0ZSBkb2MuX2F0dGFjaG1lbnRzOyAvLyBpZ25vcmUgYXR0cyBmb3IgZGVsZXRlZCBkb2NzXG4gICAgfSBlbHNlIGlmIChkb2MuX2F0dGFjaG1lbnRzKSB7XG4gICAgICAvLyBmaWx0ZXIgb3V0IGV4dHJhbmVvdXMga2V5cyBmcm9tIF9hdHRhY2htZW50c1xuICAgICAgdmFyIGF0dHMgPSBPYmplY3Qua2V5cyhkb2MuX2F0dGFjaG1lbnRzKTtcbiAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgYXR0cy5sZW5ndGg7IGorKykge1xuICAgICAgICB2YXIgYXR0ID0gYXR0c1tqXTtcbiAgICAgICAgZG9jLl9hdHRhY2htZW50c1thdHRdID0gcGljayhkb2MuX2F0dGFjaG1lbnRzW2F0dF0sXG4gICAgICAgICAgWydkYXRhJywgJ2RpZ2VzdCcsICdjb250ZW50X3R5cGUnLCAnbGVuZ3RoJywgJ3JldnBvcycsICdzdHViJ10pO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vLyBjb21wYXJlIHR3byBkb2NzLCBmaXJzdCBieSBfaWQgdGhlbiBieSBfcmV2XG5mdW5jdGlvbiBjb21wYXJlQnlJZFRoZW5SZXYoYSwgYikge1xuICB2YXIgaWRDb21wYXJlID0gY29tcGFyZShhLl9pZCwgYi5faWQpO1xuICBpZiAoaWRDb21wYXJlICE9PSAwKSB7XG4gICAgcmV0dXJuIGlkQ29tcGFyZTtcbiAgfVxuICB2YXIgYVN0YXJ0ID0gYS5fcmV2aXNpb25zID8gYS5fcmV2aXNpb25zLnN0YXJ0IDogMDtcbiAgdmFyIGJTdGFydCA9IGIuX3JldmlzaW9ucyA/IGIuX3JldmlzaW9ucy5zdGFydCA6IDA7XG4gIHJldHVybiBjb21wYXJlKGFTdGFydCwgYlN0YXJ0KTtcbn1cblxuLy8gZm9yIGV2ZXJ5IG5vZGUgaW4gYSByZXZpc2lvbiB0cmVlIGNvbXB1dGVzIGl0cyBkaXN0YW5jZSBmcm9tIHRoZSBjbG9zZXN0XG4vLyBsZWFmXG5mdW5jdGlvbiBjb21wdXRlSGVpZ2h0KHJldnMpIHtcbiAgdmFyIGhlaWdodCA9IHt9O1xuICB2YXIgZWRnZXMgPSBbXTtcbiAgdHJhdmVyc2VSZXZUcmVlKHJldnMsIGZ1bmN0aW9uIChpc0xlYWYsIHBvcywgaWQsIHBybnQpIHtcbiAgICB2YXIgcmV2ID0gcG9zICsgXCItXCIgKyBpZDtcbiAgICBpZiAoaXNMZWFmKSB7XG4gICAgICBoZWlnaHRbcmV2XSA9IDA7XG4gICAgfVxuICAgIGlmIChwcm50ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGVkZ2VzLnB1c2goe2Zyb206IHBybnQsIHRvOiByZXZ9KTtcbiAgICB9XG4gICAgcmV0dXJuIHJldjtcbiAgfSk7XG5cbiAgZWRnZXMucmV2ZXJzZSgpO1xuICBlZGdlcy5mb3JFYWNoKGZ1bmN0aW9uIChlZGdlKSB7XG4gICAgaWYgKGhlaWdodFtlZGdlLmZyb21dID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGhlaWdodFtlZGdlLmZyb21dID0gMSArIGhlaWdodFtlZGdlLnRvXTtcbiAgICB9IGVsc2Uge1xuICAgICAgaGVpZ2h0W2VkZ2UuZnJvbV0gPSBNYXRoLm1pbihoZWlnaHRbZWRnZS5mcm9tXSwgMSArIGhlaWdodFtlZGdlLnRvXSk7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIGhlaWdodDtcbn1cblxuZnVuY3Rpb24gYWxsRG9jc0tleXNQYXJzZShvcHRzKSB7XG4gIHZhciBrZXlzID0gICgnbGltaXQnIGluIG9wdHMpID9cbiAgICBvcHRzLmtleXMuc2xpY2Uob3B0cy5za2lwLCBvcHRzLmxpbWl0ICsgb3B0cy5za2lwKSA6XG4gICAgKG9wdHMuc2tpcCA+IDApID8gb3B0cy5rZXlzLnNsaWNlKG9wdHMuc2tpcCkgOiBvcHRzLmtleXM7XG4gIG9wdHMua2V5cyA9IGtleXM7XG4gIG9wdHMuc2tpcCA9IDA7XG4gIGRlbGV0ZSBvcHRzLmxpbWl0O1xuICBpZiAob3B0cy5kZXNjZW5kaW5nKSB7XG4gICAga2V5cy5yZXZlcnNlKCk7XG4gICAgb3B0cy5kZXNjZW5kaW5nID0gZmFsc2U7XG4gIH1cbn1cblxuLy8gYWxsIGNvbXBhY3Rpb24gaXMgZG9uZSBpbiBhIHF1ZXVlLCB0byBhdm9pZCBhdHRhY2hpbmdcbi8vIHRvbyBtYW55IGxpc3RlbmVycyBhdCBvbmNlXG5mdW5jdGlvbiBkb05leHRDb21wYWN0aW9uKHNlbGYpIHtcbiAgdmFyIHRhc2sgPSBzZWxmLl9jb21wYWN0aW9uUXVldWVbMF07XG4gIHZhciBvcHRzID0gdGFzay5vcHRzO1xuICB2YXIgY2FsbGJhY2sgPSB0YXNrLmNhbGxiYWNrO1xuICBzZWxmLmdldCgnX2xvY2FsL2NvbXBhY3Rpb24nKS5jYXRjaChmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9KS50aGVuKGZ1bmN0aW9uIChkb2MpIHtcbiAgICBpZiAoZG9jICYmIGRvYy5sYXN0X3NlcSkge1xuICAgICAgb3B0cy5sYXN0X3NlcSA9IGRvYy5sYXN0X3NlcTtcbiAgICB9XG4gICAgc2VsZi5fY29tcGFjdChvcHRzLCBmdW5jdGlvbiAoZXJyLCByZXMpIHtcbiAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgICAgaWYgKGVycikge1xuICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzKTtcbiAgICAgIH1cbiAgICAgIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgc2VsZi5fY29tcGFjdGlvblF1ZXVlLnNoaWZ0KCk7XG4gICAgICAgIGlmIChzZWxmLl9jb21wYWN0aW9uUXVldWUubGVuZ3RoKSB7XG4gICAgICAgICAgZG9OZXh0Q29tcGFjdGlvbihzZWxmKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBhcHBlbmRQdXJnZVNlcShkYiwgZG9jSWQsIHJldikge1xuICByZXR1cm4gZGIuZ2V0KCdfbG9jYWwvcHVyZ2VzJykudGhlbihmdW5jdGlvbiAoZG9jKSB7XG4gICAgY29uc3QgcHVyZ2VTZXEgPSBkb2MucHVyZ2VTZXEgKyAxO1xuICAgIGRvYy5wdXJnZXMucHVzaCh7XG4gICAgICBkb2NJZCxcbiAgICAgIHJldixcbiAgICAgIHB1cmdlU2VxLFxuICAgIH0pO1xuICAgIGlmIChkb2MucHVyZ2VzLmxlbmd0aCA+IHNlbGYucHVyZ2VkX2luZm9zX2xpbWl0KSB7XG4gICAgICBkb2MucHVyZ2VzLnNwbGljZSgwLCBkb2MucHVyZ2VzLmxlbmd0aCAtIHNlbGYucHVyZ2VkX2luZm9zX2xpbWl0KTtcbiAgICB9XG4gICAgZG9jLnB1cmdlU2VxID0gcHVyZ2VTZXE7XG4gICAgcmV0dXJuIGRvYztcbiAgfSkuY2F0Y2goZnVuY3Rpb24gKGVycikge1xuICAgIGlmIChlcnIuc3RhdHVzICE9PSA0MDQpIHtcbiAgICAgIHRocm93IGVycjtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIF9pZDogJ19sb2NhbC9wdXJnZXMnLFxuICAgICAgcHVyZ2VzOiBbe1xuICAgICAgICBkb2NJZCxcbiAgICAgICAgcmV2LFxuICAgICAgICBwdXJnZVNlcTogMCxcbiAgICAgIH1dLFxuICAgICAgcHVyZ2VTZXE6IDAsXG4gICAgfTtcbiAgfSkudGhlbihmdW5jdGlvbiAoZG9jKSB7XG4gICAgcmV0dXJuIGRiLnB1dChkb2MpO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gYXR0YWNobWVudE5hbWVFcnJvcihuYW1lKSB7XG4gIGlmIChuYW1lLmNoYXJBdCgwKSA9PT0gJ18nKSB7XG4gICAgcmV0dXJuIG5hbWUgKyAnIGlzIG5vdCBhIHZhbGlkIGF0dGFjaG1lbnQgbmFtZSwgYXR0YWNobWVudCAnICtcbiAgICAgICduYW1lcyBjYW5ub3Qgc3RhcnQgd2l0aCBcXCdfXFwnJztcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbmNsYXNzIEFic3RyYWN0UG91Y2hEQiBleHRlbmRzIEV2ZW50RW1pdHRlciB7XG4gIF9zZXR1cCgpIHtcbiAgICB0aGlzLnBvc3QgPSBhZGFwdGVyRnVuKCdwb3N0JywgZnVuY3Rpb24gKGRvYywgb3B0cywgY2FsbGJhY2spIHtcbiAgICAgIGlmICh0eXBlb2Ygb3B0cyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBjYWxsYmFjayA9IG9wdHM7XG4gICAgICAgIG9wdHMgPSB7fTtcbiAgICAgIH1cbiAgICAgIGlmICh0eXBlb2YgZG9jICE9PSAnb2JqZWN0JyB8fCBBcnJheS5pc0FycmF5KGRvYykpIHtcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGNyZWF0ZUVycm9yKE5PVF9BTl9PQkpFQ1QpKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuYnVsa0RvY3Moe2RvY3M6IFtkb2NdfSwgb3B0cywgeWFua0Vycm9yKGNhbGxiYWNrLCBkb2MuX2lkKSk7XG4gICAgfSkuYmluZCh0aGlzKTtcblxuICAgIHRoaXMucHV0ID0gYWRhcHRlckZ1bigncHV0JywgZnVuY3Rpb24gKGRvYywgb3B0cywgY2IpIHtcbiAgICAgIGlmICh0eXBlb2Ygb3B0cyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBjYiA9IG9wdHM7XG4gICAgICAgIG9wdHMgPSB7fTtcbiAgICAgIH1cbiAgICAgIGlmICh0eXBlb2YgZG9jICE9PSAnb2JqZWN0JyB8fCBBcnJheS5pc0FycmF5KGRvYykpIHtcbiAgICAgICAgcmV0dXJuIGNiKGNyZWF0ZUVycm9yKE5PVF9BTl9PQkpFQ1QpKTtcbiAgICAgIH1cbiAgICAgIGludmFsaWRJZEVycm9yKGRvYy5faWQpO1xuICAgICAgaWYgKGlzTG9jYWxJZChkb2MuX2lkKSAmJiB0eXBlb2YgdGhpcy5fcHV0TG9jYWwgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgaWYgKGRvYy5fZGVsZXRlZCkge1xuICAgICAgICAgIHJldHVybiB0aGlzLl9yZW1vdmVMb2NhbChkb2MsIGNiKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5fcHV0TG9jYWwoZG9jLCBjYik7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgY29uc3QgcHV0RG9jID0gKG5leHQpID0+IHtcbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzLl9wdXQgPT09ICdmdW5jdGlvbicgJiYgb3B0cy5uZXdfZWRpdHMgIT09IGZhbHNlKSB7XG4gICAgICAgICAgdGhpcy5fcHV0KGRvYywgb3B0cywgbmV4dCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5idWxrRG9jcyh7ZG9jczogW2RvY119LCBvcHRzLCB5YW5rRXJyb3IobmV4dCwgZG9jLl9pZCkpO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICBpZiAob3B0cy5mb3JjZSAmJiBkb2MuX3Jldikge1xuICAgICAgICB0cmFuc2Zvcm1Gb3JjZU9wdGlvblRvTmV3RWRpdHNPcHRpb24oKTtcbiAgICAgICAgcHV0RG9jKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICB2YXIgcmVzdWx0ID0gZXJyID8gbnVsbCA6IHtvazogdHJ1ZSwgaWQ6IGRvYy5faWQsIHJldjogZG9jLl9yZXZ9O1xuICAgICAgICAgIGNiKGVyciwgcmVzdWx0KTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwdXREb2MoY2IpO1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiB0cmFuc2Zvcm1Gb3JjZU9wdGlvblRvTmV3RWRpdHNPcHRpb24oKSB7XG4gICAgICAgIHZhciBwYXJ0cyA9IGRvYy5fcmV2LnNwbGl0KCctJyk7XG4gICAgICAgIHZhciBvbGRSZXZJZCA9IHBhcnRzWzFdO1xuICAgICAgICB2YXIgb2xkUmV2TnVtID0gcGFyc2VJbnQocGFydHNbMF0sIDEwKTtcblxuICAgICAgICB2YXIgbmV3UmV2TnVtID0gb2xkUmV2TnVtICsgMTtcbiAgICAgICAgdmFyIG5ld1JldklkID0gcmV2KCk7XG5cbiAgICAgICAgZG9jLl9yZXZpc2lvbnMgPSB7XG4gICAgICAgICAgc3RhcnQ6IG5ld1Jldk51bSxcbiAgICAgICAgICBpZHM6IFtuZXdSZXZJZCwgb2xkUmV2SWRdXG4gICAgICAgIH07XG4gICAgICAgIGRvYy5fcmV2ID0gbmV3UmV2TnVtICsgJy0nICsgbmV3UmV2SWQ7XG4gICAgICAgIG9wdHMubmV3X2VkaXRzID0gZmFsc2U7XG4gICAgICB9XG4gICAgfSkuYmluZCh0aGlzKTtcblxuICAgIHRoaXMucHV0QXR0YWNobWVudCA9IGFkYXB0ZXJGdW4oJ3B1dEF0dGFjaG1lbnQnLCBmdW5jdGlvbiAoZG9jSWQsIGF0dGFjaG1lbnRJZCwgcmV2LCBibG9iLCB0eXBlKSB7XG4gICAgICB2YXIgYXBpID0gdGhpcztcbiAgICAgIGlmICh0eXBlb2YgdHlwZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICB0eXBlID0gYmxvYjtcbiAgICAgICAgYmxvYiA9IHJldjtcbiAgICAgICAgcmV2ID0gbnVsbDtcbiAgICAgIH1cbiAgICAgIC8vIExldHMgZml4IGluIGh0dHBzOi8vZ2l0aHViLmNvbS9wb3VjaGRiL3BvdWNoZGIvaXNzdWVzLzMyNjdcbiAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgICAgaWYgKHR5cGVvZiB0eXBlID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICB0eXBlID0gYmxvYjtcbiAgICAgICAgYmxvYiA9IHJldjtcbiAgICAgICAgcmV2ID0gbnVsbDtcbiAgICAgIH1cbiAgICAgIGlmICghdHlwZSkge1xuICAgICAgICBndWFyZGVkQ29uc29sZSgnd2FybicsICdBdHRhY2htZW50JywgYXR0YWNobWVudElkLCAnb24gZG9jdW1lbnQnLCBkb2NJZCwgJ2lzIG1pc3NpbmcgY29udGVudF90eXBlJyk7XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIGNyZWF0ZUF0dGFjaG1lbnQoZG9jKSB7XG4gICAgICAgIHZhciBwcmV2cmV2cG9zID0gJ19yZXYnIGluIGRvYyA/IHBhcnNlSW50KGRvYy5fcmV2LCAxMCkgOiAwO1xuICAgICAgICBkb2MuX2F0dGFjaG1lbnRzID0gZG9jLl9hdHRhY2htZW50cyB8fCB7fTtcbiAgICAgICAgZG9jLl9hdHRhY2htZW50c1thdHRhY2htZW50SWRdID0ge1xuICAgICAgICAgIGNvbnRlbnRfdHlwZTogdHlwZSxcbiAgICAgICAgICBkYXRhOiBibG9iLFxuICAgICAgICAgIHJldnBvczogKytwcmV2cmV2cG9zXG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBhcGkucHV0KGRvYyk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBhcGkuZ2V0KGRvY0lkKS50aGVuKGZ1bmN0aW9uIChkb2MpIHtcbiAgICAgICAgaWYgKGRvYy5fcmV2ICE9PSByZXYpIHtcbiAgICAgICAgICB0aHJvdyBjcmVhdGVFcnJvcihSRVZfQ09ORkxJQ1QpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNyZWF0ZUF0dGFjaG1lbnQoZG9jKTtcbiAgICAgIH0sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgLy8gY3JlYXRlIG5ldyBkb2NcbiAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIGVsc2UgKi9cbiAgICAgICAgaWYgKGVyci5yZWFzb24gPT09IE1JU1NJTkdfRE9DLm1lc3NhZ2UpIHtcbiAgICAgICAgICByZXR1cm4gY3JlYXRlQXR0YWNobWVudCh7X2lkOiBkb2NJZH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSkuYmluZCh0aGlzKTtcblxuICAgIHRoaXMucmVtb3ZlQXR0YWNobWVudCA9IGFkYXB0ZXJGdW4oJ3JlbW92ZUF0dGFjaG1lbnQnLCBmdW5jdGlvbiAoZG9jSWQsIGF0dGFjaG1lbnRJZCwgcmV2LCBjYWxsYmFjaykge1xuICAgICAgdGhpcy5nZXQoZG9jSWQsIChlcnIsIG9iaikgPT4ge1xuICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvYmouX3JldiAhPT0gcmV2KSB7XG4gICAgICAgICAgY2FsbGJhY2soY3JlYXRlRXJyb3IoUkVWX0NPTkZMSUNUKSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgICAgICBpZiAoIW9iai5fYXR0YWNobWVudHMpIHtcbiAgICAgICAgICByZXR1cm4gY2FsbGJhY2soKTtcbiAgICAgICAgfVxuICAgICAgICBkZWxldGUgb2JqLl9hdHRhY2htZW50c1thdHRhY2htZW50SWRdO1xuICAgICAgICBpZiAoT2JqZWN0LmtleXMob2JqLl9hdHRhY2htZW50cykubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgZGVsZXRlIG9iai5fYXR0YWNobWVudHM7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5wdXQob2JqLCBjYWxsYmFjayk7XG4gICAgICB9KTtcbiAgICB9KS5iaW5kKHRoaXMpO1xuXG4gICAgdGhpcy5yZW1vdmUgPSBhZGFwdGVyRnVuKCdyZW1vdmUnLCBmdW5jdGlvbiAoZG9jT3JJZCwgb3B0c09yUmV2LCBvcHRzLCBjYWxsYmFjaykge1xuICAgICAgdmFyIGRvYztcbiAgICAgIGlmICh0eXBlb2Ygb3B0c09yUmV2ID09PSAnc3RyaW5nJykge1xuICAgICAgICAvLyBpZCwgcmV2LCBvcHRzLCBjYWxsYmFjayBzdHlsZVxuICAgICAgICBkb2MgPSB7XG4gICAgICAgICAgX2lkOiBkb2NPcklkLFxuICAgICAgICAgIF9yZXY6IG9wdHNPclJldlxuICAgICAgICB9O1xuICAgICAgICBpZiAodHlwZW9mIG9wdHMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICBjYWxsYmFjayA9IG9wdHM7XG4gICAgICAgICAgb3B0cyA9IHt9O1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBkb2MsIG9wdHMsIGNhbGxiYWNrIHN0eWxlXG4gICAgICAgIGRvYyA9IGRvY09ySWQ7XG4gICAgICAgIGlmICh0eXBlb2Ygb3B0c09yUmV2ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgY2FsbGJhY2sgPSBvcHRzT3JSZXY7XG4gICAgICAgICAgb3B0cyA9IHt9O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNhbGxiYWNrID0gb3B0cztcbiAgICAgICAgICBvcHRzID0gb3B0c09yUmV2O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICAgIG9wdHMud2FzX2RlbGV0ZSA9IHRydWU7XG4gICAgICB2YXIgbmV3RG9jID0ge19pZDogZG9jLl9pZCwgX3JldjogKGRvYy5fcmV2IHx8IG9wdHMucmV2KX07XG4gICAgICBuZXdEb2MuX2RlbGV0ZWQgPSB0cnVlO1xuICAgICAgaWYgKGlzTG9jYWxJZChuZXdEb2MuX2lkKSAmJiB0eXBlb2YgdGhpcy5fcmVtb3ZlTG9jYWwgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JlbW92ZUxvY2FsKGRvYywgY2FsbGJhY2spO1xuICAgICAgfVxuICAgICAgdGhpcy5idWxrRG9jcyh7ZG9jczogW25ld0RvY119LCBvcHRzLCB5YW5rRXJyb3IoY2FsbGJhY2ssIG5ld0RvYy5faWQpKTtcbiAgICB9KS5iaW5kKHRoaXMpO1xuXG4gICAgdGhpcy5yZXZzRGlmZiA9IGFkYXB0ZXJGdW4oJ3JldnNEaWZmJywgZnVuY3Rpb24gKHJlcSwgb3B0cywgY2FsbGJhY2spIHtcbiAgICAgIGlmICh0eXBlb2Ygb3B0cyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBjYWxsYmFjayA9IG9wdHM7XG4gICAgICAgIG9wdHMgPSB7fTtcbiAgICAgIH1cbiAgICAgIHZhciBpZHMgPSBPYmplY3Qua2V5cyhyZXEpO1xuXG4gICAgICBpZiAoIWlkcy5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKG51bGwsIHt9KTtcbiAgICAgIH1cblxuICAgICAgdmFyIGNvdW50ID0gMDtcbiAgICAgIHZhciBtaXNzaW5nID0gbmV3IE1hcCgpO1xuXG4gICAgICBmdW5jdGlvbiBhZGRUb01pc3NpbmcoaWQsIHJldklkKSB7XG4gICAgICAgIGlmICghbWlzc2luZy5oYXMoaWQpKSB7XG4gICAgICAgICAgbWlzc2luZy5zZXQoaWQsIHttaXNzaW5nOiBbXX0pO1xuICAgICAgICB9XG4gICAgICAgIG1pc3NpbmcuZ2V0KGlkKS5taXNzaW5nLnB1c2gocmV2SWQpO1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBwcm9jZXNzRG9jKGlkLCByZXZfdHJlZSkge1xuICAgICAgICAvLyBJcyB0aGlzIGZhc3QgZW5vdWdoPyBNYXliZSB3ZSBzaG91bGQgc3dpdGNoIHRvIGEgc2V0IHNpbXVsYXRlZCBieSBhIG1hcFxuICAgICAgICB2YXIgbWlzc2luZ0ZvcklkID0gcmVxW2lkXS5zbGljZSgwKTtcbiAgICAgICAgdHJhdmVyc2VSZXZUcmVlKHJldl90cmVlLCBmdW5jdGlvbiAoaXNMZWFmLCBwb3MsIHJldkhhc2gsIGN0eCxcbiAgICAgICAgICBvcHRzKSB7XG4gICAgICAgICAgICB2YXIgcmV2ID0gcG9zICsgJy0nICsgcmV2SGFzaDtcbiAgICAgICAgICAgIHZhciBpZHggPSBtaXNzaW5nRm9ySWQuaW5kZXhPZihyZXYpO1xuICAgICAgICAgICAgaWYgKGlkeCA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBtaXNzaW5nRm9ySWQuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICAgICAgICAgIGlmIChvcHRzLnN0YXR1cyAhPT0gJ2F2YWlsYWJsZScpIHtcbiAgICAgICAgICAgICAgYWRkVG9NaXNzaW5nKGlkLCByZXYpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFRyYXZlcnNpbmcgdGhlIHRyZWUgaXMgc3luY2hyb25vdXMsIHNvIG5vdyBgbWlzc2luZ0ZvcklkYCBjb250YWluc1xuICAgICAgICAvLyByZXZpc2lvbnMgdGhhdCB3ZXJlIG5vdCBmb3VuZCBpbiB0aGUgdHJlZVxuICAgICAgICBtaXNzaW5nRm9ySWQuZm9yRWFjaChmdW5jdGlvbiAocmV2KSB7XG4gICAgICAgICAgYWRkVG9NaXNzaW5nKGlkLCByZXYpO1xuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgaWRzLm1hcChmdW5jdGlvbiAoaWQpIHtcbiAgICAgICAgdGhpcy5fZ2V0UmV2aXNpb25UcmVlKGlkLCBmdW5jdGlvbiAoZXJyLCByZXZfdHJlZSkge1xuICAgICAgICAgIGlmIChlcnIgJiYgZXJyLnN0YXR1cyA9PT0gNDA0ICYmIGVyci5tZXNzYWdlID09PSAnbWlzc2luZycpIHtcbiAgICAgICAgICAgIG1pc3Npbmcuc2V0KGlkLCB7bWlzc2luZzogcmVxW2lkXX0pO1xuICAgICAgICAgIH0gZWxzZSBpZiAoZXJyKSB7XG4gICAgICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHByb2Nlc3NEb2MoaWQsIHJldl90cmVlKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoKytjb3VudCA9PT0gaWRzLmxlbmd0aCkge1xuICAgICAgICAgICAgLy8gY29udmVydCBMYXp5TWFwIHRvIG9iamVjdFxuICAgICAgICAgICAgdmFyIG1pc3NpbmdPYmogPSB7fTtcbiAgICAgICAgICAgIG1pc3NpbmcuZm9yRWFjaChmdW5jdGlvbiAodmFsdWUsIGtleSkge1xuICAgICAgICAgICAgICBtaXNzaW5nT2JqW2tleV0gPSB2YWx1ZTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKG51bGwsIG1pc3NpbmdPYmopO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9LCB0aGlzKTtcbiAgICB9KS5iaW5kKHRoaXMpO1xuXG4gICAgLy8gX2J1bGtfZ2V0IEFQSSBmb3IgZmFzdGVyIHJlcGxpY2F0aW9uLCBhcyBkZXNjcmliZWQgaW5cbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vYXBhY2hlL2NvdWNoZGItY2h0dHBkL3B1bGwvMzNcbiAgICAvLyBBdCB0aGUgXCJhYnN0cmFjdFwiIGxldmVsLCBpdCB3aWxsIGp1c3QgcnVuIG11bHRpcGxlIGdldCgpcyBpblxuICAgIC8vIHBhcmFsbGVsLCBiZWNhdXNlIHRoaXMgaXNuJ3QgbXVjaCBvZiBhIHBlcmZvcm1hbmNlIGNvc3RcbiAgICAvLyBmb3IgbG9jYWwgZGF0YWJhc2VzIChleGNlcHQgdGhlIGNvc3Qgb2YgbXVsdGlwbGUgdHJhbnNhY3Rpb25zLCB3aGljaCBpc1xuICAgIC8vIHNtYWxsKS4gVGhlIGh0dHAgYWRhcHRlciBvdmVycmlkZXMgdGhpcyBpbiBvcmRlclxuICAgIC8vIHRvIGRvIGEgbW9yZSBlZmZpY2llbnQgc2luZ2xlIEhUVFAgcmVxdWVzdC5cbiAgICB0aGlzLmJ1bGtHZXQgPSBhZGFwdGVyRnVuKCdidWxrR2V0JywgZnVuY3Rpb24gKG9wdHMsIGNhbGxiYWNrKSB7XG4gICAgICBidWxrR2V0U2hpbSh0aGlzLCBvcHRzLCBjYWxsYmFjayk7XG4gICAgfSkuYmluZCh0aGlzKTtcblxuICAgIC8vIGNvbXBhY3Qgb25lIGRvY3VtZW50IGFuZCBmaXJlIGNhbGxiYWNrXG4gICAgLy8gYnkgY29tcGFjdGluZyB3ZSBtZWFuIHJlbW92aW5nIGFsbCByZXZpc2lvbnMgd2hpY2hcbiAgICAvLyBhcmUgZnVydGhlciBmcm9tIHRoZSBsZWFmIGluIHJldmlzaW9uIHRyZWUgdGhhbiBtYXhfaGVpZ2h0XG4gICAgdGhpcy5jb21wYWN0RG9jdW1lbnQgPSBhZGFwdGVyRnVuKCdjb21wYWN0RG9jdW1lbnQnLCBmdW5jdGlvbiAoZG9jSWQsIG1heEhlaWdodCwgY2FsbGJhY2spIHtcbiAgICAgIHRoaXMuX2dldFJldmlzaW9uVHJlZShkb2NJZCwgKGVyciwgcmV2VHJlZSkgPT4ge1xuICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgIHJldHVybiBjYWxsYmFjayhlcnIpO1xuICAgICAgICB9XG4gICAgICAgIHZhciBoZWlnaHQgPSBjb21wdXRlSGVpZ2h0KHJldlRyZWUpO1xuICAgICAgICB2YXIgY2FuZGlkYXRlcyA9IFtdO1xuICAgICAgICB2YXIgcmV2cyA9IFtdO1xuICAgICAgICBPYmplY3Qua2V5cyhoZWlnaHQpLmZvckVhY2goZnVuY3Rpb24gKHJldikge1xuICAgICAgICAgIGlmIChoZWlnaHRbcmV2XSA+IG1heEhlaWdodCkge1xuICAgICAgICAgICAgY2FuZGlkYXRlcy5wdXNoKHJldik7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB0cmF2ZXJzZVJldlRyZWUocmV2VHJlZSwgZnVuY3Rpb24gKGlzTGVhZiwgcG9zLCByZXZIYXNoLCBjdHgsIG9wdHMpIHtcbiAgICAgICAgICB2YXIgcmV2ID0gcG9zICsgJy0nICsgcmV2SGFzaDtcbiAgICAgICAgICBpZiAob3B0cy5zdGF0dXMgPT09ICdhdmFpbGFibGUnICYmIGNhbmRpZGF0ZXMuaW5kZXhPZihyZXYpICE9PSAtMSkge1xuICAgICAgICAgICAgcmV2cy5wdXNoKHJldik7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5fZG9Db21wYWN0aW9uKGRvY0lkLCByZXZzLCBjYWxsYmFjayk7XG4gICAgICB9KTtcbiAgICB9KS5iaW5kKHRoaXMpO1xuXG4gICAgLy8gY29tcGFjdCB0aGUgd2hvbGUgZGF0YWJhc2UgdXNpbmcgc2luZ2xlIGRvY3VtZW50XG4gICAgLy8gY29tcGFjdGlvblxuICAgIHRoaXMuY29tcGFjdCA9IGFkYXB0ZXJGdW4oJ2NvbXBhY3QnLCBmdW5jdGlvbiAob3B0cywgY2FsbGJhY2spIHtcbiAgICAgIGlmICh0eXBlb2Ygb3B0cyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBjYWxsYmFjayA9IG9wdHM7XG4gICAgICAgIG9wdHMgPSB7fTtcbiAgICAgIH1cblxuICAgICAgb3B0cyA9IG9wdHMgfHwge307XG5cbiAgICAgIHRoaXMuX2NvbXBhY3Rpb25RdWV1ZSA9IHRoaXMuX2NvbXBhY3Rpb25RdWV1ZSB8fCBbXTtcbiAgICAgIHRoaXMuX2NvbXBhY3Rpb25RdWV1ZS5wdXNoKHtvcHRzOiBvcHRzLCBjYWxsYmFjazogY2FsbGJhY2t9KTtcbiAgICAgIGlmICh0aGlzLl9jb21wYWN0aW9uUXVldWUubGVuZ3RoID09PSAxKSB7XG4gICAgICAgIGRvTmV4dENvbXBhY3Rpb24odGhpcyk7XG4gICAgICB9XG4gICAgfSkuYmluZCh0aGlzKTtcblxuICAgIC8qIEJlZ2luIGFwaSB3cmFwcGVycy4gU3BlY2lmaWMgZnVuY3Rpb25hbGl0eSB0byBzdG9yYWdlIGJlbG9uZ3MgaW4gdGhlIF9bbWV0aG9kXSAqL1xuICAgIHRoaXMuZ2V0ID0gYWRhcHRlckZ1bignZ2V0JywgZnVuY3Rpb24gKGlkLCBvcHRzLCBjYikge1xuICAgICAgaWYgKHR5cGVvZiBvcHRzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGNiID0gb3B0cztcbiAgICAgICAgb3B0cyA9IHt9O1xuICAgICAgfVxuICAgICAgaWYgKHR5cGVvZiBpZCAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgcmV0dXJuIGNiKGNyZWF0ZUVycm9yKElOVkFMSURfSUQpKTtcbiAgICAgIH1cbiAgICAgIGlmIChpc0xvY2FsSWQoaWQpICYmIHR5cGVvZiB0aGlzLl9nZXRMb2NhbCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICByZXR1cm4gdGhpcy5fZ2V0TG9jYWwoaWQsIGNiKTtcbiAgICAgIH1cbiAgICAgIHZhciBsZWF2ZXMgPSBbXTtcblxuICAgICAgY29uc3QgZmluaXNoT3BlblJldnMgPSAoKSA9PiB7XG4gICAgICAgIHZhciByZXN1bHQgPSBbXTtcbiAgICAgICAgdmFyIGNvdW50ID0gbGVhdmVzLmxlbmd0aDtcbiAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgICAgIGlmICghY291bnQpIHtcbiAgICAgICAgICByZXR1cm4gY2IobnVsbCwgcmVzdWx0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIG9yZGVyIHdpdGggb3Blbl9yZXZzIGlzIHVuc3BlY2lmaWVkXG4gICAgICAgIGxlYXZlcy5mb3JFYWNoKChsZWFmKSA9PiB7XG4gICAgICAgICAgdGhpcy5nZXQoaWQsIHtcbiAgICAgICAgICAgIHJldjogbGVhZixcbiAgICAgICAgICAgIHJldnM6IG9wdHMucmV2cyxcbiAgICAgICAgICAgIGxhdGVzdDogb3B0cy5sYXRlc3QsXG4gICAgICAgICAgICBhdHRhY2htZW50czogb3B0cy5hdHRhY2htZW50cyxcbiAgICAgICAgICAgIGJpbmFyeTogb3B0cy5iaW5hcnlcbiAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyLCBkb2MpIHtcbiAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgIC8vIHVzaW5nIGxhdGVzdD10cnVlIGNhbiBwcm9kdWNlIGR1cGxpY2F0ZXNcbiAgICAgICAgICAgICAgdmFyIGV4aXN0aW5nO1xuICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IHJlc3VsdC5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0W2ldLm9rICYmIHJlc3VsdFtpXS5vay5fcmV2ID09PSBkb2MuX3Jldikge1xuICAgICAgICAgICAgICAgICAgZXhpc3RpbmcgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmICghZXhpc3RpbmcpIHtcbiAgICAgICAgICAgICAgICByZXN1bHQucHVzaCh7b2s6IGRvY30pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICByZXN1bHQucHVzaCh7bWlzc2luZzogbGVhZn0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY291bnQtLTtcbiAgICAgICAgICAgIGlmICghY291bnQpIHtcbiAgICAgICAgICAgICAgY2IobnVsbCwgcmVzdWx0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICB9O1xuXG4gICAgICBpZiAob3B0cy5vcGVuX3JldnMpIHtcbiAgICAgICAgaWYgKG9wdHMub3Blbl9yZXZzID09PSBcImFsbFwiKSB7XG4gICAgICAgICAgdGhpcy5fZ2V0UmV2aXNpb25UcmVlKGlkLCBmdW5jdGlvbiAoZXJyLCByZXZfdHJlZSkge1xuICAgICAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgIHJldHVybiBjYihlcnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGVhdmVzID0gY29sbGVjdExlYXZlcyhyZXZfdHJlZSkubWFwKGZ1bmN0aW9uIChsZWFmKSB7XG4gICAgICAgICAgICAgIHJldHVybiBsZWFmLnJldjtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgZmluaXNoT3BlblJldnMoKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShvcHRzLm9wZW5fcmV2cykpIHtcbiAgICAgICAgICAgIGxlYXZlcyA9IG9wdHMub3Blbl9yZXZzO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZWF2ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgdmFyIGwgPSBsZWF2ZXNbaV07XG4gICAgICAgICAgICAgIC8vIGxvb2tzIGxpa2UgaXQncyB0aGUgb25seSB0aGluZyBjb3VjaGRiIGNoZWNrc1xuICAgICAgICAgICAgICBpZiAoISh0eXBlb2YgKGwpID09PSBcInN0cmluZ1wiICYmIC9eXFxkKy0vLnRlc3QobCkpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNiKGNyZWF0ZUVycm9yKElOVkFMSURfUkVWKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZpbmlzaE9wZW5SZXZzKCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBjYihjcmVhdGVFcnJvcihVTktOT1dOX0VSUk9SLCAnZnVuY3Rpb25fY2xhdXNlJykpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm47IC8vIG9wZW5fcmV2cyBkb2VzIG5vdCBsaWtlIG90aGVyIG9wdGlvbnNcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRoaXMuX2dldChpZCwgb3B0cywgKGVyciwgcmVzdWx0KSA9PiB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICBlcnIuZG9jSWQgPSBpZDtcbiAgICAgICAgICByZXR1cm4gY2IoZXJyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBkb2MgPSByZXN1bHQuZG9jO1xuICAgICAgICB2YXIgbWV0YWRhdGEgPSByZXN1bHQubWV0YWRhdGE7XG4gICAgICAgIHZhciBjdHggPSByZXN1bHQuY3R4O1xuXG4gICAgICAgIGlmIChvcHRzLmNvbmZsaWN0cykge1xuICAgICAgICAgIHZhciBjb25mbGljdHMgPSBjb2xsZWN0Q29uZmxpY3RzKG1ldGFkYXRhKTtcbiAgICAgICAgICBpZiAoY29uZmxpY3RzLmxlbmd0aCkge1xuICAgICAgICAgICAgZG9jLl9jb25mbGljdHMgPSBjb25mbGljdHM7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGlzRGVsZXRlZChtZXRhZGF0YSwgZG9jLl9yZXYpKSB7XG4gICAgICAgICAgZG9jLl9kZWxldGVkID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRzLnJldnMgfHwgb3B0cy5yZXZzX2luZm8pIHtcbiAgICAgICAgICB2YXIgc3BsaXR0ZWRSZXYgPSBkb2MuX3Jldi5zcGxpdCgnLScpO1xuICAgICAgICAgIHZhciByZXZObyAgICAgICA9IHBhcnNlSW50KHNwbGl0dGVkUmV2WzBdLCAxMCk7XG4gICAgICAgICAgdmFyIHJldkhhc2ggICAgID0gc3BsaXR0ZWRSZXZbMV07XG5cbiAgICAgICAgICB2YXIgcGF0aHMgPSByb290VG9MZWFmKG1ldGFkYXRhLnJldl90cmVlKTtcbiAgICAgICAgICB2YXIgcGF0aCA9IG51bGw7XG5cbiAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHBhdGhzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgY3VycmVudFBhdGggPSBwYXRoc1tpXTtcbiAgICAgICAgICAgIHZhciBoYXNoSW5kZXggPSBjdXJyZW50UGF0aC5pZHMubWFwKGZ1bmN0aW9uICh4KSB7IHJldHVybiB4LmlkOyB9KVxuICAgICAgICAgICAgICAuaW5kZXhPZihyZXZIYXNoKTtcbiAgICAgICAgICAgIHZhciBoYXNoRm91bmRBdFJldlBvcyA9IGhhc2hJbmRleCA9PT0gKHJldk5vIC0gMSk7XG5cbiAgICAgICAgICAgIGlmIChoYXNoRm91bmRBdFJldlBvcyB8fCAoIXBhdGggJiYgaGFzaEluZGV4ICE9PSAtMSkpIHtcbiAgICAgICAgICAgICAgcGF0aCA9IGN1cnJlbnRQYXRoO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgICAgICAgIGlmICghcGF0aCkge1xuICAgICAgICAgICAgZXJyID0gbmV3IEVycm9yKCdpbnZhbGlkIHJldiB0cmVlJyk7XG4gICAgICAgICAgICBlcnIuZG9jSWQgPSBpZDtcbiAgICAgICAgICAgIHJldHVybiBjYihlcnIpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHZhciBpbmRleE9mUmV2ID0gcGF0aC5pZHMubWFwKGZ1bmN0aW9uICh4KSB7IHJldHVybiB4LmlkOyB9KVxuICAgICAgICAgICAgLmluZGV4T2YoZG9jLl9yZXYuc3BsaXQoJy0nKVsxXSkgKyAxO1xuICAgICAgICAgIHZhciBob3dNYW55ID0gcGF0aC5pZHMubGVuZ3RoIC0gaW5kZXhPZlJldjtcbiAgICAgICAgICBwYXRoLmlkcy5zcGxpY2UoaW5kZXhPZlJldiwgaG93TWFueSk7XG4gICAgICAgICAgcGF0aC5pZHMucmV2ZXJzZSgpO1xuXG4gICAgICAgICAgaWYgKG9wdHMucmV2cykge1xuICAgICAgICAgICAgZG9jLl9yZXZpc2lvbnMgPSB7XG4gICAgICAgICAgICAgIHN0YXJ0OiAocGF0aC5wb3MgKyBwYXRoLmlkcy5sZW5ndGgpIC0gMSxcbiAgICAgICAgICAgICAgaWRzOiBwYXRoLmlkcy5tYXAoZnVuY3Rpb24gKHJldikge1xuICAgICAgICAgICAgICAgIHJldHVybiByZXYuaWQ7XG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAob3B0cy5yZXZzX2luZm8pIHtcbiAgICAgICAgICAgIHZhciBwb3MgPSAgcGF0aC5wb3MgKyBwYXRoLmlkcy5sZW5ndGg7XG4gICAgICAgICAgICBkb2MuX3JldnNfaW5mbyA9IHBhdGguaWRzLm1hcChmdW5jdGlvbiAocmV2KSB7XG4gICAgICAgICAgICAgIHBvcy0tO1xuICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHJldjogcG9zICsgJy0nICsgcmV2LmlkLFxuICAgICAgICAgICAgICAgIHN0YXR1czogcmV2Lm9wdHMuc3RhdHVzXG4gICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0cy5hdHRhY2htZW50cyAmJiBkb2MuX2F0dGFjaG1lbnRzKSB7XG4gICAgICAgICAgdmFyIGF0dGFjaG1lbnRzID0gZG9jLl9hdHRhY2htZW50cztcbiAgICAgICAgICB2YXIgY291bnQgPSBPYmplY3Qua2V5cyhhdHRhY2htZW50cykubGVuZ3RoO1xuICAgICAgICAgIGlmIChjb3VudCA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIGNiKG51bGwsIGRvYyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIE9iamVjdC5rZXlzKGF0dGFjaG1lbnRzKS5mb3JFYWNoKChrZXkpID0+IHtcbiAgICAgICAgICAgIHRoaXMuX2dldEF0dGFjaG1lbnQoZG9jLl9pZCwga2V5LCBhdHRhY2htZW50c1trZXldLCB7XG4gICAgICAgICAgICAgIC8vIFByZXZpb3VzbHkgdGhlIHJldmlzaW9uIGhhbmRsaW5nIHdhcyBkb25lIGluIGFkYXB0ZXIuanNcbiAgICAgICAgICAgICAgLy8gZ2V0QXR0YWNobWVudCwgaG93ZXZlciBzaW5jZSBpZGItbmV4dCBkb2VzbnQgd2UgbmVlZCB0b1xuICAgICAgICAgICAgICAvLyBwYXNzIHRoZSByZXYgdGhyb3VnaFxuICAgICAgICAgICAgICByZXY6IGRvYy5fcmV2LFxuICAgICAgICAgICAgICBiaW5hcnk6IG9wdHMuYmluYXJ5LFxuICAgICAgICAgICAgICBjdHg6IGN0eFxuICAgICAgICAgICAgfSwgZnVuY3Rpb24gKGVyciwgZGF0YSkge1xuICAgICAgICAgICAgICB2YXIgYXR0ID0gZG9jLl9hdHRhY2htZW50c1trZXldO1xuICAgICAgICAgICAgICBhdHQuZGF0YSA9IGRhdGE7XG4gICAgICAgICAgICAgIGRlbGV0ZSBhdHQuc3R1YjtcbiAgICAgICAgICAgICAgZGVsZXRlIGF0dC5sZW5ndGg7XG4gICAgICAgICAgICAgIGlmICghLS1jb3VudCkge1xuICAgICAgICAgICAgICAgIGNiKG51bGwsIGRvYyk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmIChkb2MuX2F0dGFjaG1lbnRzKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBrZXkgaW4gZG9jLl9hdHRhY2htZW50cykge1xuICAgICAgICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgZWxzZSAqL1xuICAgICAgICAgICAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGRvYy5fYXR0YWNobWVudHMsIGtleSkpIHtcbiAgICAgICAgICAgICAgICBkb2MuX2F0dGFjaG1lbnRzW2tleV0uc3R1YiA9IHRydWU7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgY2IobnVsbCwgZG9jKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSkuYmluZCh0aGlzKTtcblxuICAgIC8vIFRPRE86IEkgZG9udCBsaWtlIHRoaXMsIGl0IGZvcmNlcyBhbiBleHRyYSByZWFkIGZvciBldmVyeVxuICAgIC8vIGF0dGFjaG1lbnQgcmVhZCBhbmQgZW5mb3JjZXMgYSBjb25mdXNpbmcgYXBpIGJldHdlZW5cbiAgICAvLyBhZGFwdGVyLmpzIGFuZCB0aGUgYWRhcHRlciBpbXBsZW1lbnRhdGlvblxuICAgIHRoaXMuZ2V0QXR0YWNobWVudCA9IGFkYXB0ZXJGdW4oJ2dldEF0dGFjaG1lbnQnLCBmdW5jdGlvbiAoZG9jSWQsIGF0dGFjaG1lbnRJZCwgb3B0cywgY2FsbGJhY2spIHtcbiAgICAgIGlmIChvcHRzIGluc3RhbmNlb2YgRnVuY3Rpb24pIHtcbiAgICAgICAgY2FsbGJhY2sgPSBvcHRzO1xuICAgICAgICBvcHRzID0ge307XG4gICAgICB9XG4gICAgICB0aGlzLl9nZXQoZG9jSWQsIG9wdHMsIChlcnIsIHJlcykgPT4ge1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHJlcy5kb2MuX2F0dGFjaG1lbnRzICYmIHJlcy5kb2MuX2F0dGFjaG1lbnRzW2F0dGFjaG1lbnRJZF0pIHtcbiAgICAgICAgICBvcHRzLmN0eCA9IHJlcy5jdHg7XG4gICAgICAgICAgb3B0cy5iaW5hcnkgPSB0cnVlO1xuICAgICAgICAgIHRoaXMuX2dldEF0dGFjaG1lbnQoZG9jSWQsIGF0dGFjaG1lbnRJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcy5kb2MuX2F0dGFjaG1lbnRzW2F0dGFjaG1lbnRJZF0sIG9wdHMsIGNhbGxiYWNrKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gY2FsbGJhY2soY3JlYXRlRXJyb3IoTUlTU0lOR19ET0MpKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSkuYmluZCh0aGlzKTtcblxuICAgIHRoaXMuYWxsRG9jcyA9IGFkYXB0ZXJGdW4oJ2FsbERvY3MnLCBmdW5jdGlvbiAob3B0cywgY2FsbGJhY2spIHtcbiAgICAgIGlmICh0eXBlb2Ygb3B0cyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBjYWxsYmFjayA9IG9wdHM7XG4gICAgICAgIG9wdHMgPSB7fTtcbiAgICAgIH1cbiAgICAgIG9wdHMuc2tpcCA9IHR5cGVvZiBvcHRzLnNraXAgIT09ICd1bmRlZmluZWQnID8gb3B0cy5za2lwIDogMDtcbiAgICAgIGlmIChvcHRzLnN0YXJ0X2tleSkge1xuICAgICAgICBvcHRzLnN0YXJ0a2V5ID0gb3B0cy5zdGFydF9rZXk7XG4gICAgICB9XG4gICAgICBpZiAob3B0cy5lbmRfa2V5KSB7XG4gICAgICAgIG9wdHMuZW5ka2V5ID0gb3B0cy5lbmRfa2V5O1xuICAgICAgfVxuICAgICAgaWYgKCdrZXlzJyBpbiBvcHRzKSB7XG4gICAgICAgIGlmICghQXJyYXkuaXNBcnJheShvcHRzLmtleXMpKSB7XG4gICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKG5ldyBUeXBlRXJyb3IoJ29wdGlvbnMua2V5cyBtdXN0IGJlIGFuIGFycmF5JykpO1xuICAgICAgICB9XG4gICAgICAgIHZhciBpbmNvbXBhdGlibGVPcHQgPVxuICAgICAgICAgIFsnc3RhcnRrZXknLCAnZW5ka2V5JywgJ2tleSddLmZpbHRlcihmdW5jdGlvbiAoaW5jb21wYXRpYmxlT3B0KSB7XG4gICAgICAgICAgcmV0dXJuIGluY29tcGF0aWJsZU9wdCBpbiBvcHRzO1xuICAgICAgICB9KVswXTtcbiAgICAgICAgaWYgKGluY29tcGF0aWJsZU9wdCkge1xuICAgICAgICAgIGNhbGxiYWNrKGNyZWF0ZUVycm9yKFFVRVJZX1BBUlNFX0VSUk9SLFxuICAgICAgICAgICAgJ1F1ZXJ5IHBhcmFtZXRlciBgJyArIGluY29tcGF0aWJsZU9wdCArXG4gICAgICAgICAgICAnYCBpcyBub3QgY29tcGF0aWJsZSB3aXRoIG11bHRpLWdldCdcbiAgICAgICAgICApKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFpc1JlbW90ZSh0aGlzKSkge1xuICAgICAgICAgIGFsbERvY3NLZXlzUGFyc2Uob3B0cyk7XG4gICAgICAgICAgaWYgKG9wdHMua2V5cy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9hbGxEb2NzKHtsaW1pdDogMH0sIGNhbGxiYWNrKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRoaXMuX2FsbERvY3Mob3B0cywgY2FsbGJhY2spO1xuICAgIH0pLmJpbmQodGhpcyk7XG5cbiAgICB0aGlzLmNsb3NlID0gYWRhcHRlckZ1bignY2xvc2UnLCBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgIHRoaXMuX2Nsb3NlZCA9IHRydWU7XG4gICAgICB0aGlzLmVtaXQoJ2Nsb3NlZCcpO1xuICAgICAgcmV0dXJuIHRoaXMuX2Nsb3NlKGNhbGxiYWNrKTtcbiAgICB9KS5iaW5kKHRoaXMpO1xuXG4gICAgdGhpcy5pbmZvID0gYWRhcHRlckZ1bignaW5mbycsIGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgdGhpcy5faW5mbygoZXJyLCBpbmZvKSA9PiB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBhc3N1bWUgd2Uga25vdyBiZXR0ZXIgdGhhbiB0aGUgYWRhcHRlciwgdW5sZXNzIGl0IGluZm9ybXMgdXNcbiAgICAgICAgaW5mby5kYl9uYW1lID0gaW5mby5kYl9uYW1lIHx8IHRoaXMubmFtZTtcbiAgICAgICAgaW5mby5hdXRvX2NvbXBhY3Rpb24gPSAhISh0aGlzLmF1dG9fY29tcGFjdGlvbiAmJiAhaXNSZW1vdGUodGhpcykpO1xuICAgICAgICBpbmZvLmFkYXB0ZXIgPSB0aGlzLmFkYXB0ZXI7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIGluZm8pO1xuICAgICAgfSk7XG4gICAgfSkuYmluZCh0aGlzKTtcblxuICAgIHRoaXMuaWQgPSBhZGFwdGVyRnVuKCdpZCcsIGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgcmV0dXJuIHRoaXMuX2lkKGNhbGxiYWNrKTtcbiAgICB9KS5iaW5kKHRoaXMpO1xuXG4gICAgdGhpcy5idWxrRG9jcyA9IGFkYXB0ZXJGdW4oJ2J1bGtEb2NzJywgZnVuY3Rpb24gKHJlcSwgb3B0cywgY2FsbGJhY2spIHtcbiAgICAgIGlmICh0eXBlb2Ygb3B0cyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBjYWxsYmFjayA9IG9wdHM7XG4gICAgICAgIG9wdHMgPSB7fTtcbiAgICAgIH1cblxuICAgICAgb3B0cyA9IG9wdHMgfHwge307XG5cbiAgICAgIGlmIChBcnJheS5pc0FycmF5KHJlcSkpIHtcbiAgICAgICAgcmVxID0ge1xuICAgICAgICAgIGRvY3M6IHJlcVxuICAgICAgICB9O1xuICAgICAgfVxuXG4gICAgICBpZiAoIXJlcSB8fCAhcmVxLmRvY3MgfHwgIUFycmF5LmlzQXJyYXkocmVxLmRvY3MpKSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjayhjcmVhdGVFcnJvcihNSVNTSU5HX0JVTEtfRE9DUykpO1xuICAgICAgfVxuXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlcS5kb2NzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIGlmICh0eXBlb2YgcmVxLmRvY3NbaV0gIT09ICdvYmplY3QnIHx8IEFycmF5LmlzQXJyYXkocmVxLmRvY3NbaV0pKSB7XG4gICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGNyZWF0ZUVycm9yKE5PVF9BTl9PQkpFQ1QpKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB2YXIgYXR0YWNobWVudEVycm9yO1xuICAgICAgcmVxLmRvY3MuZm9yRWFjaChmdW5jdGlvbiAoZG9jKSB7XG4gICAgICAgIGlmIChkb2MuX2F0dGFjaG1lbnRzKSB7XG4gICAgICAgICAgT2JqZWN0LmtleXMoZG9jLl9hdHRhY2htZW50cykuZm9yRWFjaChmdW5jdGlvbiAobmFtZSkge1xuICAgICAgICAgICAgYXR0YWNobWVudEVycm9yID0gYXR0YWNobWVudEVycm9yIHx8IGF0dGFjaG1lbnROYW1lRXJyb3IobmFtZSk7XG4gICAgICAgICAgICBpZiAoIWRvYy5fYXR0YWNobWVudHNbbmFtZV0uY29udGVudF90eXBlKSB7XG4gICAgICAgICAgICAgIGd1YXJkZWRDb25zb2xlKCd3YXJuJywgJ0F0dGFjaG1lbnQnLCBuYW1lLCAnb24gZG9jdW1lbnQnLCBkb2MuX2lkLCAnaXMgbWlzc2luZyBjb250ZW50X3R5cGUnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIGlmIChhdHRhY2htZW50RXJyb3IpIHtcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGNyZWF0ZUVycm9yKEJBRF9SRVFVRVNULCBhdHRhY2htZW50RXJyb3IpKTtcbiAgICAgIH1cblxuICAgICAgaWYgKCEoJ25ld19lZGl0cycgaW4gb3B0cykpIHtcbiAgICAgICAgaWYgKCduZXdfZWRpdHMnIGluIHJlcSkge1xuICAgICAgICAgIG9wdHMubmV3X2VkaXRzID0gcmVxLm5ld19lZGl0cztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBvcHRzLm5ld19lZGl0cyA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdmFyIGFkYXB0ZXIgPSB0aGlzO1xuICAgICAgaWYgKCFvcHRzLm5ld19lZGl0cyAmJiAhaXNSZW1vdGUoYWRhcHRlcikpIHtcbiAgICAgICAgLy8gZW5zdXJlIHJldmlzaW9ucyBvZiB0aGUgc2FtZSBkb2MgYXJlIHNvcnRlZCwgc28gdGhhdFxuICAgICAgICAvLyB0aGUgbG9jYWwgYWRhcHRlciBwcm9jZXNzZXMgdGhlbSBjb3JyZWN0bHkgKCMyOTM1KVxuICAgICAgICByZXEuZG9jcy5zb3J0KGNvbXBhcmVCeUlkVGhlblJldik7XG4gICAgICB9XG5cbiAgICAgIGNsZWFuRG9jcyhyZXEuZG9jcyk7XG5cbiAgICAgIC8vIGluIHRoZSBjYXNlIG9mIGNvbmZsaWN0cywgd2Ugd2FudCB0byByZXR1cm4gdGhlIF9pZHMgdG8gdGhlIHVzZXJcbiAgICAgIC8vIGhvd2V2ZXIsIHRoZSB1bmRlcmx5aW5nIGFkYXB0ZXIgbWF5IGRlc3Ryb3kgdGhlIGRvY3MgYXJyYXksIHNvXG4gICAgICAvLyBjcmVhdGUgYSBjb3B5IGhlcmVcbiAgICAgIHZhciBpZHMgPSByZXEuZG9jcy5tYXAoZnVuY3Rpb24gKGRvYykge1xuICAgICAgICByZXR1cm4gZG9jLl9pZDtcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLl9idWxrRG9jcyhyZXEsIG9wdHMsIGZ1bmN0aW9uIChlcnIsIHJlcykge1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFvcHRzLm5ld19lZGl0cykge1xuICAgICAgICAgIC8vIHRoaXMgaXMgd2hhdCBjb3VjaCBkb2VzIHdoZW4gbmV3X2VkaXRzIGlzIGZhbHNlXG4gICAgICAgICAgcmVzID0gcmVzLmZpbHRlcihmdW5jdGlvbiAoeCkge1xuICAgICAgICAgICAgcmV0dXJuIHguZXJyb3I7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gYWRkIGlkcyBmb3IgZXJyb3IvY29uZmxpY3QgcmVzcG9uc2VzIChub3QgcmVxdWlyZWQgZm9yIENvdWNoREIpXG4gICAgICAgIGlmICghaXNSZW1vdGUoYWRhcHRlcikpIHtcbiAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IHJlcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgIHJlc1tpXS5pZCA9IHJlc1tpXS5pZCB8fCBpZHNbaV07XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzKTtcbiAgICAgIH0pO1xuICAgIH0pLmJpbmQodGhpcyk7XG5cbiAgICB0aGlzLnJlZ2lzdGVyRGVwZW5kZW50RGF0YWJhc2UgPSBhZGFwdGVyRnVuKCdyZWdpc3RlckRlcGVuZGVudERhdGFiYXNlJywgZnVuY3Rpb24gKGRlcGVuZGVudERiLCBjYWxsYmFjaykge1xuICAgICAgdmFyIGRiT3B0aW9ucyA9IGNsb25lKHRoaXMuX19vcHRzKTtcbiAgICAgIGlmICh0aGlzLl9fb3B0cy52aWV3X2FkYXB0ZXIpIHtcbiAgICAgICAgZGJPcHRpb25zLmFkYXB0ZXIgPSB0aGlzLl9fb3B0cy52aWV3X2FkYXB0ZXI7XG4gICAgICB9XG5cbiAgICAgIHZhciBkZXBEQiA9IG5ldyB0aGlzLmNvbnN0cnVjdG9yKGRlcGVuZGVudERiLCBkYk9wdGlvbnMpO1xuXG4gICAgICBmdW5jdGlvbiBkaWZmRnVuKGRvYykge1xuICAgICAgICBkb2MuZGVwZW5kZW50RGJzID0gZG9jLmRlcGVuZGVudERicyB8fCB7fTtcbiAgICAgICAgaWYgKGRvYy5kZXBlbmRlbnREYnNbZGVwZW5kZW50RGJdKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlOyAvLyBubyB1cGRhdGUgcmVxdWlyZWRcbiAgICAgICAgfVxuICAgICAgICBkb2MuZGVwZW5kZW50RGJzW2RlcGVuZGVudERiXSA9IHRydWU7XG4gICAgICAgIHJldHVybiBkb2M7XG4gICAgICB9XG4gICAgICB1cHNlcnQodGhpcywgJ19sb2NhbC9fcG91Y2hfZGVwZW5kZW50RGJzJywgZGlmZkZ1bikudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHtkYjogZGVwREJ9KTtcbiAgICAgIH0pLmNhdGNoKGNhbGxiYWNrKTtcbiAgICB9KS5iaW5kKHRoaXMpO1xuXG4gICAgdGhpcy5kZXN0cm95ID0gYWRhcHRlckZ1bignZGVzdHJveScsIGZ1bmN0aW9uIChvcHRzLCBjYWxsYmFjaykge1xuXG4gICAgICBpZiAodHlwZW9mIG9wdHMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgY2FsbGJhY2sgPSBvcHRzO1xuICAgICAgICBvcHRzID0ge307XG4gICAgICB9XG5cbiAgICAgIHZhciB1c2VQcmVmaXggPSAndXNlX3ByZWZpeCcgaW4gdGhpcyA/IHRoaXMudXNlX3ByZWZpeCA6IHRydWU7XG5cbiAgICAgIGNvbnN0IGRlc3Ryb3lEYiA9ICgpID0+IHtcbiAgICAgICAgLy8gY2FsbCBkZXN0cm95IG1ldGhvZCBvZiB0aGUgcGFydGljdWxhciBhZGFwdG9yXG4gICAgICAgIHRoaXMuX2Rlc3Ryb3kob3B0cywgKGVyciwgcmVzcCkgPT4ge1xuICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLl9kZXN0cm95ZWQgPSB0cnVlO1xuICAgICAgICAgIHRoaXMuZW1pdCgnZGVzdHJveWVkJyk7XG4gICAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzcCB8fCB7ICdvayc6IHRydWUgfSk7XG4gICAgICAgIH0pO1xuICAgICAgfTtcblxuICAgICAgaWYgKGlzUmVtb3RlKHRoaXMpKSB7XG4gICAgICAgIC8vIG5vIG5lZWQgdG8gY2hlY2sgZm9yIGRlcGVuZGVudCBEQnMgaWYgaXQncyBhIHJlbW90ZSBEQlxuICAgICAgICByZXR1cm4gZGVzdHJveURiKCk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuZ2V0KCdfbG9jYWwvX3BvdWNoX2RlcGVuZGVudERicycsIChlcnIsIGxvY2FsRG9jKSA9PiB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICAgICAgICBpZiAoZXJyLnN0YXR1cyAhPT0gNDA0KSB7XG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICB9IGVsc2UgeyAvLyBubyBkZXBlbmRlbmNpZXNcbiAgICAgICAgICAgIHJldHVybiBkZXN0cm95RGIoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGRlcGVuZGVudERicyA9IGxvY2FsRG9jLmRlcGVuZGVudERicztcbiAgICAgICAgdmFyIFBvdWNoREIgPSB0aGlzLmNvbnN0cnVjdG9yO1xuICAgICAgICB2YXIgZGVsZXRlZE1hcCA9IE9iamVjdC5rZXlzKGRlcGVuZGVudERicykubWFwKChuYW1lKSA9PiB7XG4gICAgICAgICAgLy8gdXNlX3ByZWZpeCBpcyBvbmx5IGZhbHNlIGluIHRoZSBicm93c2VyXG4gICAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICAgICAgICB2YXIgdHJ1ZU5hbWUgPSB1c2VQcmVmaXggP1xuICAgICAgICAgICAgbmFtZS5yZXBsYWNlKG5ldyBSZWdFeHAoJ14nICsgUG91Y2hEQi5wcmVmaXgpLCAnJykgOiBuYW1lO1xuICAgICAgICAgIHJldHVybiBuZXcgUG91Y2hEQih0cnVlTmFtZSwgdGhpcy5fX29wdHMpLmRlc3Ryb3koKTtcbiAgICAgICAgfSk7XG4gICAgICAgIFByb21pc2UuYWxsKGRlbGV0ZWRNYXApLnRoZW4oZGVzdHJveURiLCBjYWxsYmFjayk7XG4gICAgICB9KTtcbiAgICB9KS5iaW5kKHRoaXMpO1xuICB9XG5cbiAgX2NvbXBhY3Qob3B0cywgY2FsbGJhY2spIHtcbiAgICB2YXIgY2hhbmdlc09wdHMgPSB7XG4gICAgICByZXR1cm5fZG9jczogZmFsc2UsXG4gICAgICBsYXN0X3NlcTogb3B0cy5sYXN0X3NlcSB8fCAwXG4gICAgfTtcbiAgICB2YXIgcHJvbWlzZXMgPSBbXTtcblxuICAgIHZhciB0YXNrSWQ7XG4gICAgdmFyIGNvbXBhY3RlZERvY3MgPSAwO1xuXG4gICAgY29uc3Qgb25DaGFuZ2UgPSAocm93KSA9PiB7XG4gICAgICB0aGlzLmFjdGl2ZVRhc2tzLnVwZGF0ZSh0YXNrSWQsIHtcbiAgICAgICAgY29tcGxldGVkX2l0ZW1zOiArK2NvbXBhY3RlZERvY3NcbiAgICAgIH0pO1xuICAgICAgcHJvbWlzZXMucHVzaCh0aGlzLmNvbXBhY3REb2N1bWVudChyb3cuaWQsIDApKTtcbiAgICB9O1xuICAgIGNvbnN0IG9uRXJyb3IgPSAoZXJyKSA9PiB7XG4gICAgICB0aGlzLmFjdGl2ZVRhc2tzLnJlbW92ZSh0YXNrSWQsIGVycik7XG4gICAgICBjYWxsYmFjayhlcnIpO1xuICAgIH07XG4gICAgY29uc3Qgb25Db21wbGV0ZSA9IChyZXNwKSA9PiB7XG4gICAgICB2YXIgbGFzdFNlcSA9IHJlc3AubGFzdF9zZXE7XG4gICAgICBQcm9taXNlLmFsbChwcm9taXNlcykudGhlbigoKSA9PiB7XG4gICAgICAgIHJldHVybiB1cHNlcnQodGhpcywgJ19sb2NhbC9jb21wYWN0aW9uJywgKGRvYykgPT4ge1xuICAgICAgICAgIGlmICghZG9jLmxhc3Rfc2VxIHx8IGRvYy5sYXN0X3NlcSA8IGxhc3RTZXEpIHtcbiAgICAgICAgICAgIGRvYy5sYXN0X3NlcSA9IGxhc3RTZXE7XG4gICAgICAgICAgICByZXR1cm4gZG9jO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gZmFsc2U7IC8vIHNvbWVib2R5IGVsc2UgZ290IGhlcmUgZmlyc3QsIGRvbid0IHVwZGF0ZVxuICAgICAgICB9KTtcbiAgICAgIH0pLnRoZW4oKCkgPT4ge1xuICAgICAgICB0aGlzLmFjdGl2ZVRhc2tzLnJlbW92ZSh0YXNrSWQpO1xuICAgICAgICBjYWxsYmFjayhudWxsLCB7b2s6IHRydWV9KTtcbiAgICAgIH0pLmNhdGNoKG9uRXJyb3IpO1xuICAgIH07XG5cbiAgICB0aGlzLmluZm8oKS50aGVuKChpbmZvKSA9PiB7XG4gICAgICB0YXNrSWQgPSB0aGlzLmFjdGl2ZVRhc2tzLmFkZCh7XG4gICAgICAgIG5hbWU6ICdkYXRhYmFzZV9jb21wYWN0aW9uJyxcbiAgICAgICAgdG90YWxfaXRlbXM6IGluZm8udXBkYXRlX3NlcSAtIGNoYW5nZXNPcHRzLmxhc3Rfc2VxLFxuICAgICAgfSk7XG5cbiAgICAgIHRoaXMuY2hhbmdlcyhjaGFuZ2VzT3B0cylcbiAgICAgICAgLm9uKCdjaGFuZ2UnLCBvbkNoYW5nZSlcbiAgICAgICAgLm9uKCdjb21wbGV0ZScsIG9uQ29tcGxldGUpXG4gICAgICAgIC5vbignZXJyb3InLCBvbkVycm9yKTtcbiAgICB9KTtcbiAgfVxuXG4gIGNoYW5nZXMob3B0cywgY2FsbGJhY2spIHtcbiAgICBpZiAodHlwZW9mIG9wdHMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNhbGxiYWNrID0gb3B0cztcbiAgICAgIG9wdHMgPSB7fTtcbiAgICB9XG5cbiAgICBvcHRzID0gb3B0cyB8fCB7fTtcblxuICAgIC8vIEJ5IGRlZmF1bHQgc2V0IHJldHVybl9kb2NzIHRvIGZhbHNlIGlmIHRoZSBjYWxsZXIgaGFzIG9wdHMubGl2ZSA9IHRydWUsXG4gICAgLy8gdGhpcyB3aWxsIHByZXZlbnQgdXMgZnJvbSBjb2xsZWN0aW5nIHRoZSBzZXQgb2YgY2hhbmdlcyBpbmRlZmluaXRlbHlcbiAgICAvLyByZXN1bHRpbmcgaW4gZ3Jvd2luZyBtZW1vcnlcbiAgICBvcHRzLnJldHVybl9kb2NzID0gKCdyZXR1cm5fZG9jcycgaW4gb3B0cykgPyBvcHRzLnJldHVybl9kb2NzIDogIW9wdHMubGl2ZTtcblxuICAgIHJldHVybiBuZXcgQ2hhbmdlcyh0aGlzLCBvcHRzLCBjYWxsYmFjayk7XG4gIH1cblxuICB0eXBlKCkge1xuICAgIHJldHVybiAodHlwZW9mIHRoaXMuX3R5cGUgPT09ICdmdW5jdGlvbicpID8gdGhpcy5fdHlwZSgpIDogdGhpcy5hZGFwdGVyO1xuICB9XG59XG5cbi8vIFRoZSBhYnN0cmFjdCBwdXJnZSBpbXBsZW1lbnRhdGlvbiBleHBlY3RzIGEgZG9jIGlkIGFuZCB0aGUgcmV2IG9mIGEgbGVhZiBub2RlIGluIHRoYXQgZG9jLlxuLy8gSXQgd2lsbCByZXR1cm4gZXJyb3JzIGlmIHRoZSByZXYgZG9lc27igJl0IGV4aXN0IG9yIGlzbuKAmXQgYSBsZWFmLlxuQWJzdHJhY3RQb3VjaERCLnByb3RvdHlwZS5wdXJnZSA9IGFkYXB0ZXJGdW4oJ19wdXJnZScsIGZ1bmN0aW9uIChkb2NJZCwgcmV2LCBjYWxsYmFjaykge1xuICBpZiAodHlwZW9mIHRoaXMuX3B1cmdlID09PSAndW5kZWZpbmVkJykge1xuICAgIHJldHVybiBjYWxsYmFjayhjcmVhdGVFcnJvcihVTktOT1dOX0VSUk9SLCAnUHVyZ2UgaXMgbm90IGltcGxlbWVudGVkIGluIHRoZSAnICsgdGhpcy5hZGFwdGVyICsgJyBhZGFwdGVyLicpKTtcbiAgfVxuICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgc2VsZi5fZ2V0UmV2aXNpb25UcmVlKGRvY0lkLCAoZXJyb3IsIHJldnMpID0+IHtcbiAgICBpZiAoZXJyb3IpIHtcbiAgICAgIHJldHVybiBjYWxsYmFjayhlcnJvcik7XG4gICAgfVxuICAgIGlmICghcmV2cykge1xuICAgICAgcmV0dXJuIGNhbGxiYWNrKGNyZWF0ZUVycm9yKE1JU1NJTkdfRE9DKSk7XG4gICAgfVxuICAgIGxldCBwYXRoO1xuICAgIHRyeSB7XG4gICAgICBwYXRoID0gZmluZFBhdGhUb0xlYWYocmV2cywgcmV2KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycm9yLm1lc3NhZ2UgfHwgZXJyb3IpO1xuICAgIH1cbiAgICBzZWxmLl9wdXJnZShkb2NJZCwgcGF0aCwgKGVycm9yLCByZXN1bHQpID0+IHtcbiAgICAgIGlmIChlcnJvcikge1xuICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyb3IpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYXBwZW5kUHVyZ2VTZXEoc2VsZiwgZG9jSWQsIHJldikudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKG51bGwsIHJlc3VsdCk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICB9KTtcbn0pO1xuXG5leHBvcnQgZGVmYXVsdCBBYnN0cmFjdFBvdWNoREI7XG4iLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBUYXNrUXVldWUge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLmlzUmVhZHkgPSBmYWxzZTtcbiAgICB0aGlzLmZhaWxlZCA9IGZhbHNlO1xuICAgIHRoaXMucXVldWUgPSBbXTtcbiAgfVxuXG4gIGV4ZWN1dGUoKSB7XG4gICAgdmFyIGZ1bjtcbiAgICBpZiAodGhpcy5mYWlsZWQpIHtcbiAgICAgIHdoaWxlICgoZnVuID0gdGhpcy5xdWV1ZS5zaGlmdCgpKSkge1xuICAgICAgICBmdW4odGhpcy5mYWlsZWQpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB3aGlsZSAoKGZ1biA9IHRoaXMucXVldWUuc2hpZnQoKSkpIHtcbiAgICAgICAgZnVuKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZmFpbChlcnIpIHtcbiAgICB0aGlzLmZhaWxlZCA9IGVycjtcbiAgICB0aGlzLmV4ZWN1dGUoKTtcbiAgfVxuXG4gIHJlYWR5KGRiKSB7XG4gICAgdGhpcy5pc1JlYWR5ID0gdHJ1ZTtcbiAgICB0aGlzLmRiID0gZGI7XG4gICAgdGhpcy5leGVjdXRlKCk7XG4gIH1cblxuICBhZGRUYXNrKGZ1bikge1xuICAgIHRoaXMucXVldWUucHVzaChmdW4pO1xuICAgIGlmICh0aGlzLmZhaWxlZCkge1xuICAgICAgdGhpcy5leGVjdXRlKCk7XG4gICAgfVxuICB9XG59XG4iLCJpbXBvcnQgeyBndWFyZGVkQ29uc29sZSwgaGFzTG9jYWxTdG9yYWdlIH0gZnJvbSAncG91Y2hkYi11dGlscyc7XG5cbmNvbnN0IGdldFBhcnNlQWRhcHRlciA9IChQb3VjaERCKSA9PiBmdW5jdGlvbiBwYXJzZUFkYXB0ZXIobmFtZSwgb3B0cykge1xuICB2YXIgbWF0Y2ggPSBuYW1lLm1hdGNoKC8oW2Etei1dKik6XFwvXFwvKC4qKS8pO1xuICBpZiAobWF0Y2gpIHtcbiAgICAvLyB0aGUgaHR0cCBhZGFwdGVyIGV4cGVjdHMgdGhlIGZ1bGx5IHF1YWxpZmllZCBuYW1lXG4gICAgcmV0dXJuIHtcbiAgICAgIG5hbWU6IC9odHRwcz8vLnRlc3QobWF0Y2hbMV0pID8gbWF0Y2hbMV0gKyAnOi8vJyArIG1hdGNoWzJdIDogbWF0Y2hbMl0sXG4gICAgICBhZGFwdGVyOiBtYXRjaFsxXVxuICAgIH07XG4gIH1cblxuICB2YXIgYWRhcHRlcnMgPSBQb3VjaERCLmFkYXB0ZXJzO1xuICB2YXIgcHJlZmVycmVkQWRhcHRlcnMgPSBQb3VjaERCLnByZWZlcnJlZEFkYXB0ZXJzO1xuICB2YXIgcHJlZml4ID0gUG91Y2hEQi5wcmVmaXg7XG4gIHZhciBhZGFwdGVyTmFtZSA9IG9wdHMuYWRhcHRlcjtcblxuICBpZiAoIWFkYXB0ZXJOYW1lKSB7IC8vIGF1dG9tYXRpY2FsbHkgZGV0ZXJtaW5lIGFkYXB0ZXJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHByZWZlcnJlZEFkYXB0ZXJzLmxlbmd0aDsgKytpKSB7XG4gICAgICBhZGFwdGVyTmFtZSA9IHByZWZlcnJlZEFkYXB0ZXJzW2ldO1xuICAgICAgLy8gY2hlY2sgZm9yIGJyb3dzZXJzIHRoYXQgaGF2ZSBiZWVuIHVwZ3JhZGVkIGZyb20gd2Vic3FsLW9ubHkgdG8gd2Vic3FsK2lkYlxuICAgICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgICBpZiAoYWRhcHRlck5hbWUgPT09ICdpZGInICYmICd3ZWJzcWwnIGluIGFkYXB0ZXJzICYmXG4gICAgICAgICAgaGFzTG9jYWxTdG9yYWdlKCkgJiYgbG9jYWxTdG9yYWdlWydfcG91Y2hfX3dlYnNxbGRiXycgKyBwcmVmaXggKyBuYW1lXSkge1xuICAgICAgICAvLyBsb2cgaXQsIGJlY2F1c2UgdGhpcyBjYW4gYmUgY29uZnVzaW5nIGR1cmluZyBkZXZlbG9wbWVudFxuICAgICAgICBndWFyZGVkQ29uc29sZSgnbG9nJywgJ1BvdWNoREIgaXMgZG93bmdyYWRpbmcgXCInICsgbmFtZSArICdcIiB0byBXZWJTUUwgdG8nICtcbiAgICAgICAgICAnIGF2b2lkIGRhdGEgbG9zcywgYmVjYXVzZSBpdCB3YXMgYWxyZWFkeSBvcGVuZWQgd2l0aCBXZWJTUUwuJyk7XG4gICAgICAgIGNvbnRpbnVlOyAvLyBrZWVwIHVzaW5nIHdlYnNxbCB0byBhdm9pZCB1c2VyIGRhdGEgbG9zc1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgdmFyIGFkYXB0ZXIgPSBhZGFwdGVyc1thZGFwdGVyTmFtZV07XG5cbiAgLy8gaWYgYWRhcHRlciBpcyBpbnZhbGlkLCB0aGVuIGFuIGVycm9yIHdpbGwgYmUgdGhyb3duIGxhdGVyXG4gIHZhciB1c2VQcmVmaXggPSAoYWRhcHRlciAmJiAndXNlX3ByZWZpeCcgaW4gYWRhcHRlcikgP1xuICAgIGFkYXB0ZXIudXNlX3ByZWZpeCA6IHRydWU7XG5cbiAgcmV0dXJuIHtcbiAgICBuYW1lOiB1c2VQcmVmaXggPyAocHJlZml4ICsgbmFtZSkgOiBuYW1lLFxuICAgIGFkYXB0ZXI6IGFkYXB0ZXJOYW1lXG4gIH07XG59O1xuXG5cblxuZXhwb3J0IGRlZmF1bHQgZ2V0UGFyc2VBZGFwdGVyOyIsImZ1bmN0aW9uIGluaGVyaXRzKEEsIEIpIHtcbiAgQS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEIucHJvdG90eXBlLCB7XG4gICAgY29uc3RydWN0b3I6IHsgdmFsdWU6IEEgfVxuICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNsYXNzKHBhcmVudCwgaW5pdCkge1xuICBsZXQga2xhc3MgPSBmdW5jdGlvbiAoLi4uYXJncykge1xuICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBrbGFzcykpIHtcbiAgICAgIHJldHVybiBuZXcga2xhc3MoLi4uYXJncyk7XG4gICAgfVxuICAgIGluaXQuYXBwbHkodGhpcywgYXJncyk7XG4gIH07XG4gIGluaGVyaXRzKGtsYXNzLCBwYXJlbnQpO1xuICByZXR1cm4ga2xhc3M7XG59XG4iLCJpbXBvcnQgQWRhcHRlciBmcm9tICcuL2FkYXB0ZXIuanMnO1xuaW1wb3J0IFRhc2tRdWV1ZSBmcm9tICcuL3Rhc2txdWV1ZSc7XG5pbXBvcnQgeyBjbG9uZSB9IGZyb20gJ3BvdWNoZGItdXRpbHMnO1xuaW1wb3J0IGdldFBhcnNlQWRhcHRlciBmcm9tICcuL3BhcnNlQWRhcHRlcic7XG5pbXBvcnQgeyBjcmVhdGVDbGFzcyB9IGZyb20gJy4vdXRpbHMnO1xuXG4vLyBPSywgc28gaGVyZSdzIHRoZSBkZWFsLiBDb25zaWRlciB0aGlzIGNvZGU6XG4vLyAgICAgdmFyIGRiMSA9IG5ldyBQb3VjaERCKCdmb28nKTtcbi8vICAgICB2YXIgZGIyID0gbmV3IFBvdWNoREIoJ2ZvbycpO1xuLy8gICAgIGRiMS5kZXN0cm95KCk7XG4vLyBeIHRoZXNlIHR3byBib3RoIG5lZWQgdG8gZW1pdCAnZGVzdHJveWVkJyBldmVudHMsXG4vLyBhcyB3ZWxsIGFzIHRoZSBQb3VjaERCIGNvbnN0cnVjdG9yIGl0c2VsZi5cbi8vIFNvIHdlIGhhdmUgb25lIGRiIG9iamVjdCAod2hpY2hldmVyIG9uZSBnb3QgZGVzdHJveSgpIGNhbGxlZCBvbiBpdClcbi8vIHJlc3BvbnNpYmxlIGZvciBlbWl0dGluZyB0aGUgaW5pdGlhbCBldmVudCwgd2hpY2ggdGhlbiBnZXRzIGVtaXR0ZWRcbi8vIGJ5IHRoZSBjb25zdHJ1Y3Rvciwgd2hpY2ggdGhlbiBicm9hZGNhc3RzIGl0IHRvIGFueSBvdGhlciBkYnNcbi8vIHRoYXQgbWF5IGhhdmUgYmVlbiBjcmVhdGVkIHdpdGggdGhlIHNhbWUgbmFtZS5cbmZ1bmN0aW9uIHByZXBhcmVGb3JEZXN0cnVjdGlvbihzZWxmKSB7XG5cbiAgZnVuY3Rpb24gb25EZXN0cm95ZWQoZnJvbV9jb25zdHJ1Y3Rvcikge1xuICAgIHNlbGYucmVtb3ZlTGlzdGVuZXIoJ2Nsb3NlZCcsIG9uQ2xvc2VkKTtcbiAgICBpZiAoIWZyb21fY29uc3RydWN0b3IpIHtcbiAgICAgIHNlbGYuY29uc3RydWN0b3IuZW1pdCgnZGVzdHJveWVkJywgc2VsZi5uYW1lKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBvbkNsb3NlZCgpIHtcbiAgICBzZWxmLnJlbW92ZUxpc3RlbmVyKCdkZXN0cm95ZWQnLCBvbkRlc3Ryb3llZCk7XG4gICAgc2VsZi5jb25zdHJ1Y3Rvci5lbWl0KCd1bnJlZicsIHNlbGYpO1xuICB9XG5cbiAgc2VsZi5vbmNlKCdkZXN0cm95ZWQnLCBvbkRlc3Ryb3llZCk7XG4gIHNlbGYub25jZSgnY2xvc2VkJywgb25DbG9zZWQpO1xuICBzZWxmLmNvbnN0cnVjdG9yLmVtaXQoJ3JlZicsIHNlbGYpO1xufVxuXG5jbGFzcyBQb3VjaEludGVybmFsIGV4dGVuZHMgQWRhcHRlciB7XG4gIGNvbnN0cnVjdG9yKG5hbWUsIG9wdHMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuX3NldHVwKG5hbWUsIG9wdHMpO1xuICB9XG5cbiAgX3NldHVwKG5hbWUsIG9wdHMpIHtcbiAgICBzdXBlci5fc2V0dXAoKTtcbiAgICBvcHRzID0gb3B0cyB8fCB7fTtcblxuICAgIGlmIChuYW1lICYmIHR5cGVvZiBuYW1lID09PSAnb2JqZWN0Jykge1xuICAgICAgb3B0cyA9IG5hbWU7XG4gICAgICBuYW1lID0gb3B0cy5uYW1lO1xuICAgICAgZGVsZXRlIG9wdHMubmFtZTtcbiAgICB9XG5cbiAgICBpZiAob3B0cy5kZXRlcm1pbmlzdGljX3JldnMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgb3B0cy5kZXRlcm1pbmlzdGljX3JldnMgPSB0cnVlO1xuICAgIH1cblxuICAgIHRoaXMuX19vcHRzID0gb3B0cyA9IGNsb25lKG9wdHMpO1xuXG4gICAgdGhpcy5hdXRvX2NvbXBhY3Rpb24gPSBvcHRzLmF1dG9fY29tcGFjdGlvbjtcbiAgICB0aGlzLnB1cmdlZF9pbmZvc19saW1pdCA9IG9wdHMucHVyZ2VkX2luZm9zX2xpbWl0IHx8IDEwMDA7XG4gICAgdGhpcy5wcmVmaXggPSBQb3VjaERCLnByZWZpeDtcblxuICAgIGlmICh0eXBlb2YgbmFtZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTWlzc2luZy9pbnZhbGlkIERCIG5hbWUnKTtcbiAgICB9XG5cbiAgICB2YXIgcHJlZml4ZWROYW1lID0gKG9wdHMucHJlZml4IHx8ICcnKSArIG5hbWU7XG4gICAgdmFyIGJhY2tlbmQgPSBwYXJzZUFkYXB0ZXIocHJlZml4ZWROYW1lLCBvcHRzKTtcblxuICAgIG9wdHMubmFtZSA9IGJhY2tlbmQubmFtZTtcbiAgICBvcHRzLmFkYXB0ZXIgPSBvcHRzLmFkYXB0ZXIgfHwgYmFja2VuZC5hZGFwdGVyO1xuXG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICB0aGlzLl9hZGFwdGVyID0gb3B0cy5hZGFwdGVyO1xuICAgIFBvdWNoREIuZW1pdCgnZGVidWcnLCBbJ2FkYXB0ZXInLCAnUGlja2VkIGFkYXB0ZXI6ICcsIG9wdHMuYWRhcHRlcl0pO1xuXG4gICAgaWYgKCFQb3VjaERCLmFkYXB0ZXJzW29wdHMuYWRhcHRlcl0gfHxcbiAgICAgICAgIVBvdWNoREIuYWRhcHRlcnNbb3B0cy5hZGFwdGVyXS52YWxpZCgpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgQWRhcHRlcjogJyArIG9wdHMuYWRhcHRlcik7XG4gICAgfVxuXG4gICAgaWYgKG9wdHMudmlld19hZGFwdGVyKSB7XG4gICAgICBpZiAoIVBvdWNoREIuYWRhcHRlcnNbb3B0cy52aWV3X2FkYXB0ZXJdIHx8XG4gICAgICAgICAgIVBvdWNoREIuYWRhcHRlcnNbb3B0cy52aWV3X2FkYXB0ZXJdLnZhbGlkKCkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIFZpZXcgQWRhcHRlcjogJyArIG9wdHMudmlld19hZGFwdGVyKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLnRhc2txdWV1ZSA9IG5ldyBUYXNrUXVldWUoKTtcblxuICAgIHRoaXMuYWRhcHRlciA9IG9wdHMuYWRhcHRlcjtcblxuICAgIFBvdWNoREIuYWRhcHRlcnNbb3B0cy5hZGFwdGVyXS5jYWxsKHRoaXMsIG9wdHMsIChlcnIpID0+IHtcbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudGFza3F1ZXVlLmZhaWwoZXJyKTtcbiAgICAgIH1cbiAgICAgIHByZXBhcmVGb3JEZXN0cnVjdGlvbih0aGlzKTtcblxuICAgICAgdGhpcy5lbWl0KCdjcmVhdGVkJywgdGhpcyk7XG4gICAgICBQb3VjaERCLmVtaXQoJ2NyZWF0ZWQnLCB0aGlzLm5hbWUpO1xuICAgICAgdGhpcy50YXNrcXVldWUucmVhZHkodGhpcyk7XG4gICAgfSk7XG4gIH1cbn1cblxuY29uc3QgUG91Y2hEQiA9IGNyZWF0ZUNsYXNzKFBvdWNoSW50ZXJuYWwsIGZ1bmN0aW9uIChuYW1lLCBvcHRzKSB7XG4gIFBvdWNoSW50ZXJuYWwucHJvdG90eXBlLl9zZXR1cC5jYWxsKHRoaXMsIG5hbWUsIG9wdHMpO1xufSk7XG5cbmNvbnN0IHBhcnNlQWRhcHRlciA9IGdldFBhcnNlQWRhcHRlcihQb3VjaERCKTtcblxuZXhwb3J0IGRlZmF1bHQgUG91Y2hEQjtcbiIsImltcG9ydCB7djQgYXMgdXVpZHY0fSBmcm9tIFwidXVpZFwiO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBBY3RpdmVUYXNrcyB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMudGFza3MgPSB7fTtcbiAgfVxuXG4gIGxpc3QoKSB7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy50YXNrcyk7XG4gIH1cblxuICBhZGQodGFzaykge1xuICAgIGNvbnN0IGlkID0gdXVpZHY0KCk7XG4gICAgdGhpcy50YXNrc1tpZF0gPSB7XG4gICAgICBpZCxcbiAgICAgIG5hbWU6IHRhc2submFtZSxcbiAgICAgIHRvdGFsX2l0ZW1zOiB0YXNrLnRvdGFsX2l0ZW1zLFxuICAgICAgY3JlYXRlZF9hdDogbmV3IERhdGUoKS50b0pTT04oKVxuICAgIH07XG4gICAgcmV0dXJuIGlkO1xuICB9XG5cbiAgZ2V0KGlkKSB7XG4gICAgcmV0dXJuIHRoaXMudGFza3NbaWRdO1xuICB9XG5cbiAgLyogZXNsaW50LWRpc2FibGUgbm8tdW51c2VkLXZhcnMgKi9cbiAgcmVtb3ZlKGlkLCByZWFzb24pIHtcbiAgICBkZWxldGUgdGhpcy50YXNrc1tpZF07XG4gICAgcmV0dXJuIHRoaXMudGFza3M7XG4gIH1cblxuICB1cGRhdGUoaWQsIHVwZGF0ZWRUYXNrKSB7XG4gICAgY29uc3QgdGFzayA9IHRoaXMudGFza3NbaWRdO1xuICAgIGlmICh0eXBlb2YgdGFzayAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIGNvbnN0IG1lcmdlZFRhc2sgPSB7XG4gICAgICAgIGlkOiB0YXNrLmlkLFxuICAgICAgICBuYW1lOiB0YXNrLm5hbWUsXG4gICAgICAgIGNyZWF0ZWRfYXQ6IHRhc2suY3JlYXRlZF9hdCxcbiAgICAgICAgdG90YWxfaXRlbXM6IHVwZGF0ZWRUYXNrLnRvdGFsX2l0ZW1zIHx8IHRhc2sudG90YWxfaXRlbXMsXG4gICAgICAgIGNvbXBsZXRlZF9pdGVtczogdXBkYXRlZFRhc2suY29tcGxldGVkX2l0ZW1zIHx8IHRhc2suY29tcGxldGVkX2l0ZW1zLFxuICAgICAgICB1cGRhdGVkX2F0OiBuZXcgRGF0ZSgpLnRvSlNPTigpXG4gICAgICB9O1xuICAgICAgdGhpcy50YXNrc1tpZF0gPSBtZXJnZWRUYXNrO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy50YXNrcztcbiAgfVxufVxuIiwiLy8gJ3VzZSBzdHJpY3QnOyBpcyBkZWZhdWx0IHdoZW4gRVNNXG5cbmltcG9ydCBQb3VjaERCIGZyb20gJy4vY29uc3RydWN0b3InO1xuaW1wb3J0IEVFIGZyb20gJ2V2ZW50cyc7XG5pbXBvcnQgeyBmZXRjaCB9IGZyb20gJ3BvdWNoZGItZmV0Y2gnO1xuaW1wb3J0IEFjdGl2ZVRhc2tzIGZyb20gJy4vYWN0aXZlLXRhc2tzJztcbmltcG9ydCB7IGNyZWF0ZUNsYXNzIH0gZnJvbSAnLi91dGlscyc7XG5cblBvdWNoREIuYWRhcHRlcnMgPSB7fTtcblBvdWNoREIucHJlZmVycmVkQWRhcHRlcnMgPSBbXTtcblxuUG91Y2hEQi5wcmVmaXggPSAnX3BvdWNoXyc7XG5cbnZhciBldmVudEVtaXR0ZXIgPSBuZXcgRUUoKTtcblxuZnVuY3Rpb24gc2V0VXBFdmVudEVtaXR0ZXIoUG91Y2gpIHtcbiAgT2JqZWN0LmtleXMoRUUucHJvdG90eXBlKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcbiAgICBpZiAodHlwZW9mIEVFLnByb3RvdHlwZVtrZXldID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBQb3VjaFtrZXldID0gZXZlbnRFbWl0dGVyW2tleV0uYmluZChldmVudEVtaXR0ZXIpO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gdGhlc2UgYXJlIGNyZWF0ZWQgaW4gY29uc3RydWN0b3IuanMsIGFuZCBhbGxvdyB1cyB0byBub3RpZnkgZWFjaCBEQiB3aXRoXG4gIC8vIHRoZSBzYW1lIG5hbWUgdGhhdCBpdCB3YXMgZGVzdHJveWVkLCB2aWEgdGhlIGNvbnN0cnVjdG9yIG9iamVjdFxuICB2YXIgZGVzdHJ1Y3RMaXN0ZW5lcnMgPSBQb3VjaC5fZGVzdHJ1Y3Rpb25MaXN0ZW5lcnMgPSBuZXcgTWFwKCk7XG5cbiAgUG91Y2gub24oJ3JlZicsIGZ1bmN0aW9uIG9uQ29uc3RydWN0b3JSZWYoZGIpIHtcbiAgICBpZiAoIWRlc3RydWN0TGlzdGVuZXJzLmhhcyhkYi5uYW1lKSkge1xuICAgICAgZGVzdHJ1Y3RMaXN0ZW5lcnMuc2V0KGRiLm5hbWUsIFtdKTtcbiAgICB9XG4gICAgZGVzdHJ1Y3RMaXN0ZW5lcnMuZ2V0KGRiLm5hbWUpLnB1c2goZGIpO1xuICB9KTtcblxuICBQb3VjaC5vbigndW5yZWYnLCBmdW5jdGlvbiBvbkNvbnN0cnVjdG9yVW5yZWYoZGIpIHtcbiAgICBpZiAoIWRlc3RydWN0TGlzdGVuZXJzLmhhcyhkYi5uYW1lKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgZGJMaXN0ID0gZGVzdHJ1Y3RMaXN0ZW5lcnMuZ2V0KGRiLm5hbWUpO1xuICAgIHZhciBwb3MgPSBkYkxpc3QuaW5kZXhPZihkYik7XG4gICAgaWYgKHBvcyA8IDApIHtcbiAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGRiTGlzdC5zcGxpY2UocG9zLCAxKTtcbiAgICBpZiAoZGJMaXN0Lmxlbmd0aCA+IDEpIHtcbiAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gICAgICBkZXN0cnVjdExpc3RlbmVycy5zZXQoZGIubmFtZSwgZGJMaXN0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgZGVzdHJ1Y3RMaXN0ZW5lcnMuZGVsZXRlKGRiLm5hbWUpO1xuICAgIH1cbiAgfSk7XG5cbiAgUG91Y2gub24oJ2Rlc3Ryb3llZCcsIGZ1bmN0aW9uIG9uQ29uc3RydWN0b3JEZXN0cm95ZWQobmFtZSkge1xuICAgIGlmICghZGVzdHJ1Y3RMaXN0ZW5lcnMuaGFzKG5hbWUpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciBkYkxpc3QgPSBkZXN0cnVjdExpc3RlbmVycy5nZXQobmFtZSk7XG4gICAgZGVzdHJ1Y3RMaXN0ZW5lcnMuZGVsZXRlKG5hbWUpO1xuICAgIGRiTGlzdC5mb3JFYWNoKGZ1bmN0aW9uIChkYikge1xuICAgICAgZGIuZW1pdCgnZGVzdHJveWVkJyx0cnVlKTtcbiAgICB9KTtcbiAgfSk7XG59XG5cbnNldFVwRXZlbnRFbWl0dGVyKFBvdWNoREIpO1xuXG5Qb3VjaERCLmFkYXB0ZXIgPSBmdW5jdGlvbiAoaWQsIG9iaiwgYWRkVG9QcmVmZXJyZWRBZGFwdGVycykge1xuICAvKiBpc3RhbmJ1bCBpZ25vcmUgZWxzZSAqL1xuICBpZiAob2JqLnZhbGlkKCkpIHtcbiAgICBQb3VjaERCLmFkYXB0ZXJzW2lkXSA9IG9iajtcbiAgICBpZiAoYWRkVG9QcmVmZXJyZWRBZGFwdGVycykge1xuICAgICAgUG91Y2hEQi5wcmVmZXJyZWRBZGFwdGVycy5wdXNoKGlkKTtcbiAgICB9XG4gIH1cbn07XG5cblBvdWNoREIucGx1Z2luID0gZnVuY3Rpb24gKG9iaikge1xuICBpZiAodHlwZW9mIG9iaiA9PT0gJ2Z1bmN0aW9uJykgeyAvLyBmdW5jdGlvbiBzdHlsZSBmb3IgcGx1Z2luc1xuICAgIG9iaihQb3VjaERCKTtcbiAgfSBlbHNlIGlmICh0eXBlb2Ygb2JqICE9PSAnb2JqZWN0JyB8fCBPYmplY3Qua2V5cyhvYmopLmxlbmd0aCA9PT0gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBwbHVnaW46IGdvdCBcIicgKyBvYmogKyAnXCIsIGV4cGVjdGVkIGFuIG9iamVjdCBvciBhIGZ1bmN0aW9uJyk7XG4gIH0gZWxzZSB7XG4gICAgT2JqZWN0LmtleXMob2JqKS5mb3JFYWNoKGZ1bmN0aW9uIChpZCkgeyAvLyBvYmplY3Qgc3R5bGUgZm9yIHBsdWdpbnNcbiAgICAgIFBvdWNoREIucHJvdG90eXBlW2lkXSA9IG9ialtpZF07XG4gICAgfSk7XG4gIH1cbiAgaWYgKHRoaXMuX19kZWZhdWx0cykge1xuICAgIFBvdWNoREIuX19kZWZhdWx0cyA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMuX19kZWZhdWx0cyk7XG4gIH1cbiAgcmV0dXJuIFBvdWNoREI7XG59O1xuXG5Qb3VjaERCLmRlZmF1bHRzID0gZnVuY3Rpb24gKGRlZmF1bHRPcHRzKSB7XG4gIGxldCBQb3VjaFdpdGhEZWZhdWx0cyA9IGNyZWF0ZUNsYXNzKFBvdWNoREIsIGZ1bmN0aW9uIChuYW1lLCBvcHRzKSB7XG4gICAgb3B0cyA9IG9wdHMgfHwge307XG5cbiAgICBpZiAobmFtZSAmJiB0eXBlb2YgbmFtZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgIG9wdHMgPSBuYW1lO1xuICAgICAgbmFtZSA9IG9wdHMubmFtZTtcbiAgICAgIGRlbGV0ZSBvcHRzLm5hbWU7XG4gICAgfVxuXG4gICAgb3B0cyA9IE9iamVjdC5hc3NpZ24oe30sIFBvdWNoV2l0aERlZmF1bHRzLl9fZGVmYXVsdHMsIG9wdHMpO1xuICAgIFBvdWNoREIuY2FsbCh0aGlzLCBuYW1lLCBvcHRzKTtcbiAgfSk7XG5cbiAgUG91Y2hXaXRoRGVmYXVsdHMucHJlZmVycmVkQWRhcHRlcnMgPSBQb3VjaERCLnByZWZlcnJlZEFkYXB0ZXJzLnNsaWNlKCk7XG4gIE9iamVjdC5rZXlzKFBvdWNoREIpLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgIGlmICghKGtleSBpbiBQb3VjaFdpdGhEZWZhdWx0cykpIHtcbiAgICAgIFBvdWNoV2l0aERlZmF1bHRzW2tleV0gPSBQb3VjaERCW2tleV07XG4gICAgfVxuICB9KTtcblxuICAvLyBtYWtlIGRlZmF1bHQgb3B0aW9ucyB0cmFuc2l0aXZlXG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9wb3VjaGRiL3BvdWNoZGIvaXNzdWVzLzU5MjJcbiAgUG91Y2hXaXRoRGVmYXVsdHMuX19kZWZhdWx0cyA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMuX19kZWZhdWx0cywgZGVmYXVsdE9wdHMpO1xuXG4gIHJldHVybiBQb3VjaFdpdGhEZWZhdWx0cztcbn07XG5cblBvdWNoREIuZmV0Y2ggPSBmdW5jdGlvbiAodXJsLCBvcHRzKSB7XG4gIHJldHVybiBmZXRjaCh1cmwsIG9wdHMpO1xufTtcblxuUG91Y2hEQi5wcm90b3R5cGUuYWN0aXZlVGFza3MgPSBQb3VjaERCLmFjdGl2ZVRhc2tzID0gbmV3IEFjdGl2ZVRhc2tzKCk7XG5cbmV4cG9ydCBkZWZhdWx0IFBvdWNoREI7XG4iLCIvLyBtYW5hZ2VkIGF1dG9tYXRpY2FsbHkgYnkgc2V0LXZlcnNpb24uanNcbmV4cG9ydCBkZWZhdWx0IFwiNy4wLjAtcHJlcmVsZWFzZVwiO1xuIiwiaW1wb3J0IFBvdWNoREIgZnJvbSAnLi9zZXR1cCc7XG5pbXBvcnQgdmVyc2lvbiBmcm9tICcuL3ZlcnNpb24nO1xuaW1wb3J0IHBvdWNoQ2hhbmdlc0ZpbHRlciBmcm9tICdwb3VjaGRiLWNoYW5nZXMtZmlsdGVyJztcblxuLy8gVE9ETzogcmVtb3ZlIGZyb20gcG91Y2hkYi1jb3JlIChicmVha2luZylcblBvdWNoREIucGx1Z2luKHBvdWNoQ2hhbmdlc0ZpbHRlcik7XG5cblBvdWNoREIudmVyc2lvbiA9IHZlcnNpb247XG5cbmV4cG9ydCBkZWZhdWx0IFBvdWNoREI7XG4iXSwibmFtZXMiOlsiUG91Y2hEQiIsIm5leHRUaWNrIiwiRXZlbnRFbWl0dGVyIiwiYnVsa0dldFNoaW0iLCJBZGFwdGVyIiwidXVpZHY0IiwiRUUiLCJwb3VjaENoYW5nZXNGaWx0ZXIiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFlQSxTQUFTLHdCQUF3QixDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRTtBQUNsRTtBQUNBLEVBQUUsSUFBSTtBQUNOLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztBQUNsRCxHQUFHLENBQUMsT0FBTyxDQUFDLEVBQUU7QUFDZCxJQUFJLGNBQWMsQ0FBQyxPQUFPLEVBQUUsbUNBQW1DLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDcEUsR0FBRztBQUNILENBQUM7QUFDRDtBQUNBLFNBQVMsYUFBYSxDQUFDLEdBQUcsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFO0FBQzVDLEVBQUUsSUFBSSxVQUFVLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztBQUNyQyxFQUFFLElBQUksSUFBSSxDQUFDLEtBQUssS0FBSyxVQUFVLEVBQUU7QUFDakMsSUFBSSxVQUFVLEdBQUcsYUFBYSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUM7QUFDakQsS0FBSyxHQUFHLENBQUMsVUFBVSxDQUFDLEVBQUUsRUFBRSxPQUFPLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUNoRCxHQUFHO0FBQ0gsRUFBRSxJQUFJLE1BQU0sR0FBRztBQUNmLElBQUksRUFBRSxFQUFFLFFBQVEsQ0FBQyxFQUFFO0FBQ25CLElBQUksT0FBTyxFQUFFLFVBQVU7QUFDdkIsSUFBSSxHQUFHLEVBQUUsR0FBRztBQUNaLEdBQUcsQ0FBQztBQUNKO0FBQ0EsRUFBRSxJQUFJLFNBQVMsQ0FBQyxRQUFRLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFO0FBQ3JDLElBQUksTUFBTSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUM7QUFDMUIsR0FBRztBQUNILEVBQUUsSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFO0FBQ3RCLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEdBQUcsZ0JBQWdCLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDdkQsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsTUFBTSxFQUFFO0FBQ3ZDLE1BQU0sT0FBTyxNQUFNLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQztBQUNuQyxLQUFLO0FBQ0wsR0FBRztBQUNILEVBQUUsT0FBTyxNQUFNLENBQUM7QUFDaEIsQ0FBQztBQUNEO0FBQ0EsTUFBTSxPQUFPLFNBQVMsTUFBTSxDQUFDO0FBQzdCLEVBQUUsV0FBVyxDQUFDLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFO0FBQ2xDLElBQUksS0FBSyxFQUFFLENBQUM7QUFDWixJQUFJLElBQUksQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDO0FBQ2pCLElBQUksSUFBSSxHQUFHLElBQUksR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO0FBQ25DLElBQUksSUFBSSxRQUFRLEdBQUcsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsQ0FBQyxHQUFHLEVBQUUsSUFBSSxLQUFLO0FBQ3ZELE1BQU0sSUFBSSxHQUFHLEVBQUU7QUFDZixRQUFRLElBQUksYUFBYSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUU7QUFDOUMsVUFBVSxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxHQUFHLENBQUMsQ0FBQztBQUNsQyxTQUFTO0FBQ1QsT0FBTyxNQUFNO0FBQ2IsUUFBUSxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsQ0FBQztBQUNwQyxPQUFPO0FBQ1AsTUFBTSxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztBQUNoQyxNQUFNLEVBQUUsQ0FBQyxjQUFjLENBQUMsV0FBVyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0FBQ2hELEtBQUssQ0FBQyxDQUFDO0FBQ1AsSUFBSSxJQUFJLFFBQVEsRUFBRTtBQUNsQixNQUFNLElBQUksQ0FBQyxFQUFFLENBQUMsVUFBVSxFQUFFLFVBQVUsSUFBSSxFQUFFO0FBQzFDLFFBQVEsUUFBUSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztBQUM3QixPQUFPLENBQUMsQ0FBQztBQUNULE1BQU0sSUFBSSxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDakMsS0FBSztBQUNMLElBQUksTUFBTSxTQUFTLEdBQUcsTUFBTTtBQUM1QixNQUFNLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztBQUNwQixLQUFLLENBQUM7QUFDTixJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0FBQ3BDO0FBQ0EsSUFBSSxJQUFJLENBQUMsUUFBUSxHQUFHLENBQUMsTUFBTSxFQUFFLE9BQU8sRUFBRSxPQUFPLEtBQUs7QUFDbEQ7QUFDQSxNQUFNLElBQUksSUFBSSxDQUFDLFdBQVcsRUFBRTtBQUM1QixRQUFRLE9BQU87QUFDZixPQUFPO0FBQ1AsTUFBTSx3QkFBd0IsQ0FBQyxJQUFJLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztBQUMvRCxLQUFLLENBQUM7QUFDTjtBQUNBLElBQUksSUFBSSxPQUFPLEdBQUcsSUFBSSxPQUFPLENBQUMsVUFBVSxPQUFPLEVBQUUsTUFBTSxFQUFFO0FBQ3pELE1BQU0sSUFBSSxDQUFDLFFBQVEsR0FBRyxVQUFVLEdBQUcsRUFBRSxHQUFHLEVBQUU7QUFDMUMsUUFBUSxJQUFJLEdBQUcsRUFBRTtBQUNqQixVQUFVLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUN0QixTQUFTLE1BQU07QUFDZixVQUFVLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUN2QixTQUFTO0FBQ1QsT0FBTyxDQUFDO0FBQ1IsS0FBSyxDQUFDLENBQUM7QUFDUCxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLFlBQVk7QUFDcEMsTUFBTSxFQUFFLENBQUMsY0FBYyxDQUFDLFdBQVcsRUFBRSxTQUFTLENBQUMsQ0FBQztBQUNoRCxNQUFNLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLENBQUMsTUFBTSxFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUM7QUFDakQsS0FBSyxDQUFDLENBQUM7QUFDUCxJQUFJLElBQUksQ0FBQyxJQUFJLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDM0MsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUNuRCxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxNQUFNLEVBQUU7QUFDaEMsTUFBTSxRQUFRLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQzdCLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQztBQUNqQjtBQUNBO0FBQ0E7QUFDQSxJQUFJLElBQUksQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLE9BQU8sRUFBRTtBQUMvQixNQUFNLEVBQUUsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxLQUFLO0FBQ3ZDLFFBQVEsSUFBSSxNQUFNLEVBQUU7QUFDcEIsVUFBVSxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ2hDLFNBQVMsTUFBTSxJQUFJLElBQUksQ0FBQyxXQUFXLEVBQUU7QUFDckMsVUFBVSxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQzlCLFNBQVMsTUFBTTtBQUNmLFVBQVUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNyQyxTQUFTO0FBQ1QsT0FBTyxDQUFDLENBQUM7QUFDVCxLQUFLLE1BQU07QUFDWCxNQUFNLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDakMsS0FBSztBQUNMLEdBQUc7QUFDSDtBQUNBLEVBQUUsTUFBTSxHQUFHO0FBQ1gsSUFBSSxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQztBQUM1QixJQUFJLElBQUksSUFBSSxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsT0FBTyxFQUFFO0FBQ25DLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUMxQixLQUFLO0FBQ0wsR0FBRztBQUNIO0FBQ0EsRUFBRSxlQUFlLENBQUMsSUFBSSxFQUFFO0FBQ3hCLElBQUksSUFBSSxRQUFRLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQztBQUNqQztBQUNBO0FBQ0EsSUFBSSxJQUFJQSxTQUFPLENBQUMsb0JBQW9CLEVBQUU7QUFDdEMsTUFBTUEsU0FBTyxDQUFDLG9CQUFvQixDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxHQUFHLEtBQUs7QUFDM0QsUUFBUSxJQUFJLEdBQUcsRUFBRTtBQUNqQixVQUFVLE9BQU8sUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQy9CLFNBQVM7QUFDVCxRQUFRLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDN0IsT0FBTyxDQUFDLENBQUM7QUFDVCxLQUFLLE1BQU07QUFDWCxNQUFNLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDM0IsS0FBSztBQUNMLEdBQUc7QUFDSDtBQUNBLEVBQUUsU0FBUyxDQUFDLElBQUksRUFBRTtBQUNsQixJQUFJLElBQUksUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUM7QUFDakM7QUFDQSxJQUFJLElBQUksR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDdkIsSUFBSSxJQUFJLE1BQU0sSUFBSSxJQUFJLElBQUksRUFBRSxZQUFZLElBQUksSUFBSSxDQUFDLEVBQUU7QUFDbkQsTUFBTSxJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7QUFDbEMsS0FBSztBQUNMLElBQUksSUFBSSxDQUFDLGFBQWEsR0FBRyxhQUFhLENBQUM7QUFDdkM7QUFDQSxJQUFJLElBQUksSUFBSSxDQUFDLEtBQUssS0FBSyxRQUFRLEVBQUU7QUFDakMsTUFBTSxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztBQUN6QixLQUFLO0FBQ0wsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRTtBQUNyQixNQUFNLElBQUksQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDO0FBQ3JCLEtBQUs7QUFDTCxJQUFJLElBQUksSUFBSSxDQUFDLEtBQUssS0FBSyxLQUFLLEVBQUU7QUFDOUIsTUFBTSxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksS0FBSztBQUNwQztBQUNBLFFBQVEsSUFBSSxJQUFJLENBQUMsV0FBVyxFQUFFO0FBQzlCLFVBQVUsUUFBUSxDQUFDLElBQUksRUFBRSxDQUFDLE1BQU0sRUFBRSxXQUFXLENBQUMsQ0FBQyxDQUFDO0FBQ2hELFVBQVUsT0FBTztBQUNqQixTQUFTO0FBQ1QsUUFBUSxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUM7QUFDckMsUUFBUSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzdCLE9BQU8sRUFBRSxRQUFRLENBQUMsQ0FBQztBQUNuQixNQUFNLE9BQU87QUFDYixLQUFLO0FBQ0w7QUFDQTtBQUNBLElBQUksSUFBSUEsU0FBTyxDQUFDLG9CQUFvQixFQUFFO0FBQ3RDLE1BQU1BLFNBQU8sQ0FBQyxvQkFBb0IsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDbkQsTUFBTSxJQUFJQSxTQUFPLENBQUMsb0JBQW9CLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsRUFBRTtBQUNqRSxRQUFRLE9BQU9BLFNBQU8sQ0FBQyxvQkFBb0IsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQy9ELE9BQU87QUFDUCxLQUFLLE1BQU07QUFDWCxNQUFNLENBQUMsU0FBUyxFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUUsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQVUsR0FBRyxFQUFFO0FBQ3ZFLFFBQVEsSUFBSSxHQUFHLElBQUksSUFBSSxFQUFFO0FBQ3pCLFVBQVUsY0FBYyxDQUFDLE1BQU07QUFDL0IsWUFBWSxPQUFPLEdBQUcsR0FBRyxHQUFHLCtDQUErQztBQUMzRSxZQUFZLDREQUE0RDtBQUN4RSxZQUFZLDZEQUE2RDtBQUN6RSxXQUFXLENBQUM7QUFDWixTQUFTO0FBQ1QsT0FBTyxDQUFDLENBQUM7QUFDVCxLQUFLO0FBQ0w7QUFDQSxJQUFJLElBQUksRUFBRSxZQUFZLElBQUksSUFBSSxDQUFDLEVBQUU7QUFDakMsTUFBTSxJQUFJLENBQUMsVUFBVSxHQUFHLEtBQUssQ0FBQztBQUM5QixLQUFLO0FBQ0w7QUFDQTtBQUNBLElBQUksSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQztBQUNuRCxJQUFJLElBQUksQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDO0FBQzdCLElBQUksSUFBSSxVQUFVLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDNUM7QUFDQSxJQUFJLElBQUksVUFBVSxJQUFJLE9BQU8sVUFBVSxDQUFDLE1BQU0sS0FBSyxVQUFVLEVBQUU7QUFDL0QsTUFBTSxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDO0FBQ2pDLE1BQU0sSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLEdBQUcsSUFBSSxLQUFLO0FBQ2pDLFFBQVEsVUFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDO0FBQzVCLFFBQVEsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDakMsT0FBTyxDQUFDO0FBQ1IsS0FBSztBQUNMLEdBQUc7QUFDSDs7QUN2S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTLE9BQU8sQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFO0FBQzlCLEVBQUUsT0FBTyxJQUFJLEdBQUcsS0FBSyxHQUFHLENBQUMsQ0FBQyxHQUFHLElBQUksR0FBRyxLQUFLLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUNsRCxDQUFDO0FBQ0Q7QUFDQTtBQUNBO0FBQ0EsU0FBUyxTQUFTLENBQUMsUUFBUSxFQUFFLEtBQUssRUFBRTtBQUNwQyxFQUFFLE9BQU8sVUFBVSxHQUFHLEVBQUUsT0FBTyxFQUFFO0FBQ2pDLElBQUksSUFBSSxHQUFHLEtBQUssT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRTtBQUNqRCxNQUFNLEdBQUcsR0FBRyxHQUFHLElBQUksT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzlCLE1BQU0sR0FBRyxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7QUFDeEIsTUFBTSxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDcEIsS0FBSyxNQUFNO0FBQ1gsTUFBTSxRQUFRLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxNQUFNLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxDQUFDO0FBQzdELEtBQUs7QUFDTCxHQUFHLENBQUM7QUFDSixDQUFDO0FBQ0Q7QUFDQTtBQUNBLFNBQVMsU0FBUyxDQUFDLElBQUksRUFBRTtBQUN6QixFQUFFLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQ3hDLElBQUksSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3RCLElBQUksSUFBSSxHQUFHLENBQUMsUUFBUSxFQUFFO0FBQ3RCLE1BQU0sT0FBTyxHQUFHLENBQUMsWUFBWSxDQUFDO0FBQzlCLEtBQUssTUFBTSxJQUFJLEdBQUcsQ0FBQyxZQUFZLEVBQUU7QUFDakM7QUFDQSxNQUFNLElBQUksSUFBSSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBQy9DLE1BQU0sS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7QUFDNUMsUUFBUSxJQUFJLEdBQUcsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDMUIsUUFBUSxHQUFHLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQztBQUMxRCxVQUFVLENBQUMsTUFBTSxFQUFFLFFBQVEsRUFBRSxjQUFjLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDO0FBQzFFLE9BQU87QUFDUCxLQUFLO0FBQ0wsR0FBRztBQUNILENBQUM7QUFDRDtBQUNBO0FBQ0EsU0FBUyxrQkFBa0IsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFO0FBQ2xDLEVBQUUsSUFBSSxTQUFTLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3hDLEVBQUUsSUFBSSxTQUFTLEtBQUssQ0FBQyxFQUFFO0FBQ3ZCLElBQUksT0FBTyxTQUFTLENBQUM7QUFDckIsR0FBRztBQUNILEVBQUUsSUFBSSxNQUFNLEdBQUcsQ0FBQyxDQUFDLFVBQVUsR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUM7QUFDckQsRUFBRSxJQUFJLE1BQU0sR0FBRyxDQUFDLENBQUMsVUFBVSxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQztBQUNyRCxFQUFFLE9BQU8sT0FBTyxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQztBQUNqQyxDQUFDO0FBQ0Q7QUFDQTtBQUNBO0FBQ0EsU0FBUyxhQUFhLENBQUMsSUFBSSxFQUFFO0FBQzdCLEVBQUUsSUFBSSxNQUFNLEdBQUcsRUFBRSxDQUFDO0FBQ2xCLEVBQUUsSUFBSSxLQUFLLEdBQUcsRUFBRSxDQUFDO0FBQ2pCLEVBQUUsZUFBZSxDQUFDLElBQUksRUFBRSxVQUFVLE1BQU0sRUFBRSxHQUFHLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRTtBQUN6RCxJQUFJLElBQUksR0FBRyxHQUFHLEdBQUcsR0FBRyxHQUFHLEdBQUcsRUFBRSxDQUFDO0FBQzdCLElBQUksSUFBSSxNQUFNLEVBQUU7QUFDaEIsTUFBTSxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3RCLEtBQUs7QUFDTCxJQUFJLElBQUksSUFBSSxLQUFLLFNBQVMsRUFBRTtBQUM1QixNQUFNLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ3hDLEtBQUs7QUFDTCxJQUFJLE9BQU8sR0FBRyxDQUFDO0FBQ2YsR0FBRyxDQUFDLENBQUM7QUFDTDtBQUNBLEVBQUUsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO0FBQ2xCLEVBQUUsS0FBSyxDQUFDLE9BQU8sQ0FBQyxVQUFVLElBQUksRUFBRTtBQUNoQyxJQUFJLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxTQUFTLEVBQUU7QUFDekMsTUFBTSxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQzlDLEtBQUssTUFBTTtBQUNYLE1BQU0sTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUMzRSxLQUFLO0FBQ0wsR0FBRyxDQUFDLENBQUM7QUFDTCxFQUFFLE9BQU8sTUFBTSxDQUFDO0FBQ2hCLENBQUM7QUFDRDtBQUNBLFNBQVMsZ0JBQWdCLENBQUMsSUFBSSxFQUFFO0FBQ2hDLEVBQUUsSUFBSSxJQUFJLElBQUksQ0FBQyxPQUFPLElBQUksSUFBSTtBQUM5QixJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO0FBQ3RELElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxHQUFHLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQztBQUM3RCxFQUFFLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO0FBQ25CLEVBQUUsSUFBSSxDQUFDLElBQUksR0FBRyxDQUFDLENBQUM7QUFDaEIsRUFBRSxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUM7QUFDcEIsRUFBRSxJQUFJLElBQUksQ0FBQyxVQUFVLEVBQUU7QUFDdkIsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7QUFDbkIsSUFBSSxJQUFJLENBQUMsVUFBVSxHQUFHLEtBQUssQ0FBQztBQUM1QixHQUFHO0FBQ0gsQ0FBQztBQUNEO0FBQ0E7QUFDQTtBQUNBLFNBQVMsZ0JBQWdCLENBQUMsSUFBSSxFQUFFO0FBQ2hDLEVBQUUsSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3RDLEVBQUUsSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQztBQUN2QixFQUFFLElBQUksUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUM7QUFDL0IsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLG1CQUFtQixDQUFDLENBQUMsS0FBSyxDQUFDLFlBQVk7QUFDbEQsSUFBSSxPQUFPLEtBQUssQ0FBQztBQUNqQixHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxHQUFHLEVBQUU7QUFDekIsSUFBSSxJQUFJLEdBQUcsSUFBSSxHQUFHLENBQUMsUUFBUSxFQUFFO0FBQzdCLE1BQU0sSUFBSSxDQUFDLFFBQVEsR0FBRyxHQUFHLENBQUMsUUFBUSxDQUFDO0FBQ25DLEtBQUs7QUFDTCxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLFVBQVUsR0FBRyxFQUFFLEdBQUcsRUFBRTtBQUM1QztBQUNBLE1BQU0sSUFBSSxHQUFHLEVBQUU7QUFDZixRQUFRLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUN0QixPQUFPLE1BQU07QUFDYixRQUFRLFFBQVEsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDNUIsT0FBTztBQUNQLE1BQU1DLFNBQVEsQ0FBQyxZQUFZO0FBQzNCLFFBQVEsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssRUFBRSxDQUFDO0FBQ3RDLFFBQVEsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxFQUFFO0FBQzFDLFVBQVUsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDakMsU0FBUztBQUNULE9BQU8sQ0FBQyxDQUFDO0FBQ1QsS0FBSyxDQUFDLENBQUM7QUFDUCxHQUFHLENBQUMsQ0FBQztBQUNMLENBQUM7QUFDRDtBQUNBLFNBQVMsY0FBYyxDQUFDLEVBQUUsRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFO0FBQ3hDLEVBQUUsT0FBTyxFQUFFLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLEdBQUcsRUFBRTtBQUNyRCxJQUFJLE1BQU0sUUFBUSxHQUFHLEdBQUcsQ0FBQyxRQUFRLEdBQUcsQ0FBQyxDQUFDO0FBQ3RDLElBQUksR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUM7QUFDcEIsTUFBTSxLQUFLO0FBQ1gsTUFBTSxHQUFHO0FBQ1QsTUFBTSxRQUFRO0FBQ2QsS0FBSyxDQUFDLENBQUM7QUFDUCxJQUFJLElBQUksR0FBRyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixFQUFFO0FBQ3JELE1BQU0sR0FBRyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0FBQ3hFLEtBQUs7QUFDTCxJQUFJLEdBQUcsQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDO0FBQzVCLElBQUksT0FBTyxHQUFHLENBQUM7QUFDZixHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsVUFBVSxHQUFHLEVBQUU7QUFDMUIsSUFBSSxJQUFJLEdBQUcsQ0FBQyxNQUFNLEtBQUssR0FBRyxFQUFFO0FBQzVCLE1BQU0sTUFBTSxHQUFHLENBQUM7QUFDaEIsS0FBSztBQUNMLElBQUksT0FBTztBQUNYLE1BQU0sR0FBRyxFQUFFLGVBQWU7QUFDMUIsTUFBTSxNQUFNLEVBQUUsQ0FBQztBQUNmLFFBQVEsS0FBSztBQUNiLFFBQVEsR0FBRztBQUNYLFFBQVEsUUFBUSxFQUFFLENBQUM7QUFDbkIsT0FBTyxDQUFDO0FBQ1IsTUFBTSxRQUFRLEVBQUUsQ0FBQztBQUNqQixLQUFLLENBQUM7QUFDTixHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxHQUFHLEVBQUU7QUFDekIsSUFBSSxPQUFPLEVBQUUsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDdkIsR0FBRyxDQUFDLENBQUM7QUFDTCxDQUFDO0FBQ0Q7QUFDQSxTQUFTLG1CQUFtQixDQUFDLElBQUksRUFBRTtBQUNuQyxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLEVBQUU7QUFDOUIsSUFBSSxPQUFPLElBQUksR0FBRyw4Q0FBOEM7QUFDaEUsTUFBTSwrQkFBK0IsQ0FBQztBQUN0QyxHQUFHO0FBQ0gsRUFBRSxPQUFPLEtBQUssQ0FBQztBQUNmLENBQUM7QUFDRDtBQUNBLE1BQU0sZUFBZSxTQUFTQyxRQUFZLENBQUM7QUFDM0MsRUFBRSxNQUFNLEdBQUc7QUFDWCxJQUFJLElBQUksQ0FBQyxJQUFJLEdBQUcsVUFBVSxDQUFDLE1BQU0sRUFBRSxVQUFVLEdBQUcsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFO0FBQ2xFLE1BQU0sSUFBSSxPQUFPLElBQUksS0FBSyxVQUFVLEVBQUU7QUFDdEMsUUFBUSxRQUFRLEdBQUcsSUFBSSxDQUFDO0FBQ3hCLFFBQVEsSUFBSSxHQUFHLEVBQUUsQ0FBQztBQUNsQixPQUFPO0FBQ1AsTUFBTSxJQUFJLE9BQU8sR0FBRyxLQUFLLFFBQVEsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFO0FBQ3pELFFBQVEsT0FBTyxRQUFRLENBQUMsV0FBVyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUM7QUFDcEQsT0FBTztBQUNQLE1BQU0sSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLFNBQVMsQ0FBQyxRQUFRLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDdkUsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ2xCO0FBQ0EsSUFBSSxJQUFJLENBQUMsR0FBRyxHQUFHLFVBQVUsQ0FBQyxLQUFLLEVBQUUsVUFBVSxHQUFHLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRTtBQUMxRCxNQUFNLElBQUksT0FBTyxJQUFJLEtBQUssVUFBVSxFQUFFO0FBQ3RDLFFBQVEsRUFBRSxHQUFHLElBQUksQ0FBQztBQUNsQixRQUFRLElBQUksR0FBRyxFQUFFLENBQUM7QUFDbEIsT0FBTztBQUNQLE1BQU0sSUFBSSxPQUFPLEdBQUcsS0FBSyxRQUFRLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRTtBQUN6RCxRQUFRLE9BQU8sRUFBRSxDQUFDLFdBQVcsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO0FBQzlDLE9BQU87QUFDUCxNQUFNLGNBQWMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDOUIsTUFBTSxJQUFJLFNBQVMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksT0FBTyxJQUFJLENBQUMsU0FBUyxLQUFLLFVBQVUsRUFBRTtBQUN0RSxRQUFRLElBQUksR0FBRyxDQUFDLFFBQVEsRUFBRTtBQUMxQixVQUFVLE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFDNUMsU0FBUyxNQUFNO0FBQ2YsVUFBVSxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0FBQ3pDLFNBQVM7QUFDVCxPQUFPO0FBQ1A7QUFDQSxNQUFNLE1BQU0sTUFBTSxHQUFHLENBQUMsSUFBSSxLQUFLO0FBQy9CLFFBQVEsSUFBSSxPQUFPLElBQUksQ0FBQyxJQUFJLEtBQUssVUFBVSxJQUFJLElBQUksQ0FBQyxTQUFTLEtBQUssS0FBSyxFQUFFO0FBQ3pFLFVBQVUsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQ3JDLFNBQVMsTUFBTTtBQUNmLFVBQVUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLFNBQVMsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDdkUsU0FBUztBQUNULE9BQU8sQ0FBQztBQUNSO0FBQ0EsTUFBTSxJQUFJLElBQUksQ0FBQyxLQUFLLElBQUksR0FBRyxDQUFDLElBQUksRUFBRTtBQUNsQyxRQUFRLG9DQUFvQyxFQUFFLENBQUM7QUFDL0MsUUFBUSxNQUFNLENBQUMsVUFBVSxHQUFHLEVBQUU7QUFDOUIsVUFBVSxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUUsR0FBRyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzNFLFVBQVUsRUFBRSxDQUFDLEdBQUcsRUFBRSxNQUFNLENBQUMsQ0FBQztBQUMxQixTQUFTLENBQUMsQ0FBQztBQUNYLE9BQU8sTUFBTTtBQUNiLFFBQVEsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ25CLE9BQU87QUFDUDtBQUNBLE1BQU0sU0FBUyxvQ0FBb0MsR0FBRztBQUN0RCxRQUFRLElBQUksS0FBSyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3hDLFFBQVEsSUFBSSxRQUFRLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2hDLFFBQVEsSUFBSSxTQUFTLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztBQUMvQztBQUNBLFFBQVEsSUFBSSxTQUFTLEdBQUcsU0FBUyxHQUFHLENBQUMsQ0FBQztBQUN0QyxRQUFRLElBQUksUUFBUSxHQUFHLEdBQUcsRUFBRSxDQUFDO0FBQzdCO0FBQ0EsUUFBUSxHQUFHLENBQUMsVUFBVSxHQUFHO0FBQ3pCLFVBQVUsS0FBSyxFQUFFLFNBQVM7QUFDMUIsVUFBVSxHQUFHLEVBQUUsQ0FBQyxRQUFRLEVBQUUsUUFBUSxDQUFDO0FBQ25DLFNBQVMsQ0FBQztBQUNWLFFBQVEsR0FBRyxDQUFDLElBQUksR0FBRyxTQUFTLEdBQUcsR0FBRyxHQUFHLFFBQVEsQ0FBQztBQUM5QyxRQUFRLElBQUksQ0FBQyxTQUFTLEdBQUcsS0FBSyxDQUFDO0FBQy9CLE9BQU87QUFDUCxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDbEI7QUFDQSxJQUFJLElBQUksQ0FBQyxhQUFhLEdBQUcsVUFBVSxDQUFDLGVBQWUsRUFBRSxVQUFVLEtBQUssRUFBRSxZQUFZLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUU7QUFDckcsTUFBTSxJQUFJLEdBQUcsR0FBRyxJQUFJLENBQUM7QUFDckIsTUFBTSxJQUFJLE9BQU8sSUFBSSxLQUFLLFVBQVUsRUFBRTtBQUN0QyxRQUFRLElBQUksR0FBRyxJQUFJLENBQUM7QUFDcEIsUUFBUSxJQUFJLEdBQUcsR0FBRyxDQUFDO0FBQ25CLFFBQVEsR0FBRyxHQUFHLElBQUksQ0FBQztBQUNuQixPQUFPO0FBQ1A7QUFDQTtBQUNBLE1BQU0sSUFBSSxPQUFPLElBQUksS0FBSyxXQUFXLEVBQUU7QUFDdkMsUUFBUSxJQUFJLEdBQUcsSUFBSSxDQUFDO0FBQ3BCLFFBQVEsSUFBSSxHQUFHLEdBQUcsQ0FBQztBQUNuQixRQUFRLEdBQUcsR0FBRyxJQUFJLENBQUM7QUFDbkIsT0FBTztBQUNQLE1BQU0sSUFBSSxDQUFDLElBQUksRUFBRTtBQUNqQixRQUFRLGNBQWMsQ0FBQyxNQUFNLEVBQUUsWUFBWSxFQUFFLFlBQVksRUFBRSxhQUFhLEVBQUUsS0FBSyxFQUFFLHlCQUF5QixDQUFDLENBQUM7QUFDNUcsT0FBTztBQUNQO0FBQ0EsTUFBTSxTQUFTLGdCQUFnQixDQUFDLEdBQUcsRUFBRTtBQUNyQyxRQUFRLElBQUksVUFBVSxHQUFHLE1BQU0sSUFBSSxHQUFHLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3BFLFFBQVEsR0FBRyxDQUFDLFlBQVksR0FBRyxHQUFHLENBQUMsWUFBWSxJQUFJLEVBQUUsQ0FBQztBQUNsRCxRQUFRLEdBQUcsQ0FBQyxZQUFZLENBQUMsWUFBWSxDQUFDLEdBQUc7QUFDekMsVUFBVSxZQUFZLEVBQUUsSUFBSTtBQUM1QixVQUFVLElBQUksRUFBRSxJQUFJO0FBQ3BCLFVBQVUsTUFBTSxFQUFFLEVBQUUsVUFBVTtBQUM5QixTQUFTLENBQUM7QUFDVixRQUFRLE9BQU8sR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUM1QixPQUFPO0FBQ1A7QUFDQSxNQUFNLE9BQU8sR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxHQUFHLEVBQUU7QUFDaEQsUUFBUSxJQUFJLEdBQUcsQ0FBQyxJQUFJLEtBQUssR0FBRyxFQUFFO0FBQzlCLFVBQVUsTUFBTSxXQUFXLENBQUMsWUFBWSxDQUFDLENBQUM7QUFDMUMsU0FBUztBQUNUO0FBQ0EsUUFBUSxPQUFPLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3JDLE9BQU8sRUFBRSxVQUFVLEdBQUcsRUFBRTtBQUN4QjtBQUNBO0FBQ0EsUUFBUSxJQUFJLEdBQUcsQ0FBQyxNQUFNLEtBQUssV0FBVyxDQUFDLE9BQU8sRUFBRTtBQUNoRCxVQUFVLE9BQU8sZ0JBQWdCLENBQUMsQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQztBQUNoRCxTQUFTLE1BQU07QUFDZixVQUFVLE1BQU0sR0FBRyxDQUFDO0FBQ3BCLFNBQVM7QUFDVCxPQUFPLENBQUMsQ0FBQztBQUNULEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNsQjtBQUNBLElBQUksSUFBSSxDQUFDLGdCQUFnQixHQUFHLFVBQVUsQ0FBQyxrQkFBa0IsRUFBRSxVQUFVLEtBQUssRUFBRSxZQUFZLEVBQUUsR0FBRyxFQUFFLFFBQVEsRUFBRTtBQUN6RyxNQUFNLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsS0FBSztBQUNwQztBQUNBLFFBQVEsSUFBSSxHQUFHLEVBQUU7QUFDakIsVUFBVSxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDeEIsVUFBVSxPQUFPO0FBQ2pCLFNBQVM7QUFDVCxRQUFRLElBQUksR0FBRyxDQUFDLElBQUksS0FBSyxHQUFHLEVBQUU7QUFDOUIsVUFBVSxRQUFRLENBQUMsV0FBVyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7QUFDOUMsVUFBVSxPQUFPO0FBQ2pCLFNBQVM7QUFDVDtBQUNBLFFBQVEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxZQUFZLEVBQUU7QUFDL0IsVUFBVSxPQUFPLFFBQVEsRUFBRSxDQUFDO0FBQzVCLFNBQVM7QUFDVCxRQUFRLE9BQU8sR0FBRyxDQUFDLFlBQVksQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUM5QyxRQUFRLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtBQUN4RCxVQUFVLE9BQU8sR0FBRyxDQUFDLFlBQVksQ0FBQztBQUNsQyxTQUFTO0FBQ1QsUUFBUSxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxRQUFRLENBQUMsQ0FBQztBQUNoQyxPQUFPLENBQUMsQ0FBQztBQUNULEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNsQjtBQUNBLElBQUksSUFBSSxDQUFDLE1BQU0sR0FBRyxVQUFVLENBQUMsUUFBUSxFQUFFLFVBQVUsT0FBTyxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFO0FBQ3JGLE1BQU0sSUFBSSxHQUFHLENBQUM7QUFDZCxNQUFNLElBQUksT0FBTyxTQUFTLEtBQUssUUFBUSxFQUFFO0FBQ3pDO0FBQ0EsUUFBUSxHQUFHLEdBQUc7QUFDZCxVQUFVLEdBQUcsRUFBRSxPQUFPO0FBQ3RCLFVBQVUsSUFBSSxFQUFFLFNBQVM7QUFDekIsU0FBUyxDQUFDO0FBQ1YsUUFBUSxJQUFJLE9BQU8sSUFBSSxLQUFLLFVBQVUsRUFBRTtBQUN4QyxVQUFVLFFBQVEsR0FBRyxJQUFJLENBQUM7QUFDMUIsVUFBVSxJQUFJLEdBQUcsRUFBRSxDQUFDO0FBQ3BCLFNBQVM7QUFDVCxPQUFPLE1BQU07QUFDYjtBQUNBLFFBQVEsR0FBRyxHQUFHLE9BQU8sQ0FBQztBQUN0QixRQUFRLElBQUksT0FBTyxTQUFTLEtBQUssVUFBVSxFQUFFO0FBQzdDLFVBQVUsUUFBUSxHQUFHLFNBQVMsQ0FBQztBQUMvQixVQUFVLElBQUksR0FBRyxFQUFFLENBQUM7QUFDcEIsU0FBUyxNQUFNO0FBQ2YsVUFBVSxRQUFRLEdBQUcsSUFBSSxDQUFDO0FBQzFCLFVBQVUsSUFBSSxHQUFHLFNBQVMsQ0FBQztBQUMzQixTQUFTO0FBQ1QsT0FBTztBQUNQLE1BQU0sSUFBSSxHQUFHLElBQUksSUFBSSxFQUFFLENBQUM7QUFDeEIsTUFBTSxJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQztBQUM3QixNQUFNLElBQUksTUFBTSxHQUFHLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxHQUFHLEdBQUcsQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDaEUsTUFBTSxNQUFNLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQztBQUM3QixNQUFNLElBQUksU0FBUyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxPQUFPLElBQUksQ0FBQyxZQUFZLEtBQUssVUFBVSxFQUFFO0FBQzVFLFFBQVEsT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUcsRUFBRSxRQUFRLENBQUMsQ0FBQztBQUNoRCxPQUFPO0FBQ1AsTUFBTSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsU0FBUyxDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUM3RSxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDbEI7QUFDQSxJQUFJLElBQUksQ0FBQyxRQUFRLEdBQUcsVUFBVSxDQUFDLFVBQVUsRUFBRSxVQUFVLEdBQUcsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFO0FBQzFFLE1BQU0sSUFBSSxPQUFPLElBQUksS0FBSyxVQUFVLEVBQUU7QUFDdEMsUUFBUSxRQUFRLEdBQUcsSUFBSSxDQUFDO0FBQ3hCLFFBQVEsSUFBSSxHQUFHLEVBQUUsQ0FBQztBQUNsQixPQUFPO0FBQ1AsTUFBTSxJQUFJLEdBQUcsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ2pDO0FBQ0EsTUFBTSxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRTtBQUN2QixRQUFRLE9BQU8sUUFBUSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQztBQUNsQyxPQUFPO0FBQ1A7QUFDQSxNQUFNLElBQUksS0FBSyxHQUFHLENBQUMsQ0FBQztBQUNwQixNQUFNLElBQUksT0FBTyxHQUFHLElBQUksR0FBRyxFQUFFLENBQUM7QUFDOUI7QUFDQSxNQUFNLFNBQVMsWUFBWSxDQUFDLEVBQUUsRUFBRSxLQUFLLEVBQUU7QUFDdkMsUUFBUSxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRTtBQUM5QixVQUFVLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDekMsU0FBUztBQUNULFFBQVEsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQzVDLE9BQU87QUFDUDtBQUNBLE1BQU0sU0FBUyxVQUFVLENBQUMsRUFBRSxFQUFFLFFBQVEsRUFBRTtBQUN4QztBQUNBLFFBQVEsSUFBSSxZQUFZLEdBQUcsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM1QyxRQUFRLGVBQWUsQ0FBQyxRQUFRLEVBQUUsVUFBVSxNQUFNLEVBQUUsR0FBRyxFQUFFLE9BQU8sRUFBRSxHQUFHO0FBQ3JFLFVBQVUsSUFBSSxFQUFFO0FBQ2hCLFlBQVksSUFBSSxHQUFHLEdBQUcsR0FBRyxHQUFHLEdBQUcsR0FBRyxPQUFPLENBQUM7QUFDMUMsWUFBWSxJQUFJLEdBQUcsR0FBRyxZQUFZLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ2hELFlBQVksSUFBSSxHQUFHLEtBQUssQ0FBQyxDQUFDLEVBQUU7QUFDNUIsY0FBYyxPQUFPO0FBQ3JCLGFBQWE7QUFDYjtBQUNBLFlBQVksWUFBWSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDeEM7QUFDQSxZQUFZLElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxXQUFXLEVBQUU7QUFDN0MsY0FBYyxZQUFZLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQ3BDLGFBQWE7QUFDYixXQUFXLENBQUMsQ0FBQztBQUNiO0FBQ0E7QUFDQTtBQUNBLFFBQVEsWUFBWSxDQUFDLE9BQU8sQ0FBQyxVQUFVLEdBQUcsRUFBRTtBQUM1QyxVQUFVLFlBQVksQ0FBQyxFQUFFLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDaEMsU0FBUyxDQUFDLENBQUM7QUFDWCxPQUFPO0FBQ1A7QUFDQSxNQUFNLEdBQUcsQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLEVBQUU7QUFDNUIsUUFBUSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxFQUFFLFVBQVUsR0FBRyxFQUFFLFFBQVEsRUFBRTtBQUMzRCxVQUFVLElBQUksR0FBRyxJQUFJLEdBQUcsQ0FBQyxNQUFNLEtBQUssR0FBRyxJQUFJLEdBQUcsQ0FBQyxPQUFPLEtBQUssU0FBUyxFQUFFO0FBQ3RFLFlBQVksT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNoRCxXQUFXLE1BQU0sSUFBSSxHQUFHLEVBQUU7QUFDMUI7QUFDQSxZQUFZLE9BQU8sUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ2pDLFdBQVcsTUFBTTtBQUNqQixZQUFZLFVBQVUsQ0FBQyxFQUFFLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDckMsV0FBVztBQUNYO0FBQ0EsVUFBVSxJQUFJLEVBQUUsS0FBSyxLQUFLLEdBQUcsQ0FBQyxNQUFNLEVBQUU7QUFDdEM7QUFDQSxZQUFZLElBQUksVUFBVSxHQUFHLEVBQUUsQ0FBQztBQUNoQyxZQUFZLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBVSxLQUFLLEVBQUUsR0FBRyxFQUFFO0FBQ2xELGNBQWMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEtBQUssQ0FBQztBQUN0QyxhQUFhLENBQUMsQ0FBQztBQUNmLFlBQVksT0FBTyxRQUFRLENBQUMsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO0FBQzlDLFdBQVc7QUFDWCxTQUFTLENBQUMsQ0FBQztBQUNYLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQztBQUNmLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNsQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBSSxJQUFJLENBQUMsT0FBTyxHQUFHLFVBQVUsQ0FBQyxTQUFTLEVBQUUsVUFBVSxJQUFJLEVBQUUsUUFBUSxFQUFFO0FBQ25FLE1BQU1DLE9BQVcsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0FBQ3hDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNsQjtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUksSUFBSSxDQUFDLGVBQWUsR0FBRyxVQUFVLENBQUMsaUJBQWlCLEVBQUUsVUFBVSxLQUFLLEVBQUUsU0FBUyxFQUFFLFFBQVEsRUFBRTtBQUMvRixNQUFNLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxHQUFHLEVBQUUsT0FBTyxLQUFLO0FBQ3JEO0FBQ0EsUUFBUSxJQUFJLEdBQUcsRUFBRTtBQUNqQixVQUFVLE9BQU8sUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQy9CLFNBQVM7QUFDVCxRQUFRLElBQUksTUFBTSxHQUFHLGFBQWEsQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUM1QyxRQUFRLElBQUksVUFBVSxHQUFHLEVBQUUsQ0FBQztBQUM1QixRQUFRLElBQUksSUFBSSxHQUFHLEVBQUUsQ0FBQztBQUN0QixRQUFRLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQVUsR0FBRyxFQUFFO0FBQ25ELFVBQVUsSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsU0FBUyxFQUFFO0FBQ3ZDLFlBQVksVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUNqQyxXQUFXO0FBQ1gsU0FBUyxDQUFDLENBQUM7QUFDWDtBQUNBLFFBQVEsZUFBZSxDQUFDLE9BQU8sRUFBRSxVQUFVLE1BQU0sRUFBRSxHQUFHLEVBQUUsT0FBTyxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUU7QUFDNUUsVUFBVSxJQUFJLEdBQUcsR0FBRyxHQUFHLEdBQUcsR0FBRyxHQUFHLE9BQU8sQ0FBQztBQUN4QyxVQUFVLElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxXQUFXLElBQUksVUFBVSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRTtBQUM3RSxZQUFZLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDM0IsV0FBVztBQUNYLFNBQVMsQ0FBQyxDQUFDO0FBQ1gsUUFBUSxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDbEQsT0FBTyxDQUFDLENBQUM7QUFDVCxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDbEI7QUFDQTtBQUNBO0FBQ0EsSUFBSSxJQUFJLENBQUMsT0FBTyxHQUFHLFVBQVUsQ0FBQyxTQUFTLEVBQUUsVUFBVSxJQUFJLEVBQUUsUUFBUSxFQUFFO0FBQ25FLE1BQU0sSUFBSSxPQUFPLElBQUksS0FBSyxVQUFVLEVBQUU7QUFDdEMsUUFBUSxRQUFRLEdBQUcsSUFBSSxDQUFDO0FBQ3hCLFFBQVEsSUFBSSxHQUFHLEVBQUUsQ0FBQztBQUNsQixPQUFPO0FBQ1A7QUFDQSxNQUFNLElBQUksR0FBRyxJQUFJLElBQUksRUFBRSxDQUFDO0FBQ3hCO0FBQ0EsTUFBTSxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixJQUFJLEVBQUUsQ0FBQztBQUMxRCxNQUFNLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBQ25FLE1BQU0sSUFBSSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtBQUM5QyxRQUFRLGdCQUFnQixDQUFDLElBQUksQ0FBQyxDQUFDO0FBQy9CLE9BQU87QUFDUCxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDbEI7QUFDQTtBQUNBLElBQUksSUFBSSxDQUFDLEdBQUcsR0FBRyxVQUFVLENBQUMsS0FBSyxFQUFFLFVBQVUsRUFBRSxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUU7QUFDekQsTUFBTSxJQUFJLE9BQU8sSUFBSSxLQUFLLFVBQVUsRUFBRTtBQUN0QyxRQUFRLEVBQUUsR0FBRyxJQUFJLENBQUM7QUFDbEIsUUFBUSxJQUFJLEdBQUcsRUFBRSxDQUFDO0FBQ2xCLE9BQU87QUFDUCxNQUFNLElBQUksT0FBTyxFQUFFLEtBQUssUUFBUSxFQUFFO0FBQ2xDLFFBQVEsT0FBTyxFQUFFLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7QUFDM0MsT0FBTztBQUNQLE1BQU0sSUFBSSxTQUFTLENBQUMsRUFBRSxDQUFDLElBQUksT0FBTyxJQUFJLENBQUMsU0FBUyxLQUFLLFVBQVUsRUFBRTtBQUNqRSxRQUFRLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFDdEMsT0FBTztBQUNQLE1BQU0sSUFBSSxNQUFNLEdBQUcsRUFBRSxDQUFDO0FBQ3RCO0FBQ0EsTUFBTSxNQUFNLGNBQWMsR0FBRyxNQUFNO0FBQ25DLFFBQVEsSUFBSSxNQUFNLEdBQUcsRUFBRSxDQUFDO0FBQ3hCLFFBQVEsSUFBSSxLQUFLLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQztBQUNsQztBQUNBLFFBQVEsSUFBSSxDQUFDLEtBQUssRUFBRTtBQUNwQixVQUFVLE9BQU8sRUFBRSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztBQUNsQyxTQUFTO0FBQ1Q7QUFDQTtBQUNBLFFBQVEsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksS0FBSztBQUNqQyxVQUFVLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFO0FBQ3ZCLFlBQVksR0FBRyxFQUFFLElBQUk7QUFDckIsWUFBWSxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7QUFDM0IsWUFBWSxNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU07QUFDL0IsWUFBWSxXQUFXLEVBQUUsSUFBSSxDQUFDLFdBQVc7QUFDekMsWUFBWSxNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU07QUFDL0IsV0FBVyxFQUFFLFVBQVUsR0FBRyxFQUFFLEdBQUcsRUFBRTtBQUNqQyxZQUFZLElBQUksQ0FBQyxHQUFHLEVBQUU7QUFDdEI7QUFDQSxjQUFjLElBQUksUUFBUSxDQUFDO0FBQzNCLGNBQWMsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRTtBQUM3RCxnQkFBZ0IsSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxLQUFLLEdBQUcsQ0FBQyxJQUFJLEVBQUU7QUFDcEUsa0JBQWtCLFFBQVEsR0FBRyxJQUFJLENBQUM7QUFDbEMsa0JBQWtCLE1BQU07QUFDeEIsaUJBQWlCO0FBQ2pCLGVBQWU7QUFDZixjQUFjLElBQUksQ0FBQyxRQUFRLEVBQUU7QUFDN0IsZ0JBQWdCLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUN2QyxlQUFlO0FBQ2YsYUFBYSxNQUFNO0FBQ25CLGNBQWMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQzNDLGFBQWE7QUFDYixZQUFZLEtBQUssRUFBRSxDQUFDO0FBQ3BCLFlBQVksSUFBSSxDQUFDLEtBQUssRUFBRTtBQUN4QixjQUFjLEVBQUUsQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFDL0IsYUFBYTtBQUNiLFdBQVcsQ0FBQyxDQUFDO0FBQ2IsU0FBUyxDQUFDLENBQUM7QUFDWCxPQUFPLENBQUM7QUFDUjtBQUNBLE1BQU0sSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFO0FBQzFCLFFBQVEsSUFBSSxJQUFJLENBQUMsU0FBUyxLQUFLLEtBQUssRUFBRTtBQUN0QyxVQUFVLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLEVBQUUsVUFBVSxHQUFHLEVBQUUsUUFBUSxFQUFFO0FBQzdEO0FBQ0EsWUFBWSxJQUFJLEdBQUcsRUFBRTtBQUNyQixjQUFjLE9BQU8sRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQzdCLGFBQWE7QUFDYixZQUFZLE1BQU0sR0FBRyxhQUFhLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxDQUFDLFVBQVUsSUFBSSxFQUFFO0FBQ2pFLGNBQWMsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDO0FBQzlCLGFBQWEsQ0FBQyxDQUFDO0FBQ2YsWUFBWSxjQUFjLEVBQUUsQ0FBQztBQUM3QixXQUFXLENBQUMsQ0FBQztBQUNiLFNBQVMsTUFBTTtBQUNmLFVBQVUsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRTtBQUM3QyxZQUFZLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO0FBQ3BDLFlBQVksS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7QUFDcEQsY0FBYyxJQUFJLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDaEM7QUFDQSxjQUFjLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQyxLQUFLLFFBQVEsSUFBSSxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7QUFDakUsZ0JBQWdCLE9BQU8sRUFBRSxDQUFDLFdBQVcsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO0FBQ3BELGVBQWU7QUFDZixhQUFhO0FBQ2IsWUFBWSxjQUFjLEVBQUUsQ0FBQztBQUM3QixXQUFXLE1BQU07QUFDakIsWUFBWSxPQUFPLEVBQUUsQ0FBQyxXQUFXLENBQUMsYUFBYSxFQUFFLGlCQUFpQixDQUFDLENBQUMsQ0FBQztBQUNyRSxXQUFXO0FBQ1gsU0FBUztBQUNULFFBQVEsT0FBTztBQUNmLE9BQU87QUFDUDtBQUNBLE1BQU0sT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBRSxJQUFJLEVBQUUsQ0FBQyxHQUFHLEVBQUUsTUFBTSxLQUFLO0FBQ2xELFFBQVEsSUFBSSxHQUFHLEVBQUU7QUFDakIsVUFBVSxHQUFHLENBQUMsS0FBSyxHQUFHLEVBQUUsQ0FBQztBQUN6QixVQUFVLE9BQU8sRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3pCLFNBQVM7QUFDVDtBQUNBLFFBQVEsSUFBSSxHQUFHLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQztBQUM3QixRQUFRLElBQUksUUFBUSxHQUFHLE1BQU0sQ0FBQyxRQUFRLENBQUM7QUFDdkMsUUFBUSxJQUFJLEdBQUcsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDO0FBQzdCO0FBQ0EsUUFBUSxJQUFJLElBQUksQ0FBQyxTQUFTLEVBQUU7QUFDNUIsVUFBVSxJQUFJLFNBQVMsR0FBRyxnQkFBZ0IsQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUNyRCxVQUFVLElBQUksU0FBUyxDQUFDLE1BQU0sRUFBRTtBQUNoQyxZQUFZLEdBQUcsQ0FBQyxVQUFVLEdBQUcsU0FBUyxDQUFDO0FBQ3ZDLFdBQVc7QUFDWCxTQUFTO0FBQ1Q7QUFDQSxRQUFRLElBQUksU0FBUyxDQUFDLFFBQVEsRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUU7QUFDM0MsVUFBVSxHQUFHLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQztBQUM5QixTQUFTO0FBQ1Q7QUFDQSxRQUFRLElBQUksSUFBSSxDQUFDLElBQUksSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFO0FBQ3pDLFVBQVUsSUFBSSxXQUFXLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDaEQsVUFBVSxJQUFJLEtBQUssU0FBUyxRQUFRLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0FBQ3pELFVBQVUsSUFBSSxPQUFPLE9BQU8sV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzNDO0FBQ0EsVUFBVSxJQUFJLEtBQUssR0FBRyxVQUFVLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQ3BELFVBQVUsSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDO0FBQzFCO0FBQ0EsVUFBVSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtBQUNqRCxZQUFZLElBQUksV0FBVyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN2QyxZQUFZLElBQUksU0FBUyxHQUFHLFdBQVcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUFFLEVBQUUsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQztBQUM5RSxlQUFlLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUNoQyxZQUFZLElBQUksaUJBQWlCLEdBQUcsU0FBUyxNQUFNLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQztBQUM5RDtBQUNBLFlBQVksSUFBSSxpQkFBaUIsS0FBSyxDQUFDLElBQUksSUFBSSxTQUFTLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRTtBQUNsRSxjQUFjLElBQUksR0FBRyxXQUFXLENBQUM7QUFDakMsYUFBYTtBQUNiLFdBQVc7QUFDWDtBQUNBO0FBQ0EsVUFBVSxJQUFJLENBQUMsSUFBSSxFQUFFO0FBQ3JCLFlBQVksR0FBRyxHQUFHLElBQUksS0FBSyxDQUFDLGtCQUFrQixDQUFDLENBQUM7QUFDaEQsWUFBWSxHQUFHLENBQUMsS0FBSyxHQUFHLEVBQUUsQ0FBQztBQUMzQixZQUFZLE9BQU8sRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQzNCLFdBQVc7QUFDWDtBQUNBLFVBQVUsSUFBSSxVQUFVLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLEVBQUUsRUFBRSxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDO0FBQ3RFLGFBQWEsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ2pELFVBQVUsSUFBSSxPQUFPLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEdBQUcsVUFBVSxDQUFDO0FBQ3JELFVBQVUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsVUFBVSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQy9DLFVBQVUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUM3QjtBQUNBLFVBQVUsSUFBSSxJQUFJLENBQUMsSUFBSSxFQUFFO0FBQ3pCLFlBQVksR0FBRyxDQUFDLFVBQVUsR0FBRztBQUM3QixjQUFjLEtBQUssRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLElBQUksQ0FBQztBQUNyRCxjQUFjLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxVQUFVLEdBQUcsRUFBRTtBQUMvQyxnQkFBZ0IsT0FBTyxHQUFHLENBQUMsRUFBRSxDQUFDO0FBQzlCLGVBQWUsQ0FBQztBQUNoQixhQUFhLENBQUM7QUFDZCxXQUFXO0FBQ1gsVUFBVSxJQUFJLElBQUksQ0FBQyxTQUFTLEVBQUU7QUFDOUIsWUFBWSxJQUFJLEdBQUcsSUFBSSxJQUFJLENBQUMsR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDO0FBQ2xELFlBQVksR0FBRyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxVQUFVLEdBQUcsRUFBRTtBQUN6RCxjQUFjLEdBQUcsRUFBRSxDQUFDO0FBQ3BCLGNBQWMsT0FBTztBQUNyQixnQkFBZ0IsR0FBRyxFQUFFLEdBQUcsR0FBRyxHQUFHLEdBQUcsR0FBRyxDQUFDLEVBQUU7QUFDdkMsZ0JBQWdCLE1BQU0sRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU07QUFDdkMsZUFBZSxDQUFDO0FBQ2hCLGFBQWEsQ0FBQyxDQUFDO0FBQ2YsV0FBVztBQUNYLFNBQVM7QUFDVDtBQUNBLFFBQVEsSUFBSSxJQUFJLENBQUMsV0FBVyxJQUFJLEdBQUcsQ0FBQyxZQUFZLEVBQUU7QUFDbEQsVUFBVSxJQUFJLFdBQVcsR0FBRyxHQUFHLENBQUMsWUFBWSxDQUFDO0FBQzdDLFVBQVUsSUFBSSxLQUFLLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxNQUFNLENBQUM7QUFDdEQsVUFBVSxJQUFJLEtBQUssS0FBSyxDQUFDLEVBQUU7QUFDM0IsWUFBWSxPQUFPLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDakMsV0FBVztBQUNYLFVBQVUsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxHQUFHLEtBQUs7QUFDcEQsWUFBWSxJQUFJLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLFdBQVcsQ0FBQyxHQUFHLENBQUMsRUFBRTtBQUNoRTtBQUNBO0FBQ0E7QUFDQSxjQUFjLEdBQUcsRUFBRSxHQUFHLENBQUMsSUFBSTtBQUMzQixjQUFjLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTTtBQUNqQyxjQUFjLEdBQUcsRUFBRSxHQUFHO0FBQ3RCLGFBQWEsRUFBRSxVQUFVLEdBQUcsRUFBRSxJQUFJLEVBQUU7QUFDcEMsY0FBYyxJQUFJLEdBQUcsR0FBRyxHQUFHLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQzlDLGNBQWMsR0FBRyxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7QUFDOUIsY0FBYyxPQUFPLEdBQUcsQ0FBQyxJQUFJLENBQUM7QUFDOUIsY0FBYyxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUM7QUFDaEMsY0FBYyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUU7QUFDNUIsZ0JBQWdCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDOUIsZUFBZTtBQUNmLGFBQWEsQ0FBQyxDQUFDO0FBQ2YsV0FBVyxDQUFDLENBQUM7QUFDYixTQUFTLE1BQU07QUFDZixVQUFVLElBQUksR0FBRyxDQUFDLFlBQVksRUFBRTtBQUNoQyxZQUFZLEtBQUssSUFBSSxHQUFHLElBQUksR0FBRyxDQUFDLFlBQVksRUFBRTtBQUM5QztBQUNBLGNBQWMsSUFBSSxNQUFNLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFlBQVksRUFBRSxHQUFHLENBQUMsRUFBRTtBQUMvRSxnQkFBZ0IsR0FBRyxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO0FBQ2xELGVBQWU7QUFDZixhQUFhO0FBQ2IsV0FBVztBQUNYLFVBQVUsRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztBQUN4QixTQUFTO0FBQ1QsT0FBTyxDQUFDLENBQUM7QUFDVCxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDbEI7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFJLElBQUksQ0FBQyxhQUFhLEdBQUcsVUFBVSxDQUFDLGVBQWUsRUFBRSxVQUFVLEtBQUssRUFBRSxZQUFZLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRTtBQUNwRyxNQUFNLElBQUksSUFBSSxZQUFZLFFBQVEsRUFBRTtBQUNwQyxRQUFRLFFBQVEsR0FBRyxJQUFJLENBQUM7QUFDeEIsUUFBUSxJQUFJLEdBQUcsRUFBRSxDQUFDO0FBQ2xCLE9BQU87QUFDUCxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEtBQUs7QUFDM0MsUUFBUSxJQUFJLEdBQUcsRUFBRTtBQUNqQixVQUFVLE9BQU8sUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQy9CLFNBQVM7QUFDVCxRQUFRLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxZQUFZLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsWUFBWSxDQUFDLEVBQUU7QUFDeEUsVUFBVSxJQUFJLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUM7QUFDN0IsVUFBVSxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQztBQUM3QixVQUFVLElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxFQUFFLFlBQVk7QUFDakQsOEJBQThCLEdBQUcsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLFlBQVksQ0FBQyxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQztBQUNsRixTQUFTLE1BQU07QUFDZixVQUFVLE9BQU8sUUFBUSxDQUFDLFdBQVcsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO0FBQ3BELFNBQVM7QUFDVCxPQUFPLENBQUMsQ0FBQztBQUNULEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNsQjtBQUNBLElBQUksSUFBSSxDQUFDLE9BQU8sR0FBRyxVQUFVLENBQUMsU0FBUyxFQUFFLFVBQVUsSUFBSSxFQUFFLFFBQVEsRUFBRTtBQUNuRSxNQUFNLElBQUksT0FBTyxJQUFJLEtBQUssVUFBVSxFQUFFO0FBQ3RDLFFBQVEsUUFBUSxHQUFHLElBQUksQ0FBQztBQUN4QixRQUFRLElBQUksR0FBRyxFQUFFLENBQUM7QUFDbEIsT0FBTztBQUNQLE1BQU0sSUFBSSxDQUFDLElBQUksR0FBRyxPQUFPLElBQUksQ0FBQyxJQUFJLEtBQUssV0FBVyxHQUFHLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDO0FBQ25FLE1BQU0sSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFO0FBQzFCLFFBQVEsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO0FBQ3ZDLE9BQU87QUFDUCxNQUFNLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRTtBQUN4QixRQUFRLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQztBQUNuQyxPQUFPO0FBQ1AsTUFBTSxJQUFJLE1BQU0sSUFBSSxJQUFJLEVBQUU7QUFDMUIsUUFBUSxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUU7QUFDdkMsVUFBVSxPQUFPLFFBQVEsQ0FBQyxJQUFJLFNBQVMsQ0FBQywrQkFBK0IsQ0FBQyxDQUFDLENBQUM7QUFDMUUsU0FBUztBQUNULFFBQVEsSUFBSSxlQUFlO0FBQzNCLFVBQVUsQ0FBQyxVQUFVLEVBQUUsUUFBUSxFQUFFLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxVQUFVLGVBQWUsRUFBRTtBQUMxRSxVQUFVLE9BQU8sZUFBZSxJQUFJLElBQUksQ0FBQztBQUN6QyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNkLFFBQVEsSUFBSSxlQUFlLEVBQUU7QUFDN0IsVUFBVSxRQUFRLENBQUMsV0FBVyxDQUFDLGlCQUFpQjtBQUNoRCxZQUFZLG1CQUFtQixHQUFHLGVBQWU7QUFDakQsWUFBWSxvQ0FBb0M7QUFDaEQsV0FBVyxDQUFDLENBQUM7QUFDYixVQUFVLE9BQU87QUFDakIsU0FBUztBQUNULFFBQVEsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRTtBQUM3QixVQUFVLGdCQUFnQixDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ2pDLFVBQVUsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7QUFDdEMsWUFBWSxPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDdkQsV0FBVztBQUNYLFNBQVM7QUFDVCxPQUFPO0FBQ1A7QUFDQSxNQUFNLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDM0MsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ2xCO0FBQ0EsSUFBSSxJQUFJLENBQUMsS0FBSyxHQUFHLFVBQVUsQ0FBQyxPQUFPLEVBQUUsVUFBVSxRQUFRLEVBQUU7QUFDekQsTUFBTSxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQztBQUMxQixNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDMUIsTUFBTSxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDbkMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ2xCO0FBQ0EsSUFBSSxJQUFJLENBQUMsSUFBSSxHQUFHLFVBQVUsQ0FBQyxNQUFNLEVBQUUsVUFBVSxRQUFRLEVBQUU7QUFDdkQsTUFBTSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxFQUFFLElBQUksS0FBSztBQUNoQyxRQUFRLElBQUksR0FBRyxFQUFFO0FBQ2pCLFVBQVUsT0FBTyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDL0IsU0FBUztBQUNUO0FBQ0EsUUFBUSxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQztBQUNqRCxRQUFRLElBQUksQ0FBQyxlQUFlLEdBQUcsQ0FBQyxFQUFFLElBQUksQ0FBQyxlQUFlLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztBQUMzRSxRQUFRLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQztBQUNwQyxRQUFRLFFBQVEsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDN0IsT0FBTyxDQUFDLENBQUM7QUFDVCxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDbEI7QUFDQSxJQUFJLElBQUksQ0FBQyxFQUFFLEdBQUcsVUFBVSxDQUFDLElBQUksRUFBRSxVQUFVLFFBQVEsRUFBRTtBQUNuRCxNQUFNLE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUNoQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDbEI7QUFDQSxJQUFJLElBQUksQ0FBQyxRQUFRLEdBQUcsVUFBVSxDQUFDLFVBQVUsRUFBRSxVQUFVLEdBQUcsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFO0FBQzFFLE1BQU0sSUFBSSxPQUFPLElBQUksS0FBSyxVQUFVLEVBQUU7QUFDdEMsUUFBUSxRQUFRLEdBQUcsSUFBSSxDQUFDO0FBQ3hCLFFBQVEsSUFBSSxHQUFHLEVBQUUsQ0FBQztBQUNsQixPQUFPO0FBQ1A7QUFDQSxNQUFNLElBQUksR0FBRyxJQUFJLElBQUksRUFBRSxDQUFDO0FBQ3hCO0FBQ0EsTUFBTSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUU7QUFDOUIsUUFBUSxHQUFHLEdBQUc7QUFDZCxVQUFVLElBQUksRUFBRSxHQUFHO0FBQ25CLFNBQVMsQ0FBQztBQUNWLE9BQU87QUFDUDtBQUNBLE1BQU0sSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRTtBQUN6RCxRQUFRLE9BQU8sUUFBUSxDQUFDLFdBQVcsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUM7QUFDeEQsT0FBTztBQUNQO0FBQ0EsTUFBTSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLEVBQUU7QUFDaEQsUUFBUSxJQUFJLE9BQU8sR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxRQUFRLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7QUFDM0UsVUFBVSxPQUFPLFFBQVEsQ0FBQyxXQUFXLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQztBQUN0RCxTQUFTO0FBQ1QsT0FBTztBQUNQO0FBQ0EsTUFBTSxJQUFJLGVBQWUsQ0FBQztBQUMxQixNQUFNLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsR0FBRyxFQUFFO0FBQ3RDLFFBQVEsSUFBSSxHQUFHLENBQUMsWUFBWSxFQUFFO0FBQzlCLFVBQVUsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQVUsSUFBSSxFQUFFO0FBQ2hFLFlBQVksZUFBZSxHQUFHLGVBQWUsSUFBSSxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUMzRSxZQUFZLElBQUksQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDLFlBQVksRUFBRTtBQUN0RCxjQUFjLGNBQWMsQ0FBQyxNQUFNLEVBQUUsWUFBWSxFQUFFLElBQUksRUFBRSxhQUFhLEVBQUUsR0FBRyxDQUFDLEdBQUcsRUFBRSx5QkFBeUIsQ0FBQyxDQUFDO0FBQzVHLGFBQWE7QUFDYixXQUFXLENBQUMsQ0FBQztBQUNiLFNBQVM7QUFDVCxPQUFPLENBQUMsQ0FBQztBQUNUO0FBQ0EsTUFBTSxJQUFJLGVBQWUsRUFBRTtBQUMzQixRQUFRLE9BQU8sUUFBUSxDQUFDLFdBQVcsQ0FBQyxXQUFXLEVBQUUsZUFBZSxDQUFDLENBQUMsQ0FBQztBQUNuRSxPQUFPO0FBQ1A7QUFDQSxNQUFNLElBQUksRUFBRSxXQUFXLElBQUksSUFBSSxDQUFDLEVBQUU7QUFDbEMsUUFBUSxJQUFJLFdBQVcsSUFBSSxHQUFHLEVBQUU7QUFDaEMsVUFBVSxJQUFJLENBQUMsU0FBUyxHQUFHLEdBQUcsQ0FBQyxTQUFTLENBQUM7QUFDekMsU0FBUyxNQUFNO0FBQ2YsVUFBVSxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQztBQUNoQyxTQUFTO0FBQ1QsT0FBTztBQUNQO0FBQ0EsTUFBTSxJQUFJLE9BQU8sR0FBRyxJQUFJLENBQUM7QUFDekIsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRTtBQUNqRDtBQUNBO0FBQ0EsUUFBUSxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0FBQzFDLE9BQU87QUFDUDtBQUNBLE1BQU0sU0FBUyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU0sSUFBSSxHQUFHLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsVUFBVSxHQUFHLEVBQUU7QUFDNUMsUUFBUSxPQUFPLEdBQUcsQ0FBQyxHQUFHLENBQUM7QUFDdkIsT0FBTyxDQUFDLENBQUM7QUFDVDtBQUNBLE1BQU0sSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLFVBQVUsR0FBRyxFQUFFLEdBQUcsRUFBRTtBQUNwRCxRQUFRLElBQUksR0FBRyxFQUFFO0FBQ2pCLFVBQVUsT0FBTyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDL0IsU0FBUztBQUNULFFBQVEsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUU7QUFDN0I7QUFDQSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxFQUFFO0FBQ3hDLFlBQVksT0FBTyxDQUFDLENBQUMsS0FBSyxDQUFDO0FBQzNCLFdBQVcsQ0FBQyxDQUFDO0FBQ2IsU0FBUztBQUNUO0FBQ0EsUUFBUSxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFO0FBQ2hDLFVBQVUsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRTtBQUN0RCxZQUFZLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDNUMsV0FBVztBQUNYLFNBQVM7QUFDVDtBQUNBLFFBQVEsUUFBUSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztBQUM1QixPQUFPLENBQUMsQ0FBQztBQUNULEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNsQjtBQUNBLElBQUksSUFBSSxDQUFDLHlCQUF5QixHQUFHLFVBQVUsQ0FBQywyQkFBMkIsRUFBRSxVQUFVLFdBQVcsRUFBRSxRQUFRLEVBQUU7QUFDOUcsTUFBTSxJQUFJLFNBQVMsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ3pDLE1BQU0sSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLFlBQVksRUFBRTtBQUNwQyxRQUFRLFNBQVMsQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUM7QUFDckQsT0FBTztBQUNQO0FBQ0EsTUFBTSxJQUFJLEtBQUssR0FBRyxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsV0FBVyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0FBQy9EO0FBQ0EsTUFBTSxTQUFTLE9BQU8sQ0FBQyxHQUFHLEVBQUU7QUFDNUIsUUFBUSxHQUFHLENBQUMsWUFBWSxHQUFHLEdBQUcsQ0FBQyxZQUFZLElBQUksRUFBRSxDQUFDO0FBQ2xELFFBQVEsSUFBSSxHQUFHLENBQUMsWUFBWSxDQUFDLFdBQVcsQ0FBQyxFQUFFO0FBQzNDLFVBQVUsT0FBTyxLQUFLLENBQUM7QUFDdkIsU0FBUztBQUNULFFBQVEsR0FBRyxDQUFDLFlBQVksQ0FBQyxXQUFXLENBQUMsR0FBRyxJQUFJLENBQUM7QUFDN0MsUUFBUSxPQUFPLEdBQUcsQ0FBQztBQUNuQixPQUFPO0FBQ1AsTUFBTSxNQUFNLENBQUMsSUFBSSxFQUFFLDRCQUE0QixFQUFFLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxZQUFZO0FBQzNFLFFBQVEsUUFBUSxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDO0FBQ3BDLE9BQU8sQ0FBQyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUN6QixLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDbEI7QUFDQSxJQUFJLElBQUksQ0FBQyxPQUFPLEdBQUcsVUFBVSxDQUFDLFNBQVMsRUFBRSxVQUFVLElBQUksRUFBRSxRQUFRLEVBQUU7QUFDbkU7QUFDQSxNQUFNLElBQUksT0FBTyxJQUFJLEtBQUssVUFBVSxFQUFFO0FBQ3RDLFFBQVEsUUFBUSxHQUFHLElBQUksQ0FBQztBQUN4QixRQUFRLElBQUksR0FBRyxFQUFFLENBQUM7QUFDbEIsT0FBTztBQUNQO0FBQ0EsTUFBTSxJQUFJLFNBQVMsR0FBRyxZQUFZLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDO0FBQ3BFO0FBQ0EsTUFBTSxNQUFNLFNBQVMsR0FBRyxNQUFNO0FBQzlCO0FBQ0EsUUFBUSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxDQUFDLEdBQUcsRUFBRSxJQUFJLEtBQUs7QUFDM0MsVUFBVSxJQUFJLEdBQUcsRUFBRTtBQUNuQixZQUFZLE9BQU8sUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ2pDLFdBQVc7QUFDWCxVQUFVLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDO0FBQ2pDLFVBQVUsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUNqQyxVQUFVLFFBQVEsQ0FBQyxJQUFJLEVBQUUsSUFBSSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7QUFDakQsU0FBUyxDQUFDLENBQUM7QUFDWCxPQUFPLENBQUM7QUFDUjtBQUNBLE1BQU0sSUFBSSxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUU7QUFDMUI7QUFDQSxRQUFRLE9BQU8sU0FBUyxFQUFFLENBQUM7QUFDM0IsT0FBTztBQUNQO0FBQ0EsTUFBTSxJQUFJLENBQUMsR0FBRyxDQUFDLDRCQUE0QixFQUFFLENBQUMsR0FBRyxFQUFFLFFBQVEsS0FBSztBQUNoRSxRQUFRLElBQUksR0FBRyxFQUFFO0FBQ2pCO0FBQ0EsVUFBVSxJQUFJLEdBQUcsQ0FBQyxNQUFNLEtBQUssR0FBRyxFQUFFO0FBQ2xDLFlBQVksT0FBTyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDakMsV0FBVyxNQUFNO0FBQ2pCLFlBQVksT0FBTyxTQUFTLEVBQUUsQ0FBQztBQUMvQixXQUFXO0FBQ1gsU0FBUztBQUNULFFBQVEsSUFBSSxZQUFZLEdBQUcsUUFBUSxDQUFDLFlBQVksQ0FBQztBQUNqRCxRQUFRLElBQUksT0FBTyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUM7QUFDdkMsUUFBUSxJQUFJLFVBQVUsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksS0FBSztBQUNqRTtBQUNBO0FBQ0EsVUFBVSxJQUFJLFFBQVEsR0FBRyxTQUFTO0FBQ2xDLFlBQVksSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLE1BQU0sQ0FBQyxHQUFHLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQztBQUN0RSxVQUFVLE9BQU8sSUFBSSxPQUFPLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUM5RCxTQUFTLENBQUMsQ0FBQztBQUNYLFFBQVEsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0FBQzFELE9BQU8sQ0FBQyxDQUFDO0FBQ1QsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ2xCLEdBQUc7QUFDSDtBQUNBLEVBQUUsUUFBUSxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUU7QUFDM0IsSUFBSSxJQUFJLFdBQVcsR0FBRztBQUN0QixNQUFNLFdBQVcsRUFBRSxLQUFLO0FBQ3hCLE1BQU0sUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRLElBQUksQ0FBQztBQUNsQyxLQUFLLENBQUM7QUFDTixJQUFJLElBQUksUUFBUSxHQUFHLEVBQUUsQ0FBQztBQUN0QjtBQUNBLElBQUksSUFBSSxNQUFNLENBQUM7QUFDZixJQUFJLElBQUksYUFBYSxHQUFHLENBQUMsQ0FBQztBQUMxQjtBQUNBLElBQUksTUFBTSxRQUFRLEdBQUcsQ0FBQyxHQUFHLEtBQUs7QUFDOUIsTUFBTSxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUU7QUFDdEMsUUFBUSxlQUFlLEVBQUUsRUFBRSxhQUFhO0FBQ3hDLE9BQU8sQ0FBQyxDQUFDO0FBQ1QsTUFBTSxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3JELEtBQUssQ0FBQztBQUNOLElBQUksTUFBTSxPQUFPLEdBQUcsQ0FBQyxHQUFHLEtBQUs7QUFDN0IsTUFBTSxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDM0MsTUFBTSxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDcEIsS0FBSyxDQUFDO0FBQ04sSUFBSSxNQUFNLFVBQVUsR0FBRyxDQUFDLElBQUksS0FBSztBQUNqQyxNQUFNLElBQUksT0FBTyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUM7QUFDbEMsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNO0FBQ3ZDLFFBQVEsT0FBTyxNQUFNLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFLENBQUMsR0FBRyxLQUFLO0FBQzFELFVBQVUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLElBQUksR0FBRyxDQUFDLFFBQVEsR0FBRyxPQUFPLEVBQUU7QUFDdkQsWUFBWSxHQUFHLENBQUMsUUFBUSxHQUFHLE9BQU8sQ0FBQztBQUNuQyxZQUFZLE9BQU8sR0FBRyxDQUFDO0FBQ3ZCLFdBQVc7QUFDWCxVQUFVLE9BQU8sS0FBSyxDQUFDO0FBQ3ZCLFNBQVMsQ0FBQyxDQUFDO0FBQ1gsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU07QUFDcEIsUUFBUSxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUN4QyxRQUFRLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztBQUNuQyxPQUFPLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDeEIsS0FBSyxDQUFDO0FBQ047QUFDQSxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLEtBQUs7QUFDL0IsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUM7QUFDcEMsUUFBUSxJQUFJLEVBQUUscUJBQXFCO0FBQ25DLFFBQVEsV0FBVyxFQUFFLElBQUksQ0FBQyxVQUFVLEdBQUcsV0FBVyxDQUFDLFFBQVE7QUFDM0QsT0FBTyxDQUFDLENBQUM7QUFDVDtBQUNBLE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUM7QUFDL0IsU0FBUyxFQUFFLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQztBQUMvQixTQUFTLEVBQUUsQ0FBQyxVQUFVLEVBQUUsVUFBVSxDQUFDO0FBQ25DLFNBQVMsRUFBRSxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztBQUM5QixLQUFLLENBQUMsQ0FBQztBQUNQLEdBQUc7QUFDSDtBQUNBLEVBQUUsT0FBTyxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUU7QUFDMUIsSUFBSSxJQUFJLE9BQU8sSUFBSSxLQUFLLFVBQVUsRUFBRTtBQUNwQyxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUM7QUFDdEIsTUFBTSxJQUFJLEdBQUcsRUFBRSxDQUFDO0FBQ2hCLEtBQUs7QUFDTDtBQUNBLElBQUksSUFBSSxHQUFHLElBQUksSUFBSSxFQUFFLENBQUM7QUFDdEI7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFJLElBQUksQ0FBQyxXQUFXLEdBQUcsQ0FBQyxhQUFhLElBQUksSUFBSSxJQUFJLElBQUksQ0FBQyxXQUFXLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO0FBQy9FO0FBQ0EsSUFBSSxPQUFPLElBQUksT0FBTyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDN0MsR0FBRztBQUNIO0FBQ0EsRUFBRSxJQUFJLEdBQUc7QUFDVCxJQUFJLE9BQU8sQ0FBQyxPQUFPLElBQUksQ0FBQyxLQUFLLEtBQUssVUFBVSxJQUFJLElBQUksQ0FBQyxLQUFLLEVBQUUsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDO0FBQzVFLEdBQUc7QUFDSCxDQUFDO0FBQ0Q7QUFDQTtBQUNBO0FBQ0EsZUFBZSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEdBQUcsVUFBVSxDQUFDLFFBQVEsRUFBRSxVQUFVLEtBQUssRUFBRSxHQUFHLEVBQUUsUUFBUSxFQUFFO0FBQ3ZGLEVBQUUsSUFBSSxPQUFPLElBQUksQ0FBQyxNQUFNLEtBQUssV0FBVyxFQUFFO0FBQzFDLElBQUksT0FBTyxRQUFRLENBQUMsV0FBVyxDQUFDLGFBQWEsRUFBRSxrQ0FBa0MsR0FBRyxJQUFJLENBQUMsT0FBTyxHQUFHLFdBQVcsQ0FBQyxDQUFDLENBQUM7QUFDakgsR0FBRztBQUNILEVBQUUsSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDO0FBQ2xCO0FBQ0EsRUFBRSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxFQUFFLENBQUMsS0FBSyxFQUFFLElBQUksS0FBSztBQUNoRCxJQUFJLElBQUksS0FBSyxFQUFFO0FBQ2YsTUFBTSxPQUFPLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUM3QixLQUFLO0FBQ0wsSUFBSSxJQUFJLENBQUMsSUFBSSxFQUFFO0FBQ2YsTUFBTSxPQUFPLFFBQVEsQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztBQUNoRCxLQUFLO0FBQ0wsSUFBSSxJQUFJLElBQUksQ0FBQztBQUNiLElBQUksSUFBSTtBQUNSLE1BQU0sSUFBSSxHQUFHLGNBQWMsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDdkMsS0FBSyxDQUFDLE9BQU8sS0FBSyxFQUFFO0FBQ3BCLE1BQU0sT0FBTyxRQUFRLENBQUMsS0FBSyxDQUFDLE9BQU8sSUFBSSxLQUFLLENBQUMsQ0FBQztBQUM5QyxLQUFLO0FBQ0wsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsQ0FBQyxLQUFLLEVBQUUsTUFBTSxLQUFLO0FBQ2hELE1BQU0sSUFBSSxLQUFLLEVBQUU7QUFDakIsUUFBUSxPQUFPLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUMvQixPQUFPLE1BQU07QUFDYixRQUFRLGNBQWMsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxZQUFZO0FBQzFELFVBQVUsT0FBTyxRQUFRLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQ3hDLFNBQVMsQ0FBQyxDQUFDO0FBQ1gsT0FBTztBQUNQLEtBQUssQ0FBQyxDQUFDO0FBQ1AsR0FBRyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUM7O0FDaGdDYSxNQUFNLFNBQVMsQ0FBQztBQUMvQixFQUFFLFdBQVcsR0FBRztBQUNoQixJQUFJLElBQUksQ0FBQyxPQUFPLEdBQUcsS0FBSyxDQUFDO0FBQ3pCLElBQUksSUFBSSxDQUFDLE1BQU0sR0FBRyxLQUFLLENBQUM7QUFDeEIsSUFBSSxJQUFJLENBQUMsS0FBSyxHQUFHLEVBQUUsQ0FBQztBQUNwQixHQUFHO0FBQ0g7QUFDQSxFQUFFLE9BQU8sR0FBRztBQUNaLElBQUksSUFBSSxHQUFHLENBQUM7QUFDWixJQUFJLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtBQUNyQixNQUFNLFFBQVEsR0FBRyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFFLEdBQUc7QUFDekMsUUFBUSxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ3pCLE9BQU87QUFDUCxLQUFLLE1BQU07QUFDWCxNQUFNLFFBQVEsR0FBRyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFFLEdBQUc7QUFDekMsUUFBUSxHQUFHLEVBQUUsQ0FBQztBQUNkLE9BQU87QUFDUCxLQUFLO0FBQ0wsR0FBRztBQUNIO0FBQ0EsRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFO0FBQ1osSUFBSSxJQUFJLENBQUMsTUFBTSxHQUFHLEdBQUcsQ0FBQztBQUN0QixJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUNuQixHQUFHO0FBQ0g7QUFDQSxFQUFFLEtBQUssQ0FBQyxFQUFFLEVBQUU7QUFDWixJQUFJLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDO0FBQ3hCLElBQUksSUFBSSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUM7QUFDakIsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7QUFDbkIsR0FBRztBQUNIO0FBQ0EsRUFBRSxPQUFPLENBQUMsR0FBRyxFQUFFO0FBQ2YsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUN6QixJQUFJLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtBQUNyQixNQUFNLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUNyQixLQUFLO0FBQ0wsR0FBRztBQUNIOztBQ25DQSxNQUFNLGVBQWUsR0FBRyxDQUFDLE9BQU8sS0FBSyxTQUFTLFlBQVksQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFO0FBQ3ZFLEVBQUUsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO0FBQy9DLEVBQUUsSUFBSSxLQUFLLEVBQUU7QUFDYjtBQUNBLElBQUksT0FBTztBQUNYLE1BQU0sSUFBSSxFQUFFLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUssR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQztBQUM1RSxNQUFNLE9BQU8sRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDO0FBQ3ZCLEtBQUssQ0FBQztBQUNOLEdBQUc7QUFDSDtBQUNBLEVBQUUsSUFBSSxRQUFRLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQztBQUNsQyxFQUFFLElBQUksaUJBQWlCLEdBQUcsT0FBTyxDQUFDLGlCQUFpQixDQUFDO0FBQ3BELEVBQUUsSUFBSSxNQUFNLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQztBQUM5QixFQUFFLElBQUksV0FBVyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUM7QUFDakM7QUFDQSxFQUFFLElBQUksQ0FBQyxXQUFXLEVBQUU7QUFDcEIsSUFBSSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsaUJBQWlCLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxFQUFFO0FBQ3ZELE1BQU0sV0FBVyxHQUFHLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3pDO0FBQ0E7QUFDQSxNQUFNLElBQUksV0FBVyxLQUFLLEtBQUssSUFBSSxRQUFRLElBQUksUUFBUTtBQUN2RCxVQUFVLGVBQWUsRUFBRSxJQUFJLFlBQVksQ0FBQyxtQkFBbUIsR0FBRyxNQUFNLEdBQUcsSUFBSSxDQUFDLEVBQUU7QUFDbEY7QUFDQSxRQUFRLGNBQWMsQ0FBQyxLQUFLLEVBQUUsMEJBQTBCLEdBQUcsSUFBSSxHQUFHLGdCQUFnQjtBQUNsRixVQUFVLDhEQUE4RCxDQUFDLENBQUM7QUFDMUUsUUFBUSxTQUFTO0FBQ2pCLE9BQU87QUFDUCxNQUFNLE1BQU07QUFDWixLQUFLO0FBQ0wsR0FBRztBQUNIO0FBQ0EsRUFBRSxJQUFJLE9BQU8sR0FBRyxRQUFRLENBQUMsV0FBVyxDQUFDLENBQUM7QUFDdEM7QUFDQTtBQUNBLEVBQUUsSUFBSSxTQUFTLEdBQUcsQ0FBQyxPQUFPLElBQUksWUFBWSxJQUFJLE9BQU87QUFDckQsSUFBSSxPQUFPLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQztBQUM5QjtBQUNBLEVBQUUsT0FBTztBQUNULElBQUksSUFBSSxFQUFFLFNBQVMsSUFBSSxNQUFNLEdBQUcsSUFBSSxJQUFJLElBQUk7QUFDNUMsSUFBSSxPQUFPLEVBQUUsV0FBVztBQUN4QixHQUFHLENBQUM7QUFDSixDQUFDOztBQzNDRCxTQUFTLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFO0FBQ3hCLEVBQUUsQ0FBQyxDQUFDLFNBQVMsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxTQUFTLEVBQUU7QUFDM0MsSUFBSSxXQUFXLEVBQUUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFO0FBQzdCLEdBQUcsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUNEO0FBQ08sU0FBUyxXQUFXLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRTtBQUMxQyxFQUFFLElBQUksS0FBSyxHQUFHLFVBQVUsR0FBRyxJQUFJLEVBQUU7QUFDakMsSUFBSSxJQUFJLEVBQUUsSUFBSSxZQUFZLEtBQUssQ0FBQyxFQUFFO0FBQ2xDLE1BQU0sT0FBTyxJQUFJLEtBQUssQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDO0FBQ2hDLEtBQUs7QUFDTCxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQzNCLEdBQUcsQ0FBQztBQUNKLEVBQUUsUUFBUSxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUMsQ0FBQztBQUMxQixFQUFFLE9BQU8sS0FBSyxDQUFDO0FBQ2Y7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTLHFCQUFxQixDQUFDLElBQUksRUFBRTtBQUNyQztBQUNBLEVBQUUsU0FBUyxXQUFXLENBQUMsZ0JBQWdCLEVBQUU7QUFDekMsSUFBSSxJQUFJLENBQUMsY0FBYyxDQUFDLFFBQVEsRUFBRSxRQUFRLENBQUMsQ0FBQztBQUM1QyxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsRUFBRTtBQUMzQixNQUFNLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDcEQsS0FBSztBQUNMLEdBQUc7QUFDSDtBQUNBLEVBQUUsU0FBUyxRQUFRLEdBQUc7QUFDdEIsSUFBSSxJQUFJLENBQUMsY0FBYyxDQUFDLFdBQVcsRUFBRSxXQUFXLENBQUMsQ0FBQztBQUNsRCxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQztBQUN6QyxHQUFHO0FBQ0g7QUFDQSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLFdBQVcsQ0FBQyxDQUFDO0FBQ3RDLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDaEMsRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDckMsQ0FBQztBQUNEO0FBQ0EsTUFBTSxhQUFhLFNBQVNDLGVBQU8sQ0FBQztBQUNwQyxFQUFFLFdBQVcsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFO0FBQzFCLElBQUksS0FBSyxFQUFFLENBQUM7QUFDWixJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQzVCLEdBQUc7QUFDSDtBQUNBLEVBQUUsTUFBTSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUU7QUFDckIsSUFBSSxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUM7QUFDbkIsSUFBSSxJQUFJLEdBQUcsSUFBSSxJQUFJLEVBQUUsQ0FBQztBQUN0QjtBQUNBLElBQUksSUFBSSxJQUFJLElBQUksT0FBTyxJQUFJLEtBQUssUUFBUSxFQUFFO0FBQzFDLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQztBQUNsQixNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO0FBQ3ZCLE1BQU0sT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDO0FBQ3ZCLEtBQUs7QUFDTDtBQUNBLElBQUksSUFBSSxJQUFJLENBQUMsa0JBQWtCLEtBQUssU0FBUyxFQUFFO0FBQy9DLE1BQU0sSUFBSSxDQUFDLGtCQUFrQixHQUFHLElBQUksQ0FBQztBQUNyQyxLQUFLO0FBQ0w7QUFDQSxJQUFJLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNyQztBQUNBLElBQUksSUFBSSxDQUFDLGVBQWUsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDO0FBQ2hELElBQUksSUFBSSxDQUFDLGtCQUFrQixHQUFHLElBQUksQ0FBQyxrQkFBa0IsSUFBSSxJQUFJLENBQUM7QUFDOUQsSUFBSSxJQUFJLENBQUMsTUFBTSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUM7QUFDakM7QUFDQSxJQUFJLElBQUksT0FBTyxJQUFJLEtBQUssUUFBUSxFQUFFO0FBQ2xDLE1BQU0sTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0FBQ2pELEtBQUs7QUFDTDtBQUNBLElBQUksSUFBSSxZQUFZLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxJQUFJLEVBQUUsSUFBSSxJQUFJLENBQUM7QUFDbEQsSUFBSSxJQUFJLE9BQU8sR0FBRyxZQUFZLENBQUMsWUFBWSxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQ25EO0FBQ0EsSUFBSSxJQUFJLENBQUMsSUFBSSxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUM7QUFDN0IsSUFBSSxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLElBQUksT0FBTyxDQUFDLE9BQU8sQ0FBQztBQUNuRDtBQUNBLElBQUksSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7QUFDckIsSUFBSSxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUM7QUFDakMsSUFBSSxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLFNBQVMsRUFBRSxrQkFBa0IsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztBQUN6RTtBQUNBLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQztBQUN2QyxRQUFRLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUU7QUFDakQsTUFBTSxNQUFNLElBQUksS0FBSyxDQUFDLG1CQUFtQixHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUMxRCxLQUFLO0FBQ0w7QUFDQSxJQUFJLElBQUksSUFBSSxDQUFDLFlBQVksRUFBRTtBQUMzQixNQUFNLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUM7QUFDOUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFO0FBQ3hELFFBQVEsTUFBTSxJQUFJLEtBQUssQ0FBQyx3QkFBd0IsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7QUFDdEUsT0FBTztBQUNQLEtBQUs7QUFDTDtBQUNBLElBQUksSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLFNBQVMsRUFBRSxDQUFDO0FBQ3JDO0FBQ0EsSUFBSSxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUM7QUFDaEM7QUFDQSxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLENBQUMsR0FBRyxLQUFLO0FBQzdELE1BQU0sSUFBSSxHQUFHLEVBQUU7QUFDZixRQUFRLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDeEMsT0FBTztBQUNQLE1BQU0scUJBQXFCLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDbEM7QUFDQSxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQ2pDLE1BQU0sT0FBTyxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3pDLE1BQU0sSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDakMsS0FBSyxDQUFDLENBQUM7QUFDUCxHQUFHO0FBQ0gsQ0FBQztBQUNEO0FBQ0EsTUFBTSxPQUFPLEdBQUcsV0FBVyxDQUFDLGFBQWEsRUFBRSxVQUFVLElBQUksRUFBRSxJQUFJLEVBQUU7QUFDakUsRUFBRSxhQUFhLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztBQUN4RCxDQUFDLENBQUMsQ0FBQztBQUNIO0FBQ0EsTUFBTSxZQUFZLEdBQUcsZUFBZSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQzlDO0FBQ0EsZ0JBQWUsT0FBTzs7QUM1R1AsTUFBTSxXQUFXLENBQUM7QUFDakMsRUFBRSxXQUFXLEdBQUc7QUFDaEIsSUFBSSxJQUFJLENBQUMsS0FBSyxHQUFHLEVBQUUsQ0FBQztBQUNwQixHQUFHO0FBQ0g7QUFDQSxFQUFFLElBQUksR0FBRztBQUNULElBQUksT0FBTyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUNyQyxHQUFHO0FBQ0g7QUFDQSxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUU7QUFDWixJQUFJLE1BQU0sRUFBRSxHQUFHQyxFQUFNLEVBQUUsQ0FBQztBQUN4QixJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLEdBQUc7QUFDckIsTUFBTSxFQUFFO0FBQ1IsTUFBTSxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7QUFDckIsTUFBTSxXQUFXLEVBQUUsSUFBSSxDQUFDLFdBQVc7QUFDbkMsTUFBTSxVQUFVLEVBQUUsSUFBSSxJQUFJLEVBQUUsQ0FBQyxNQUFNLEVBQUU7QUFDckMsS0FBSyxDQUFDO0FBQ04sSUFBSSxPQUFPLEVBQUUsQ0FBQztBQUNkLEdBQUc7QUFDSDtBQUNBLEVBQUUsR0FBRyxDQUFDLEVBQUUsRUFBRTtBQUNWLElBQUksT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQzFCLEdBQUc7QUFDSDtBQUNBO0FBQ0EsRUFBRSxNQUFNLENBQUMsRUFBRSxFQUFFLE1BQU0sRUFBRTtBQUNyQixJQUFJLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUMxQixJQUFJLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQztBQUN0QixHQUFHO0FBQ0g7QUFDQSxFQUFFLE1BQU0sQ0FBQyxFQUFFLEVBQUUsV0FBVyxFQUFFO0FBQzFCLElBQUksTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUNoQyxJQUFJLElBQUksT0FBTyxJQUFJLEtBQUssV0FBVyxFQUFFO0FBQ3JDLE1BQU0sTUFBTSxVQUFVLEdBQUc7QUFDekIsUUFBUSxFQUFFLEVBQUUsSUFBSSxDQUFDLEVBQUU7QUFDbkIsUUFBUSxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7QUFDdkIsUUFBUSxVQUFVLEVBQUUsSUFBSSxDQUFDLFVBQVU7QUFDbkMsUUFBUSxXQUFXLEVBQUUsV0FBVyxDQUFDLFdBQVcsSUFBSSxJQUFJLENBQUMsV0FBVztBQUNoRSxRQUFRLGVBQWUsRUFBRSxXQUFXLENBQUMsZUFBZSxJQUFJLElBQUksQ0FBQyxlQUFlO0FBQzVFLFFBQVEsVUFBVSxFQUFFLElBQUksSUFBSSxFQUFFLENBQUMsTUFBTSxFQUFFO0FBQ3ZDLE9BQU8sQ0FBQztBQUNSLE1BQU0sSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsR0FBRyxVQUFVLENBQUM7QUFDbEMsS0FBSztBQUNMLElBQUksT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDO0FBQ3RCLEdBQUc7QUFDSDs7QUMvQ0E7QUFDQTtBQU1BO0FBQ0FMLFNBQU8sQ0FBQyxRQUFRLEdBQUcsRUFBRSxDQUFDO0FBQ3RCQSxTQUFPLENBQUMsaUJBQWlCLEdBQUcsRUFBRSxDQUFDO0FBQy9CO0FBQ0FBLFNBQU8sQ0FBQyxNQUFNLEdBQUcsU0FBUyxDQUFDO0FBQzNCO0FBQ0EsSUFBSSxZQUFZLEdBQUcsSUFBSU0sUUFBRSxFQUFFLENBQUM7QUFDNUI7QUFDQSxTQUFTLGlCQUFpQixDQUFDLEtBQUssRUFBRTtBQUNsQyxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUNBLFFBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBVSxHQUFHLEVBQUU7QUFDbkQsSUFBSSxJQUFJLE9BQU9BLFFBQUUsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLEtBQUssVUFBVSxFQUFFO0FBQ2pELE1BQU0sS0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFHLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7QUFDeEQsS0FBSztBQUNMLEdBQUcsQ0FBQyxDQUFDO0FBQ0w7QUFDQTtBQUNBO0FBQ0EsRUFBRSxJQUFJLGlCQUFpQixHQUFHLEtBQUssQ0FBQyxxQkFBcUIsR0FBRyxJQUFJLEdBQUcsRUFBRSxDQUFDO0FBQ2xFO0FBQ0EsRUFBRSxLQUFLLENBQUMsRUFBRSxDQUFDLEtBQUssRUFBRSxTQUFTLGdCQUFnQixDQUFDLEVBQUUsRUFBRTtBQUNoRCxJQUFJLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFO0FBQ3pDLE1BQU0saUJBQWlCLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFDekMsS0FBSztBQUNMLElBQUksaUJBQWlCLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDNUMsR0FBRyxDQUFDLENBQUM7QUFDTDtBQUNBLEVBQUUsS0FBSyxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsU0FBUyxrQkFBa0IsQ0FBQyxFQUFFLEVBQUU7QUFDcEQsSUFBSSxJQUFJLENBQUMsaUJBQWlCLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRTtBQUN6QyxNQUFNLE9BQU87QUFDYixLQUFLO0FBQ0wsSUFBSSxJQUFJLE1BQU0sR0FBRyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ2hELElBQUksSUFBSSxHQUFHLEdBQUcsTUFBTSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUNqQyxJQUFJLElBQUksR0FBRyxHQUFHLENBQUMsRUFBRTtBQUNqQjtBQUNBLE1BQU0sT0FBTztBQUNiLEtBQUs7QUFDTCxJQUFJLE1BQU0sQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQzFCLElBQUksSUFBSSxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtBQUMzQjtBQUNBLE1BQU0saUJBQWlCLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFDN0MsS0FBSyxNQUFNO0FBQ1gsTUFBTSxpQkFBaUIsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3hDLEtBQUs7QUFDTCxHQUFHLENBQUMsQ0FBQztBQUNMO0FBQ0EsRUFBRSxLQUFLLENBQUMsRUFBRSxDQUFDLFdBQVcsRUFBRSxTQUFTLHNCQUFzQixDQUFDLElBQUksRUFBRTtBQUM5RCxJQUFJLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUU7QUFDdEMsTUFBTSxPQUFPO0FBQ2IsS0FBSztBQUNMLElBQUksSUFBSSxNQUFNLEdBQUcsaUJBQWlCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzdDLElBQUksaUJBQWlCLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ25DLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsRUFBRTtBQUNqQyxNQUFNLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ2hDLEtBQUssQ0FBQyxDQUFDO0FBQ1AsR0FBRyxDQUFDLENBQUM7QUFDTCxDQUFDO0FBQ0Q7QUFDQSxpQkFBaUIsQ0FBQ04sU0FBTyxDQUFDLENBQUM7QUFDM0I7QUFDQUEsU0FBTyxDQUFDLE9BQU8sR0FBRyxVQUFVLEVBQUUsRUFBRSxHQUFHLEVBQUUsc0JBQXNCLEVBQUU7QUFDN0Q7QUFDQSxFQUFFLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRSxFQUFFO0FBQ25CLElBQUlBLFNBQU8sQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQy9CLElBQUksSUFBSSxzQkFBc0IsRUFBRTtBQUNoQyxNQUFNQSxTQUFPLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ3pDLEtBQUs7QUFDTCxHQUFHO0FBQ0gsQ0FBQyxDQUFDO0FBQ0Y7QUFDQUEsU0FBTyxDQUFDLE1BQU0sR0FBRyxVQUFVLEdBQUcsRUFBRTtBQUNoQyxFQUFFLElBQUksT0FBTyxHQUFHLEtBQUssVUFBVSxFQUFFO0FBQ2pDLElBQUksR0FBRyxDQUFDQSxTQUFPLENBQUMsQ0FBQztBQUNqQixHQUFHLE1BQU0sSUFBSSxPQUFPLEdBQUcsS0FBSyxRQUFRLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO0FBQ3ZFLElBQUksTUFBTSxJQUFJLEtBQUssQ0FBQyx1QkFBdUIsR0FBRyxHQUFHLEdBQUcscUNBQXFDLENBQUMsQ0FBQztBQUMzRixHQUFHLE1BQU07QUFDVCxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxFQUFFO0FBQzNDLE1BQU1BLFNBQU8sQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLEdBQUcsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ3RDLEtBQUssQ0FBQyxDQUFDO0FBQ1AsR0FBRztBQUNILEVBQUUsSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFO0FBQ3ZCLElBQUlBLFNBQU8sQ0FBQyxVQUFVLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBQzVELEdBQUc7QUFDSCxFQUFFLE9BQU9BLFNBQU8sQ0FBQztBQUNqQixDQUFDLENBQUM7QUFDRjtBQUNBQSxTQUFPLENBQUMsUUFBUSxHQUFHLFVBQVUsV0FBVyxFQUFFO0FBQzFDLEVBQUUsSUFBSSxpQkFBaUIsR0FBRyxXQUFXLENBQUNBLFNBQU8sRUFBRSxVQUFVLElBQUksRUFBRSxJQUFJLEVBQUU7QUFDckUsSUFBSSxJQUFJLEdBQUcsSUFBSSxJQUFJLEVBQUUsQ0FBQztBQUN0QjtBQUNBLElBQUksSUFBSSxJQUFJLElBQUksT0FBTyxJQUFJLEtBQUssUUFBUSxFQUFFO0FBQzFDLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQztBQUNsQixNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO0FBQ3ZCLE1BQU0sT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDO0FBQ3ZCLEtBQUs7QUFDTDtBQUNBLElBQUksSUFBSSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFLGlCQUFpQixDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsQ0FBQztBQUNqRSxJQUFJQSxTQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDbkMsR0FBRyxDQUFDLENBQUM7QUFDTDtBQUNBLEVBQUUsaUJBQWlCLENBQUMsaUJBQWlCLEdBQUdBLFNBQU8sQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLEVBQUUsQ0FBQztBQUMxRSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUNBLFNBQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFVLEdBQUcsRUFBRTtBQUM5QyxJQUFJLElBQUksRUFBRSxHQUFHLElBQUksaUJBQWlCLENBQUMsRUFBRTtBQUNyQyxNQUFNLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxHQUFHQSxTQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDNUMsS0FBSztBQUNMLEdBQUcsQ0FBQyxDQUFDO0FBQ0w7QUFDQTtBQUNBO0FBQ0EsRUFBRSxpQkFBaUIsQ0FBQyxVQUFVLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLFVBQVUsRUFBRSxXQUFXLENBQUMsQ0FBQztBQUNqRjtBQUNBLEVBQUUsT0FBTyxpQkFBaUIsQ0FBQztBQUMzQixDQUFDLENBQUM7QUFDRjtBQUNBQSxTQUFPLENBQUMsS0FBSyxHQUFHLFVBQVUsR0FBRyxFQUFFLElBQUksRUFBRTtBQUNyQyxFQUFFLE9BQU8sS0FBSyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FBQztBQUMxQixDQUFDLENBQUM7QUFDRjtBQUNBQSxTQUFPLENBQUMsU0FBUyxDQUFDLFdBQVcsR0FBR0EsU0FBTyxDQUFDLFdBQVcsR0FBRyxJQUFJLFdBQVcsRUFBRTs7QUM1SHZFO0FBQ0EsY0FBZSxrQkFBa0I7O0FDR2pDO0FBQ0FBLFNBQU8sQ0FBQyxNQUFNLENBQUNPLHdCQUFrQixDQUFDLENBQUM7QUFDbkM7QUFDQVAsU0FBTyxDQUFDLE9BQU8sR0FBRyxPQUFPOzs7OyJ9
