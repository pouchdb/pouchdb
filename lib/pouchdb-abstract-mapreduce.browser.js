import { i as immediate } from './functionName-9335a350.js';
import './__node-resolve_empty-5ffda92e.js';
import { g as guardedConsole } from './guardedConsole-f54e5a40.js';
import { generateErrorFromResponse } from './pouchdb-errors.browser.js';
import { f as flatten } from './flatten-994f45c6.js';
import { i as isRemote } from './isRemote-f9121da9.js';
import { b as b64ToBluffer } from './base64StringToBlobOrBuffer-browser-ee4c0b54.js';
import './spark-md5-2c57e5fc.js';
import { c as collate, t as toIndexableString, n as normalizeKey, p as parseIndexableString } from './index-3a476dad.js';
import { Headers } from './pouchdb-fetch.browser.js';
import { u as upsert } from './upsert-331b6913.js';
import { stringMd5 } from './pouchdb-crypto.browser.js';
import { promisedCallback, callbackify, mapToKeysArray, sequentialize, fin, NotFoundError, QueryParseError, uniq, BuiltInError } from './pouchdb-mapreduce-utils.browser.js';
import './_commonjsHelpers-24198af3.js';
import './binaryStringToBlobOrBuffer-browser-2c8e268c.js';

/*
 * Simple task queue to sequentialize actions. Assumes
 * callbacks will eventually fire (once).
 */


class TaskQueue {
  constructor() {
    this.promise = new Promise(function (fulfill) {fulfill(); });
  }

  add(promiseFactory) {
    this.promise = this.promise.catch(function () {
      // just recover
    }).then(function () {
      return promiseFactory();
    });
    return this.promise;
  }

  finish() {
    return this.promise;
  }
}

function stringify(input) {
  if (!input) {
    return 'undefined'; // backwards compat for empty reduce
  }
  // for backwards compat with mapreduce, functions/strings are stringified
  // as-is. everything else is JSON-stringified.
  switch (typeof input) {
    case 'function':
      // e.g. a mapreduce map
      return input.toString();
    case 'string':
      // e.g. a mapreduce built-in _reduce function
      return input.toString();
    default:
      // e.g. a JSON object in the case of mango queries
      return JSON.stringify(input);
  }
}

/* create a string signature for a view so we can cache it and uniq it */
function createViewSignature(mapFun, reduceFun) {
  // the "undefined" part is for backwards compatibility
  return stringify(mapFun) + stringify(reduceFun) + 'undefined';
}

async function createView(sourceDB, viewName, mapFun, reduceFun, temporary, localDocName) {
  const viewSignature = createViewSignature(mapFun, reduceFun);

  let cachedViews;
  if (!temporary) {
    // cache this to ensure we don't try to update the same view twice
    cachedViews = sourceDB._cachedViews = sourceDB._cachedViews || {};
    if (cachedViews[viewSignature]) {
      return cachedViews[viewSignature];
    }
  }

  const promiseForView = sourceDB.info().then(async function (info) {
    const depDbName = info.db_name + '-mrview-' +
    (temporary ? 'temp' : await stringMd5(viewSignature));

    // save the view name in the source db so it can be cleaned up if necessary
    // (e.g. when the _design doc is deleted, remove all associated view data)
    function diffFunction(doc) {
      doc.views = doc.views || {};
      let fullViewName = viewName;
      if (fullViewName.indexOf('/') === -1) {
        fullViewName = viewName + '/' + viewName;
      }
      const depDbs = doc.views[fullViewName] = doc.views[fullViewName] || {};
      /* istanbul ignore if */
      if (depDbs[depDbName]) {
        return; // no update necessary
      }
      depDbs[depDbName] = true;
      return doc;
    }
    await upsert(sourceDB, '_local/' + localDocName, diffFunction);
    const res = await sourceDB.registerDependentDatabase(depDbName);
    const db = res.db;
    db.auto_compaction = true;
    const view = {
      name: depDbName,
      db: db,
      sourceDB: sourceDB,
      adapter: sourceDB.adapter,
      mapFun: mapFun,
      reduceFun: reduceFun
    };

    let lastSeqDoc;
    try {
      lastSeqDoc = await view.db.get('_local/lastSeq');
    } catch (err) {
        /* istanbul ignore if */
      if (err.status !== 404) {
        throw err;
      }
    }

    view.seq = lastSeqDoc ? lastSeqDoc.seq : 0;
    if (cachedViews) {
      view.db.once('destroyed', function () {
        delete cachedViews[viewSignature];
      });
    }
    return view;
  });

  if (cachedViews) {
    cachedViews[viewSignature] = promiseForView;
  }
  return promiseForView;
}

var persistentQueues = {};
var tempViewQueue = new TaskQueue();
var CHANGES_BATCH_SIZE = 50;

function parseViewName(name) {
  // can be either 'ddocname/viewname' or just 'viewname'
  // (where the ddoc name is the same)
  return name.indexOf('/') === -1 ? [name, name] : name.split('/');
}

function isGenOne(changes) {
  // only return true if the current change is 1-
  // and there are no other leafs
  return changes.length === 1 && /^1-/.test(changes[0].rev);
}

function emitError(db, e, data) {
  try {
    db.emit('error', e);
  } catch (err) {
    guardedConsole('error',
      'The user\'s map/reduce function threw an uncaught error.\n' +
      'You can debug this error by doing:\n' +
      'myDatabase.on(\'error\', function (err) { debugger; });\n' +
      'Please double-check your map/reduce function.');
    guardedConsole('error', e, data);
  }
}

/**
 * Returns an "abstract" mapreduce object of the form:
 *
 *   {
 *     query: queryFun,
 *     viewCleanup: viewCleanupFun
 *   }
 *
 * Arguments are:
 *
 * localDoc: string
 *   This is for the local doc that gets saved in order to track the
 *   "dependent" DBs and clean them up for viewCleanup. It should be
 *   unique, so that indexer plugins don't collide with each other.
 * mapper: function (mapFunDef, emit)
 *   Returns a map function based on the mapFunDef, which in the case of
 *   normal map/reduce is just the de-stringified function, but may be
 *   something else, such as an object in the case of pouchdb-find.
 * reducer: function (reduceFunDef)
 *   Ditto, but for reducing. Modules don't have to support reducing
 *   (e.g. pouchdb-find).
 * ddocValidator: function (ddoc, viewName)
 *   Throws an error if the ddoc or viewName is not valid.
 *   This could be a way to communicate to the user that the configuration for the
 *   indexer is invalid.
 */
function createAbstractMapReduce(localDocName, mapper, reducer, ddocValidator) {

  function tryMap(db, fun, doc) {
    // emit an event if there was an error thrown by a map function.
    // putting try/catches in a single function also avoids deoptimizations.
    try {
      fun(doc);
    } catch (e) {
      emitError(db, e, {fun: fun, doc: doc});
    }
  }

  function tryReduce(db, fun, keys, values, rereduce) {
    // same as above, but returning the result or an error. there are two separate
    // functions to avoid extra memory allocations since the tryCode() case is used
    // for custom map functions (common) vs this function, which is only used for
    // custom reduce functions (rare)
    try {
      return {output : fun(keys, values, rereduce)};
    } catch (e) {
      emitError(db, e, {fun: fun, keys: keys, values: values, rereduce: rereduce});
      return {error: e};
    }
  }

  function sortByKeyThenValue(x, y) {
    const keyCompare = collate(x.key, y.key);
    return keyCompare !== 0 ? keyCompare : collate(x.value, y.value);
  }

  function sliceResults(results, limit, skip) {
    skip = skip || 0;
    if (typeof limit === 'number') {
      return results.slice(skip, limit + skip);
    } else if (skip > 0) {
      return results.slice(skip);
    }
    return results;
  }

  function rowToDocId(row) {
    const val = row.value;
    // Users can explicitly specify a joined doc _id, or it
    // defaults to the doc _id that emitted the key/value.
    const docId = (val && typeof val === 'object' && val._id) || row.id;
    return docId;
  }

  function readAttachmentsAsBlobOrBuffer(res) {
    res.rows.forEach(function (row) {
      const atts = row.doc && row.doc._attachments;
      if (!atts) {
        return;
      }
      Object.keys(atts).forEach(function (filename) {
        const att = atts[filename];
        atts[filename].data = b64ToBluffer(att.data, att.content_type);
      });
    });
  }

  function postprocessAttachments(opts) {
    return function (res) {
      if (opts.include_docs && opts.attachments && opts.binary) {
        readAttachmentsAsBlobOrBuffer(res);
      }
      return res;
    };
  }

  function addHttpParam(paramName, opts, params, asJson) {
    // add an http param from opts to params, optionally json-encoded
    let val = opts[paramName];
    if (typeof val !== 'undefined') {
      if (asJson) {
        val = encodeURIComponent(JSON.stringify(val));
      }
      params.push(paramName + '=' + val);
    }
  }

  function coerceInteger(integerCandidate) {
    if (typeof integerCandidate !== 'undefined') {
      const asNumber = Number(integerCandidate);
      // prevents e.g. '1foo' or '1.1' being coerced to 1
      if (!isNaN(asNumber) && asNumber === parseInt(integerCandidate, 10)) {
        return asNumber;
      } else {
        return integerCandidate;
      }
    }
  }

  function coerceOptions(opts) {
    opts.group_level = coerceInteger(opts.group_level);
    opts.limit = coerceInteger(opts.limit);
    opts.skip = coerceInteger(opts.skip);
    return opts;
  }

  function checkPositiveInteger(number) {
    if (number) {
      if (typeof number !== 'number') {
        return  new QueryParseError(`Invalid value for integer: "${number}"`);
      }
      if (number < 0) {
        return new QueryParseError(`Invalid value for positive integer: "${number}"`);
      }
    }
  }

  function checkQueryParseError(options, fun) {
    const startkeyName = options.descending ? 'endkey' : 'startkey';
    const endkeyName = options.descending ? 'startkey' : 'endkey';

    if (typeof options[startkeyName] !== 'undefined' &&
      typeof options[endkeyName] !== 'undefined' &&
      collate(options[startkeyName], options[endkeyName]) > 0) {
      throw new QueryParseError('No rows can match your key range, ' +
        'reverse your start_key and end_key or set {descending : true}');
    } else if (fun.reduce && options.reduce !== false) {
      if (options.include_docs) {
        throw new QueryParseError('{include_docs:true} is invalid for reduce');
      } else if (options.keys && options.keys.length > 1 &&
        !options.group && !options.group_level) {
        throw new QueryParseError('Multi-key fetches for reduce views must use ' +
          '{group: true}');
      }
    }
    ['group_level', 'limit', 'skip'].forEach(function (optionName) {
      const error = checkPositiveInteger(options[optionName]);
      if (error) {
        throw error;
      }
    });
  }

  async function httpQuery(db, fun, opts) {
    // List of parameters to add to the PUT request
    let params = [];
    let body;
    let method = 'GET';
    let ok;

    // If opts.reduce exists and is defined, then add it to the list
    // of parameters.
    // If reduce=false then the results are that of only the map function
    // not the final result of map and reduce.
    addHttpParam('reduce', opts, params);
    addHttpParam('include_docs', opts, params);
    addHttpParam('attachments', opts, params);
    addHttpParam('limit', opts, params);
    addHttpParam('descending', opts, params);
    addHttpParam('group', opts, params);
    addHttpParam('group_level', opts, params);
    addHttpParam('skip', opts, params);
    addHttpParam('stale', opts, params);
    addHttpParam('conflicts', opts, params);
    addHttpParam('startkey', opts, params, true);
    addHttpParam('start_key', opts, params, true);
    addHttpParam('endkey', opts, params, true);
    addHttpParam('end_key', opts, params, true);
    addHttpParam('inclusive_end', opts, params);
    addHttpParam('key', opts, params, true);
    addHttpParam('update_seq', opts, params);

    // Format the list of parameters into a valid URI query string
    params = params.join('&');
    params = params === '' ? '' : '?' + params;

    // If keys are supplied, issue a POST to circumvent GET query string limits
    // see http://wiki.apache.org/couchdb/HTTP_view_API#Querying_Options
    if (typeof opts.keys !== 'undefined') {
      const MAX_URL_LENGTH = 2000;
      // according to http://stackoverflow.com/a/417184/680742,
      // the de facto URL length limit is 2000 characters

      const keysAsString = `keys=${encodeURIComponent(JSON.stringify(opts.keys))}`;
      if (keysAsString.length + params.length + 1 <= MAX_URL_LENGTH) {
        // If the keys are short enough, do a GET. we do this to work around
        // Safari not understanding 304s on POSTs (see pouchdb/pouchdb#1239)
        params += (params[0] === '?' ? '&' : '?') + keysAsString;
      } else {
        method = 'POST';
        if (typeof fun === 'string') {
          body = {keys: opts.keys};
        } else { // fun is {map : mapfun}, so append to this
          fun.keys = opts.keys;
        }
      }
    }

    // We are referencing a query defined in the design doc
    if (typeof fun === 'string') {
      const parts = parseViewName(fun);

      const response = await db.fetch('_design/' + parts[0] + '/_view/' + parts[1] + params, {
        headers: new Headers({'Content-Type': 'application/json'}),
        method: method,
        body: JSON.stringify(body)
      });
      ok = response.ok;
      // status = response.status;
      const result = await response.json();

      if (!ok) {
        result.status = response.status;
        throw generateErrorFromResponse(result);
      }

      // fail the entire request if the result contains an error
      result.rows.forEach(function (row) {
        /* istanbul ignore if */
        if (row.value && row.value.error && row.value.error === "builtin_reduce_error") {
          throw new Error(row.reason);
        }
      });

      return new Promise(function (resolve) {
        resolve(result);
      }).then(postprocessAttachments(opts));
    }

    // We are using a temporary view, terrible for performance, good for testing
    body = body || {};
    Object.keys(fun).forEach(function (key) {
      if (Array.isArray(fun[key])) {
        body[key] = fun[key];
      } else {
        body[key] = fun[key].toString();
      }
    });

    const response = await db.fetch('_temp_view' + params, {
      headers: new Headers({'Content-Type': 'application/json'}),
      method: 'POST',
      body: JSON.stringify(body)
    });

    ok = response.ok;
    // status = response.status;
    const result = await response.json();
    if (!ok) {
      result.status = response.status;
      throw generateErrorFromResponse(result);
    }

    return new Promise(function (resolve) {
      resolve(result);
    }).then(postprocessAttachments(opts));
  }

  // custom adapters can define their own api._query
  // and override the default behavior
  /* istanbul ignore next */
  function customQuery(db, fun, opts) {
    return new Promise(function (resolve, reject) {
      db._query(fun, opts, function (err, res) {
        if (err) {
          return reject(err);
        }
        resolve(res);
      });
    });
  }

  // custom adapters can define their own api._viewCleanup
  // and override the default behavior
  /* istanbul ignore next */
  function customViewCleanup(db) {
    return new Promise(function (resolve, reject) {
      db._viewCleanup(function (err, res) {
        if (err) {
          return reject(err);
        }
        resolve(res);
      });
    });
  }

  function defaultsTo(value) {
    return function (reason) {
      /* istanbul ignore else */
      if (reason.status === 404) {
        return value;
      } else {
        throw reason;
      }
    };
  }

  // returns a promise for a list of docs to update, based on the input docId.
  // the order doesn't matter, because post-3.2.0, bulkDocs
  // is an atomic operation in all three adapters.
  async function getDocsToPersist(docId, view, docIdsToChangesAndEmits) {
    const metaDocId = '_local/doc_' + docId;
    const defaultMetaDoc = {_id: metaDocId, keys: []};
    const docData = docIdsToChangesAndEmits.get(docId);
    const indexableKeysToKeyValues = docData[0];
    const changes = docData[1];

    function getMetaDoc() {
      if (isGenOne(changes)) {
        // generation 1, so we can safely assume initial state
        // for performance reasons (avoids unnecessary GETs)
        return Promise.resolve(defaultMetaDoc);
      }
      return view.db.get(metaDocId).catch(defaultsTo(defaultMetaDoc));
    }

    function getKeyValueDocs(metaDoc) {
      if (!metaDoc.keys.length) {
        // no keys, no need for a lookup
        return Promise.resolve({rows: []});
      }
      return view.db.allDocs({
        keys: metaDoc.keys,
        include_docs: true
      });
    }

    function processKeyValueDocs(metaDoc, kvDocsRes) {
      const kvDocs = [];
      const oldKeys = new Set();

      for (let i = 0, len = kvDocsRes.rows.length; i < len; i++) {
        const row = kvDocsRes.rows[i];
        const doc = row.doc;
        if (!doc) { // deleted
          continue;
        }
        kvDocs.push(doc);
        oldKeys.add(doc._id);
        doc._deleted = !indexableKeysToKeyValues.has(doc._id);
        if (!doc._deleted) {
          const keyValue = indexableKeysToKeyValues.get(doc._id);
          if ('value' in keyValue) {
            doc.value = keyValue.value;
          }
        }
      }
      const newKeys = mapToKeysArray(indexableKeysToKeyValues);
      newKeys.forEach(function (key) {
        if (!oldKeys.has(key)) {
          // new doc
          const kvDoc = {
            _id: key
          };
          const keyValue = indexableKeysToKeyValues.get(key);
          if ('value' in keyValue) {
            kvDoc.value = keyValue.value;
          }
          kvDocs.push(kvDoc);
        }
      });
      metaDoc.keys = uniq(newKeys.concat(metaDoc.keys));
      kvDocs.push(metaDoc);

      return kvDocs;
    }

    const metaDoc = await getMetaDoc();
    const keyValueDocs = await getKeyValueDocs(metaDoc);
    return processKeyValueDocs(metaDoc, keyValueDocs);
  }

  function updatePurgeSeq(view) {
    // with this approach, we just assume to have processed all missing purges and write the latest
    // purgeSeq into the _local/purgeSeq doc.
    return view.sourceDB.get('_local/purges').then(function (res) {
      const purgeSeq = res.purgeSeq;
      return view.db.get('_local/purgeSeq').then(function (res) {
        return res._rev;
      }).catch(function (err) {
        if (err.status !== 404) {
          throw err;
        }
        return undefined;
      }).then(function (rev) {
        return view.db.put({
          _id: '_local/purgeSeq',
          _rev: rev,
          purgeSeq,
        });
      });
    }).catch(function (err) {
      if (err.status !== 404) {
        throw err;
      }
    });
  }

  // updates all emitted key/value docs and metaDocs in the mrview database
  // for the given batch of documents from the source database
  function saveKeyValues(view, docIdsToChangesAndEmits, seq) {
    var seqDocId = '_local/lastSeq';
    return view.db.get(seqDocId)
      .catch(defaultsTo({_id: seqDocId, seq: 0}))
      .then(function (lastSeqDoc) {
        var docIds = mapToKeysArray(docIdsToChangesAndEmits);
        return Promise.all(docIds.map(function (docId) {
          return getDocsToPersist(docId, view, docIdsToChangesAndEmits);
        })).then(function (listOfDocsToPersist) {
          var docsToPersist = flatten(listOfDocsToPersist);
          lastSeqDoc.seq = seq;
          docsToPersist.push(lastSeqDoc);
          // write all docs in a single operation, update the seq once
          return view.db.bulkDocs({docs : docsToPersist});
        })
          // TODO: this should be placed somewhere else, probably? we're querying both docs twice
          //   (first time when getting the actual purges).
          .then(() => updatePurgeSeq(view));
      });
  }

  function getQueue(view) {
    const viewName = typeof view === 'string' ? view : view.name;
    let queue = persistentQueues[viewName];
    if (!queue) {
      queue = persistentQueues[viewName] = new TaskQueue();
    }
    return queue;
  }

  async function updateView(view, opts) {
    return sequentialize(getQueue(view), function () {
      return updateViewInQueue(view, opts);
    })();
  }

  async function updateViewInQueue(view, opts) {
    // bind the emit function once
    let mapResults;
    let doc;
    let taskId;

    function emit(key, value) {
      const output = {id: doc._id, key: normalizeKey(key)};
      // Don't explicitly store the value unless it's defined and non-null.
      // This saves on storage space, because often people don't use it.
      if (typeof value !== 'undefined' && value !== null) {
        output.value = normalizeKey(value);
      }
      mapResults.push(output);
    }

    const mapFun = mapper(view.mapFun, emit);

    let currentSeq = view.seq || 0;

    function createTask() {
      return view.sourceDB.info().then(function (info) {
        taskId = view.sourceDB.activeTasks.add({
          name: 'view_indexing',
          total_items: info.update_seq - currentSeq,
        });
      });
    }

    function processChange(docIdsToChangesAndEmits, seq) {
      return function () {
        return saveKeyValues(view, docIdsToChangesAndEmits, seq);
      };
    }

    let indexed_docs = 0;
    const progress = {
      view: view.name,
      indexed_docs: indexed_docs
    };
    view.sourceDB.emit('indexing', progress);

    const queue = new TaskQueue();

    async function processNextBatch() {
      const response = await view.sourceDB.changes({
        return_docs: true,
        conflicts: true,
        include_docs: true,
        style: 'all_docs',
        since: currentSeq,
        limit: opts.changes_batch_size
      });
      const purges = await getRecentPurges();
      return processBatch(response, purges);
    }

    function getRecentPurges() {
      return view.db.get('_local/purgeSeq').then(function (res) {
        return res.purgeSeq;
      }).catch(function (err) {
        if (err && err.status !== 404) {
          throw err;
        }
        return -1;
      }).then(function (purgeSeq) {
        return view.sourceDB.get('_local/purges').then(function (res) {
          const recentPurges = res.purges.filter(function (purge, index) {
            return index > purgeSeq;
          }).map((purge) => purge.docId);

          const uniquePurges = recentPurges.filter(function (docId, index) {
            return recentPurges.indexOf(docId) === index;
          });

          return Promise.all(uniquePurges.map(function (docId) {
            return view.sourceDB.get(docId).then(function (doc) {
              return { docId, doc };
            }).catch(function (err) {
              if (err.status !== 404) {
                throw err;
              }
              return { docId };
            });
          }));
        }).catch(function (err) {
          if (err && err.status !== 404) {
            throw err;
          }
          return [];
        });
      });
    }

    function processBatch(response, purges) {
      var results = response.results;
      if (!results.length && !purges.length) {
        return;
      }

      for (let purge of purges) {
        const index = results.findIndex(function (change) {
          return change.id === purge.docId;
        });
        if (index < 0) {
          // mimic a db.remove() on the changes feed
          const entry = {
            _id: purge.docId,
            doc: {
              _id: purge.docId,
              _deleted: 1,
            },
            changes: [],
          };

          if (purge.doc) {
            // update with new winning rev after purge
            entry.doc = purge.doc;
            entry.changes.push({ rev: purge.doc._rev });
          }

          results.push(entry);
        }
      }

      var docIdsToChangesAndEmits = createDocIdsToChangesAndEmits(results);

      queue.add(processChange(docIdsToChangesAndEmits, currentSeq));

      indexed_docs = indexed_docs + results.length;
      const progress = {
        view: view.name,
        last_seq: response.last_seq,
        results_count: results.length,
        indexed_docs: indexed_docs
      };
      view.sourceDB.emit('indexing', progress);
      view.sourceDB.activeTasks.update(taskId, {completed_items: indexed_docs});

      if (results.length < opts.changes_batch_size) {
        return;
      }
      return processNextBatch();
    }

    function createDocIdsToChangesAndEmits(results) {
      const docIdsToChangesAndEmits = new Map();
      for (let i = 0, len = results.length; i < len; i++) {
        const change = results[i];
        if (change.doc._id[0] !== '_') {
          mapResults = [];
          doc = change.doc;

          if (!doc._deleted) {
            tryMap(view.sourceDB, mapFun, doc);
          }
          mapResults.sort(sortByKeyThenValue);

          const indexableKeysToKeyValues = createIndexableKeysToKeyValues(mapResults);
          docIdsToChangesAndEmits.set(change.doc._id, [
            indexableKeysToKeyValues,
            change.changes
          ]);
        }
        currentSeq = change.seq;
      }
      return docIdsToChangesAndEmits;
    }

    function createIndexableKeysToKeyValues(mapResults) {
      const indexableKeysToKeyValues = new Map();
      let lastKey;
      for (let i = 0, len = mapResults.length; i < len; i++) {
        const emittedKeyValue = mapResults[i];
        const complexKey = [emittedKeyValue.key, emittedKeyValue.id];
        if (i > 0 && collate(emittedKeyValue.key, lastKey) === 0) {
          complexKey.push(i); // dup key+id, so make it unique
        }
        indexableKeysToKeyValues.set(toIndexableString(complexKey), emittedKeyValue);
        lastKey = emittedKeyValue.key;
      }
      return indexableKeysToKeyValues;
    }

    try {
      await createTask();
      await processNextBatch();
      await queue.finish();
      view.seq = currentSeq;
      view.sourceDB.activeTasks.remove(taskId);
    } catch (error) {
      view.sourceDB.activeTasks.remove(taskId, error);      
    }
  }

  function reduceView(view, results, options) {
    if (options.group_level === 0) {
      delete options.group_level;
    }

    const shouldGroup = options.group || options.group_level;

    const reduceFun = reducer(view.reduceFun);

    const groups = [];
    const lvl = isNaN(options.group_level) ? Number.POSITIVE_INFINITY :
      options.group_level;
    results.forEach(function (e) {
      const last = groups[groups.length - 1];
      let groupKey = shouldGroup ? e.key : null;

      // only set group_level for array keys
      if (shouldGroup && Array.isArray(groupKey)) {
        groupKey = groupKey.slice(0, lvl);
      }

      if (last && collate(last.groupKey, groupKey) === 0) {
        last.keys.push([e.key, e.id]);
        last.values.push(e.value);
        return;
      }
      groups.push({
        keys: [[e.key, e.id]],
        values: [e.value],
        groupKey: groupKey
      });
    });
    results = [];
    for (let i = 0, len = groups.length; i < len; i++) {
      const e = groups[i];
      const reduceTry = tryReduce(view.sourceDB, reduceFun, e.keys, e.values, false);
      if (reduceTry.error && reduceTry.error instanceof BuiltInError) {
        // CouchDB returns an error if a built-in errors out
        throw reduceTry.error;
      }
      results.push({
        // CouchDB just sets the value to null if a non-built-in errors out
        value: reduceTry.error ? null : reduceTry.output,
        key: e.groupKey
      });
    }
    // no total_rows/offset when reducing
    return {rows: sliceResults(results, options.limit, options.skip)};
  }

  function queryView(view, opts) {
    return sequentialize(getQueue(view), function () {
      return queryViewInQueue(view, opts);
    })();
  }

  async function queryViewInQueue(view, opts) {
    let totalRows;
    const shouldReduce = view.reduceFun && opts.reduce !== false;
    const skip = opts.skip || 0;
    if (typeof opts.keys !== 'undefined' && !opts.keys.length) {
      // equivalent query
      opts.limit = 0;
      delete opts.keys;
    }

    async function fetchFromView(viewOpts) {
      viewOpts.include_docs = true;
      const res = await view.db.allDocs(viewOpts);
      totalRows = res.total_rows;

      return res.rows.map(function (result) {
        // implicit migration - in older versions of PouchDB,
        // we explicitly stored the doc as {id: ..., key: ..., value: ...}
        // this is tested in a migration test
        /* istanbul ignore next */
        if ('value' in result.doc && typeof result.doc.value === 'object' &&
          result.doc.value !== null) {
          const keys = Object.keys(result.doc.value).sort();
          // this detection method is not perfect, but it's unlikely the user
          // emitted a value which was an object with these 3 exact keys
          const expectedKeys = ['id', 'key', 'value'];
          if (!(keys < expectedKeys || keys > expectedKeys)) {
            return result.doc.value;
          }
        }

        const parsedKeyAndDocId = parseIndexableString(result.doc._id);
        return {
          key: parsedKeyAndDocId[0],
          id: parsedKeyAndDocId[1],
          value: ('value' in result.doc ? result.doc.value : null)
        };
      });
    }

    async function onMapResultsReady(rows) {
      let finalResults;
      if (shouldReduce) {
        finalResults = reduceView(view, rows, opts);
      } else if (typeof opts.keys === 'undefined') {
        finalResults = {
          total_rows: totalRows,
          offset: skip,
          rows: rows
        };
      } else {
        // support limit, skip for keys query
        finalResults = {
          total_rows: totalRows,
          offset: skip,
          rows: sliceResults(rows,opts.limit,opts.skip)
        };
      }
      /* istanbul ignore if */
      if (opts.update_seq) {
        finalResults.update_seq = view.seq;
      }
      if (opts.include_docs) {
        const docIds = uniq(rows.map(rowToDocId));

        const allDocsRes = await view.sourceDB.allDocs({
          keys: docIds,
          include_docs: true,
          conflicts: opts.conflicts,
          attachments: opts.attachments,
          binary: opts.binary
        });
        var docIdsToDocs = new Map();
        allDocsRes.rows.forEach(function (row) {
          docIdsToDocs.set(row.id, row.doc);
        });
        rows.forEach(function (row) {
          var docId = rowToDocId(row);
          var doc = docIdsToDocs.get(docId);
          if (doc) {
            row.doc = doc;
          }
        });
        return finalResults;
      } else {
        return finalResults;
      }
    }

    if (typeof opts.keys !== 'undefined') {
      const keys = opts.keys;
      const fetchPromises = keys.map(function (key) {
        const viewOpts = {
          startkey : toIndexableString([key]),
          endkey   : toIndexableString([key, {}])
        };
        /* istanbul ignore if */
        if (opts.update_seq) {
          viewOpts.update_seq = true;
        }
        return fetchFromView(viewOpts);
      });
      const result = await Promise.all(fetchPromises);
      const flattenedResult = flatten(result);
      return onMapResultsReady(flattenedResult);
    } else { // normal query, no 'keys'
      const viewOpts = {
        descending : opts.descending
      };
      /* istanbul ignore if */
      if (opts.update_seq) {
        viewOpts.update_seq = true;
      }
      let startkey;
      let endkey;
      if ('start_key' in opts) {
        startkey = opts.start_key;
      }
      if ('startkey' in opts) {
        startkey = opts.startkey;
      }
      if ('end_key' in opts) {
        endkey = opts.end_key;
      }
      if ('endkey' in opts) {
        endkey = opts.endkey;
      }
      if (typeof startkey !== 'undefined') {
        viewOpts.startkey = opts.descending ?
          toIndexableString([startkey, {}]) :
          toIndexableString([startkey]);
      }
      if (typeof endkey !== 'undefined') {
        let inclusiveEnd = opts.inclusive_end !== false;
        if (opts.descending) {
          inclusiveEnd = !inclusiveEnd;
        }

        viewOpts.endkey = toIndexableString(
          inclusiveEnd ? [endkey, {}] : [endkey]);
      }
      if (typeof opts.key !== 'undefined') {
        const keyStart = toIndexableString([opts.key]);
        const keyEnd = toIndexableString([opts.key, {}]);
        if (viewOpts.descending) {
          viewOpts.endkey = keyStart;
          viewOpts.startkey = keyEnd;
        } else {
          viewOpts.startkey = keyStart;
          viewOpts.endkey = keyEnd;
        }
      }
      if (!shouldReduce) {
        if (typeof opts.limit === 'number') {
          viewOpts.limit = opts.limit;
        }
        viewOpts.skip = skip;
      }

      const result = await fetchFromView(viewOpts);
      return onMapResultsReady(result);
    }
  }

  async function httpViewCleanup(db) {
    const response = await db.fetch('_view_cleanup', {
      headers: new Headers({'Content-Type': 'application/json'}),
      method: 'POST'
    });
    return response.json();
  }

  async function localViewCleanup(db) {
    try {
      const metaDoc = await db.get('_local/' + localDocName);
      const docsToViews = new Map();

      Object.keys(metaDoc.views).forEach(function (fullViewName) {
        const parts = parseViewName(fullViewName);
        const designDocName = '_design/' + parts[0];
        const viewName = parts[1];
        let views = docsToViews.get(designDocName);
        if (!views) {
          views = new Set();
          docsToViews.set(designDocName, views);
        }
        views.add(viewName);
      });
      const opts = {
        keys : mapToKeysArray(docsToViews),
        include_docs : true
      };

      const res = await db.allDocs(opts);
      const viewsToStatus = {};
      res.rows.forEach(function (row) {
        const ddocName = row.key.substring(8); // cuts off '_design/'
        docsToViews.get(row.key).forEach(function (viewName) {
          let fullViewName = ddocName + '/' + viewName;
          /* istanbul ignore if */
          if (!metaDoc.views[fullViewName]) {
            // new format, without slashes, to support PouchDB 2.2.0
            // migration test in pouchdb's browser.migration.js verifies this
            fullViewName = viewName;
          }
          const viewDBNames = Object.keys(metaDoc.views[fullViewName]);
          // design doc deleted, or view function nonexistent
          const statusIsGood = row.doc && row.doc.views &&
            row.doc.views[viewName];
          viewDBNames.forEach(function (viewDBName) {
            viewsToStatus[viewDBName] =
              viewsToStatus[viewDBName] || statusIsGood;
          });
        });
      });

      const dbsToDelete = Object.keys(viewsToStatus)
        .filter(function (viewDBName) { return !viewsToStatus[viewDBName]; });

      const destroyPromises = dbsToDelete.map(function (viewDBName) {
        return sequentialize(getQueue(viewDBName), function () {
          return new db.constructor(viewDBName, db.__opts).destroy();
        })();
      });

      return Promise.all(destroyPromises).then(function () {
        return {ok: true};
      });
    } catch (err) {
      if (err.status === 404) {
        return {ok: true};
      } else {
        throw err;
      }
    }
  }

  async function queryPromised(db, fun, opts) {
    /* istanbul ignore next */
    if (typeof db._query === 'function') {
      return customQuery(db, fun, opts);
    }
    if (isRemote(db)) {
      return httpQuery(db, fun, opts);
    }

    const updateViewOpts = {
      changes_batch_size: db.__opts.view_update_changes_batch_size || CHANGES_BATCH_SIZE
    };

    if (typeof fun !== 'string') {
      // temp_view
      checkQueryParseError(opts, fun);

      tempViewQueue.add(async function () {
        const view = await createView(
          /* sourceDB */ db,
          /* viewName */ 'temp_view/temp_view',
          /* mapFun */ fun.map,
          /* reduceFun */ fun.reduce,
          /* temporary */ true,
          /* localDocName */ localDocName);

        return fin(updateView(view, updateViewOpts).then(
          function () { return queryView(view, opts); }),
          function () { return view.db.destroy(); }
        );
      });
      return tempViewQueue.finish();
    } else {
      // persistent view
      const fullViewName = fun;
      const parts = parseViewName(fullViewName);
      const designDocName = parts[0];
      const viewName = parts[1];

      const doc = await db.get('_design/' + designDocName);
      fun = doc.views && doc.views[viewName];

      if (!fun) {
        // basic validator; it's assumed that every subclass would want this
        throw new NotFoundError(`ddoc ${doc._id} has no view named ${viewName}`);
      }

      ddocValidator(doc, viewName);
      checkQueryParseError(opts, fun);

      const view = await createView(
        /* sourceDB */ db,
        /* viewName */ fullViewName,
        /* mapFun */ fun.map,
        /* reduceFun */ fun.reduce,
        /* temporary */ false,
        /* localDocName */ localDocName);

      if (opts.stale === 'ok' || opts.stale === 'update_after') {
        if (opts.stale === 'update_after') {
          immediate(function () {
            updateView(view, updateViewOpts);
          });
        }
        return queryView(view, opts);
      } else { // stale not ok
        await updateView(view, updateViewOpts);
        return queryView(view, opts);
      }
    }
  }

  function abstractQuery(fun, opts, callback) {
    const db = this;
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    opts = opts ? coerceOptions(opts) : {};

    if (typeof fun === 'function') {
      fun = {map : fun};
    }

    const promise = Promise.resolve().then(function () {
      return queryPromised(db, fun, opts);
    });
    promisedCallback(promise, callback);
    return promise;
  }

  const abstractViewCleanup = callbackify(function () {
    const db = this;
    /* istanbul ignore next */
    if (typeof db._viewCleanup === 'function') {
      return customViewCleanup(db);
    }
    if (isRemote(db)) {
      return httpViewCleanup(db);
    }
    return localViewCleanup(db);
  });

  return {
    query: abstractQuery,
    viewCleanup: abstractViewCleanup
  };
}

export { createAbstractMapReduce as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG91Y2hkYi1hYnN0cmFjdC1tYXByZWR1Y2UuYnJvd3Nlci5qcyIsInNvdXJjZXMiOlsiLi4vcGFja2FnZXMvcG91Y2hkYi1hYnN0cmFjdC1tYXByZWR1Y2Uvc3JjL3Rhc2txdWV1ZS5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItYWJzdHJhY3QtbWFwcmVkdWNlL3NyYy9jcmVhdGVWaWV3U2lnbmF0dXJlLmpzIiwiLi4vcGFja2FnZXMvcG91Y2hkYi1hYnN0cmFjdC1tYXByZWR1Y2Uvc3JjL2NyZWF0ZVZpZXcuanMiLCIuLi9wYWNrYWdlcy9wb3VjaGRiLWFic3RyYWN0LW1hcHJlZHVjZS9zcmMvaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiLypcbiAqIFNpbXBsZSB0YXNrIHF1ZXVlIHRvIHNlcXVlbnRpYWxpemUgYWN0aW9ucy4gQXNzdW1lc1xuICogY2FsbGJhY2tzIHdpbGwgZXZlbnR1YWxseSBmaXJlIChvbmNlKS5cbiAqL1xuXG5cbmNsYXNzIFRhc2tRdWV1ZSB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMucHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uIChmdWxmaWxsKSB7ZnVsZmlsbCgpOyB9KTtcbiAgfVxuXG4gIGFkZChwcm9taXNlRmFjdG9yeSkge1xuICAgIHRoaXMucHJvbWlzZSA9IHRoaXMucHJvbWlzZS5jYXRjaChmdW5jdGlvbiAoKSB7XG4gICAgICAvLyBqdXN0IHJlY292ZXJcbiAgICB9KS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBwcm9taXNlRmFjdG9yeSgpO1xuICAgIH0pO1xuICAgIHJldHVybiB0aGlzLnByb21pc2U7XG4gIH1cblxuICBmaW5pc2goKSB7XG4gICAgcmV0dXJuIHRoaXMucHJvbWlzZTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBUYXNrUXVldWU7XG4iLCJmdW5jdGlvbiBzdHJpbmdpZnkoaW5wdXQpIHtcbiAgaWYgKCFpbnB1dCkge1xuICAgIHJldHVybiAndW5kZWZpbmVkJzsgLy8gYmFja3dhcmRzIGNvbXBhdCBmb3IgZW1wdHkgcmVkdWNlXG4gIH1cbiAgLy8gZm9yIGJhY2t3YXJkcyBjb21wYXQgd2l0aCBtYXByZWR1Y2UsIGZ1bmN0aW9ucy9zdHJpbmdzIGFyZSBzdHJpbmdpZmllZFxuICAvLyBhcy1pcy4gZXZlcnl0aGluZyBlbHNlIGlzIEpTT04tc3RyaW5naWZpZWQuXG4gIHN3aXRjaCAodHlwZW9mIGlucHV0KSB7XG4gICAgY2FzZSAnZnVuY3Rpb24nOlxuICAgICAgLy8gZS5nLiBhIG1hcHJlZHVjZSBtYXBcbiAgICAgIHJldHVybiBpbnB1dC50b1N0cmluZygpO1xuICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICAvLyBlLmcuIGEgbWFwcmVkdWNlIGJ1aWx0LWluIF9yZWR1Y2UgZnVuY3Rpb25cbiAgICAgIHJldHVybiBpbnB1dC50b1N0cmluZygpO1xuICAgIGRlZmF1bHQ6XG4gICAgICAvLyBlLmcuIGEgSlNPTiBvYmplY3QgaW4gdGhlIGNhc2Ugb2YgbWFuZ28gcXVlcmllc1xuICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGlucHV0KTtcbiAgfVxufVxuXG4vKiBjcmVhdGUgYSBzdHJpbmcgc2lnbmF0dXJlIGZvciBhIHZpZXcgc28gd2UgY2FuIGNhY2hlIGl0IGFuZCB1bmlxIGl0ICovXG5mdW5jdGlvbiBjcmVhdGVWaWV3U2lnbmF0dXJlKG1hcEZ1biwgcmVkdWNlRnVuKSB7XG4gIC8vIHRoZSBcInVuZGVmaW5lZFwiIHBhcnQgaXMgZm9yIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5XG4gIHJldHVybiBzdHJpbmdpZnkobWFwRnVuKSArIHN0cmluZ2lmeShyZWR1Y2VGdW4pICsgJ3VuZGVmaW5lZCc7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNyZWF0ZVZpZXdTaWduYXR1cmU7IiwiaW1wb3J0IHsgdXBzZXJ0IH0gZnJvbSAncG91Y2hkYi11dGlscyc7XG4vL2ltcG9ydCB7IHN0cmluZ01kNSB9IGZyb20gJ3BvdWNoZGItbWQ1JztcbmltcG9ydCBjcmVhdGVWaWV3U2lnbmF0dXJlIGZyb20gJy4vY3JlYXRlVmlld1NpZ25hdHVyZSc7XG5pbXBvcnQgeyBzdHJpbmdNZDUgfSBmcm9tICdwb3VjaGRiLWNyeXB0byc7XG5hc3luYyBmdW5jdGlvbiBjcmVhdGVWaWV3KHNvdXJjZURCLCB2aWV3TmFtZSwgbWFwRnVuLCByZWR1Y2VGdW4sIHRlbXBvcmFyeSwgbG9jYWxEb2NOYW1lKSB7XG4gIGNvbnN0IHZpZXdTaWduYXR1cmUgPSBjcmVhdGVWaWV3U2lnbmF0dXJlKG1hcEZ1biwgcmVkdWNlRnVuKTtcblxuICBsZXQgY2FjaGVkVmlld3M7XG4gIGlmICghdGVtcG9yYXJ5KSB7XG4gICAgLy8gY2FjaGUgdGhpcyB0byBlbnN1cmUgd2UgZG9uJ3QgdHJ5IHRvIHVwZGF0ZSB0aGUgc2FtZSB2aWV3IHR3aWNlXG4gICAgY2FjaGVkVmlld3MgPSBzb3VyY2VEQi5fY2FjaGVkVmlld3MgPSBzb3VyY2VEQi5fY2FjaGVkVmlld3MgfHwge307XG4gICAgaWYgKGNhY2hlZFZpZXdzW3ZpZXdTaWduYXR1cmVdKSB7XG4gICAgICByZXR1cm4gY2FjaGVkVmlld3Nbdmlld1NpZ25hdHVyZV07XG4gICAgfVxuICB9XG5cbiAgY29uc3QgcHJvbWlzZUZvclZpZXcgPSBzb3VyY2VEQi5pbmZvKCkudGhlbihhc3luYyBmdW5jdGlvbiAoaW5mbykge1xuICAgIGNvbnN0IGRlcERiTmFtZSA9IGluZm8uZGJfbmFtZSArICctbXJ2aWV3LScgK1xuICAgICh0ZW1wb3JhcnkgPyAndGVtcCcgOiBhd2FpdCBzdHJpbmdNZDUodmlld1NpZ25hdHVyZSkpO1xuXG4gICAgLy8gc2F2ZSB0aGUgdmlldyBuYW1lIGluIHRoZSBzb3VyY2UgZGIgc28gaXQgY2FuIGJlIGNsZWFuZWQgdXAgaWYgbmVjZXNzYXJ5XG4gICAgLy8gKGUuZy4gd2hlbiB0aGUgX2Rlc2lnbiBkb2MgaXMgZGVsZXRlZCwgcmVtb3ZlIGFsbCBhc3NvY2lhdGVkIHZpZXcgZGF0YSlcbiAgICBmdW5jdGlvbiBkaWZmRnVuY3Rpb24oZG9jKSB7XG4gICAgICBkb2Mudmlld3MgPSBkb2Mudmlld3MgfHwge307XG4gICAgICBsZXQgZnVsbFZpZXdOYW1lID0gdmlld05hbWU7XG4gICAgICBpZiAoZnVsbFZpZXdOYW1lLmluZGV4T2YoJy8nKSA9PT0gLTEpIHtcbiAgICAgICAgZnVsbFZpZXdOYW1lID0gdmlld05hbWUgKyAnLycgKyB2aWV3TmFtZTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGRlcERicyA9IGRvYy52aWV3c1tmdWxsVmlld05hbWVdID0gZG9jLnZpZXdzW2Z1bGxWaWV3TmFtZV0gfHwge307XG4gICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICAgIGlmIChkZXBEYnNbZGVwRGJOYW1lXSkge1xuICAgICAgICByZXR1cm47IC8vIG5vIHVwZGF0ZSBuZWNlc3NhcnlcbiAgICAgIH1cbiAgICAgIGRlcERic1tkZXBEYk5hbWVdID0gdHJ1ZTtcbiAgICAgIHJldHVybiBkb2M7XG4gICAgfVxuICAgIGF3YWl0IHVwc2VydChzb3VyY2VEQiwgJ19sb2NhbC8nICsgbG9jYWxEb2NOYW1lLCBkaWZmRnVuY3Rpb24pO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IHNvdXJjZURCLnJlZ2lzdGVyRGVwZW5kZW50RGF0YWJhc2UoZGVwRGJOYW1lKTtcbiAgICBjb25zdCBkYiA9IHJlcy5kYjtcbiAgICBkYi5hdXRvX2NvbXBhY3Rpb24gPSB0cnVlO1xuICAgIGNvbnN0IHZpZXcgPSB7XG4gICAgICBuYW1lOiBkZXBEYk5hbWUsXG4gICAgICBkYjogZGIsXG4gICAgICBzb3VyY2VEQjogc291cmNlREIsXG4gICAgICBhZGFwdGVyOiBzb3VyY2VEQi5hZGFwdGVyLFxuICAgICAgbWFwRnVuOiBtYXBGdW4sXG4gICAgICByZWR1Y2VGdW46IHJlZHVjZUZ1blxuICAgIH07XG5cbiAgICBsZXQgbGFzdFNlcURvYztcbiAgICB0cnkge1xuICAgICAgbGFzdFNlcURvYyA9IGF3YWl0IHZpZXcuZGIuZ2V0KCdfbG9jYWwvbGFzdFNlcScpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICAgIGlmIChlcnIuc3RhdHVzICE9PSA0MDQpIHtcbiAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgfVxuICAgIH1cblxuICAgIHZpZXcuc2VxID0gbGFzdFNlcURvYyA/IGxhc3RTZXFEb2Muc2VxIDogMDtcbiAgICBpZiAoY2FjaGVkVmlld3MpIHtcbiAgICAgIHZpZXcuZGIub25jZSgnZGVzdHJveWVkJywgZnVuY3Rpb24gKCkge1xuICAgICAgICBkZWxldGUgY2FjaGVkVmlld3Nbdmlld1NpZ25hdHVyZV07XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHZpZXc7XG4gIH0pO1xuXG4gIGlmIChjYWNoZWRWaWV3cykge1xuICAgIGNhY2hlZFZpZXdzW3ZpZXdTaWduYXR1cmVdID0gcHJvbWlzZUZvclZpZXc7XG4gIH1cbiAgcmV0dXJuIHByb21pc2VGb3JWaWV3O1xufVxuXG5leHBvcnQgZGVmYXVsdCBjcmVhdGVWaWV3O1xuIiwiaW1wb3J0IHtcbiAgZmxhdHRlbixcbiAgZ3VhcmRlZENvbnNvbGUsXG4gIG5leHRUaWNrLFxuICBpc1JlbW90ZVxufSBmcm9tICdwb3VjaGRiLXV0aWxzJztcblxuaW1wb3J0IHtcbiAgYmFzZTY0U3RyaW5nVG9CbG9iT3JCdWZmZXIgYXMgYjY0VG9CbHVmZmVyXG59IGZyb20gJ3BvdWNoZGItYmluYXJ5LXV0aWxzJztcblxuaW1wb3J0IHtcbiAgY29sbGF0ZSxcbiAgdG9JbmRleGFibGVTdHJpbmcsXG4gIG5vcm1hbGl6ZUtleSxcbiAgcGFyc2VJbmRleGFibGVTdHJpbmdcbn0gZnJvbSAncG91Y2hkYi1jb2xsYXRlJztcblxuaW1wb3J0IHsgZ2VuZXJhdGVFcnJvckZyb21SZXNwb25zZSB9IGZyb20gJ3BvdWNoZGItZXJyb3JzJztcbmltcG9ydCB7IEhlYWRlcnMgfSBmcm9tICdwb3VjaGRiLWZldGNoJztcbmltcG9ydCBUYXNrUXVldWUgZnJvbSAnLi90YXNrcXVldWUnO1xuaW1wb3J0IGNyZWF0ZVZpZXcgZnJvbSAnLi9jcmVhdGVWaWV3JztcbmltcG9ydCB7XG4gIGNhbGxiYWNraWZ5LFxuICBzZXF1ZW50aWFsaXplLFxuICB1bmlxLFxuICBmaW4sXG4gIHByb21pc2VkQ2FsbGJhY2ssXG4gIG1hcFRvS2V5c0FycmF5LFxuICBRdWVyeVBhcnNlRXJyb3IsXG4gIE5vdEZvdW5kRXJyb3IsXG4gIEJ1aWx0SW5FcnJvclxufSBmcm9tICdwb3VjaGRiLW1hcHJlZHVjZS11dGlscyc7XG5cbnZhciBwZXJzaXN0ZW50UXVldWVzID0ge307XG52YXIgdGVtcFZpZXdRdWV1ZSA9IG5ldyBUYXNrUXVldWUoKTtcbnZhciBDSEFOR0VTX0JBVENIX1NJWkUgPSA1MDtcblxuZnVuY3Rpb24gcGFyc2VWaWV3TmFtZShuYW1lKSB7XG4gIC8vIGNhbiBiZSBlaXRoZXIgJ2Rkb2NuYW1lL3ZpZXduYW1lJyBvciBqdXN0ICd2aWV3bmFtZSdcbiAgLy8gKHdoZXJlIHRoZSBkZG9jIG5hbWUgaXMgdGhlIHNhbWUpXG4gIHJldHVybiBuYW1lLmluZGV4T2YoJy8nKSA9PT0gLTEgPyBbbmFtZSwgbmFtZV0gOiBuYW1lLnNwbGl0KCcvJyk7XG59XG5cbmZ1bmN0aW9uIGlzR2VuT25lKGNoYW5nZXMpIHtcbiAgLy8gb25seSByZXR1cm4gdHJ1ZSBpZiB0aGUgY3VycmVudCBjaGFuZ2UgaXMgMS1cbiAgLy8gYW5kIHRoZXJlIGFyZSBubyBvdGhlciBsZWFmc1xuICByZXR1cm4gY2hhbmdlcy5sZW5ndGggPT09IDEgJiYgL14xLS8udGVzdChjaGFuZ2VzWzBdLnJldik7XG59XG5cbmZ1bmN0aW9uIGVtaXRFcnJvcihkYiwgZSwgZGF0YSkge1xuICB0cnkge1xuICAgIGRiLmVtaXQoJ2Vycm9yJywgZSk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGd1YXJkZWRDb25zb2xlKCdlcnJvcicsXG4gICAgICAnVGhlIHVzZXJcXCdzIG1hcC9yZWR1Y2UgZnVuY3Rpb24gdGhyZXcgYW4gdW5jYXVnaHQgZXJyb3IuXFxuJyArXG4gICAgICAnWW91IGNhbiBkZWJ1ZyB0aGlzIGVycm9yIGJ5IGRvaW5nOlxcbicgK1xuICAgICAgJ215RGF0YWJhc2Uub24oXFwnZXJyb3JcXCcsIGZ1bmN0aW9uIChlcnIpIHsgZGVidWdnZXI7IH0pO1xcbicgK1xuICAgICAgJ1BsZWFzZSBkb3VibGUtY2hlY2sgeW91ciBtYXAvcmVkdWNlIGZ1bmN0aW9uLicpO1xuICAgIGd1YXJkZWRDb25zb2xlKCdlcnJvcicsIGUsIGRhdGEpO1xuICB9XG59XG5cbi8qKlxuICogUmV0dXJucyBhbiBcImFic3RyYWN0XCIgbWFwcmVkdWNlIG9iamVjdCBvZiB0aGUgZm9ybTpcbiAqXG4gKiAgIHtcbiAqICAgICBxdWVyeTogcXVlcnlGdW4sXG4gKiAgICAgdmlld0NsZWFudXA6IHZpZXdDbGVhbnVwRnVuXG4gKiAgIH1cbiAqXG4gKiBBcmd1bWVudHMgYXJlOlxuICpcbiAqIGxvY2FsRG9jOiBzdHJpbmdcbiAqICAgVGhpcyBpcyBmb3IgdGhlIGxvY2FsIGRvYyB0aGF0IGdldHMgc2F2ZWQgaW4gb3JkZXIgdG8gdHJhY2sgdGhlXG4gKiAgIFwiZGVwZW5kZW50XCIgREJzIGFuZCBjbGVhbiB0aGVtIHVwIGZvciB2aWV3Q2xlYW51cC4gSXQgc2hvdWxkIGJlXG4gKiAgIHVuaXF1ZSwgc28gdGhhdCBpbmRleGVyIHBsdWdpbnMgZG9uJ3QgY29sbGlkZSB3aXRoIGVhY2ggb3RoZXIuXG4gKiBtYXBwZXI6IGZ1bmN0aW9uIChtYXBGdW5EZWYsIGVtaXQpXG4gKiAgIFJldHVybnMgYSBtYXAgZnVuY3Rpb24gYmFzZWQgb24gdGhlIG1hcEZ1bkRlZiwgd2hpY2ggaW4gdGhlIGNhc2Ugb2ZcbiAqICAgbm9ybWFsIG1hcC9yZWR1Y2UgaXMganVzdCB0aGUgZGUtc3RyaW5naWZpZWQgZnVuY3Rpb24sIGJ1dCBtYXkgYmVcbiAqICAgc29tZXRoaW5nIGVsc2UsIHN1Y2ggYXMgYW4gb2JqZWN0IGluIHRoZSBjYXNlIG9mIHBvdWNoZGItZmluZC5cbiAqIHJlZHVjZXI6IGZ1bmN0aW9uIChyZWR1Y2VGdW5EZWYpXG4gKiAgIERpdHRvLCBidXQgZm9yIHJlZHVjaW5nLiBNb2R1bGVzIGRvbid0IGhhdmUgdG8gc3VwcG9ydCByZWR1Y2luZ1xuICogICAoZS5nLiBwb3VjaGRiLWZpbmQpLlxuICogZGRvY1ZhbGlkYXRvcjogZnVuY3Rpb24gKGRkb2MsIHZpZXdOYW1lKVxuICogICBUaHJvd3MgYW4gZXJyb3IgaWYgdGhlIGRkb2Mgb3Igdmlld05hbWUgaXMgbm90IHZhbGlkLlxuICogICBUaGlzIGNvdWxkIGJlIGEgd2F5IHRvIGNvbW11bmljYXRlIHRvIHRoZSB1c2VyIHRoYXQgdGhlIGNvbmZpZ3VyYXRpb24gZm9yIHRoZVxuICogICBpbmRleGVyIGlzIGludmFsaWQuXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUFic3RyYWN0TWFwUmVkdWNlKGxvY2FsRG9jTmFtZSwgbWFwcGVyLCByZWR1Y2VyLCBkZG9jVmFsaWRhdG9yKSB7XG5cbiAgZnVuY3Rpb24gdHJ5TWFwKGRiLCBmdW4sIGRvYykge1xuICAgIC8vIGVtaXQgYW4gZXZlbnQgaWYgdGhlcmUgd2FzIGFuIGVycm9yIHRocm93biBieSBhIG1hcCBmdW5jdGlvbi5cbiAgICAvLyBwdXR0aW5nIHRyeS9jYXRjaGVzIGluIGEgc2luZ2xlIGZ1bmN0aW9uIGFsc28gYXZvaWRzIGRlb3B0aW1pemF0aW9ucy5cbiAgICB0cnkge1xuICAgICAgZnVuKGRvYyk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgZW1pdEVycm9yKGRiLCBlLCB7ZnVuOiBmdW4sIGRvYzogZG9jfSk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gdHJ5UmVkdWNlKGRiLCBmdW4sIGtleXMsIHZhbHVlcywgcmVyZWR1Y2UpIHtcbiAgICAvLyBzYW1lIGFzIGFib3ZlLCBidXQgcmV0dXJuaW5nIHRoZSByZXN1bHQgb3IgYW4gZXJyb3IuIHRoZXJlIGFyZSB0d28gc2VwYXJhdGVcbiAgICAvLyBmdW5jdGlvbnMgdG8gYXZvaWQgZXh0cmEgbWVtb3J5IGFsbG9jYXRpb25zIHNpbmNlIHRoZSB0cnlDb2RlKCkgY2FzZSBpcyB1c2VkXG4gICAgLy8gZm9yIGN1c3RvbSBtYXAgZnVuY3Rpb25zIChjb21tb24pIHZzIHRoaXMgZnVuY3Rpb24sIHdoaWNoIGlzIG9ubHkgdXNlZCBmb3JcbiAgICAvLyBjdXN0b20gcmVkdWNlIGZ1bmN0aW9ucyAocmFyZSlcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIHtvdXRwdXQgOiBmdW4oa2V5cywgdmFsdWVzLCByZXJlZHVjZSl9O1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGVtaXRFcnJvcihkYiwgZSwge2Z1bjogZnVuLCBrZXlzOiBrZXlzLCB2YWx1ZXM6IHZhbHVlcywgcmVyZWR1Y2U6IHJlcmVkdWNlfSk7XG4gICAgICByZXR1cm4ge2Vycm9yOiBlfTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBzb3J0QnlLZXlUaGVuVmFsdWUoeCwgeSkge1xuICAgIGNvbnN0IGtleUNvbXBhcmUgPSBjb2xsYXRlKHgua2V5LCB5LmtleSk7XG4gICAgcmV0dXJuIGtleUNvbXBhcmUgIT09IDAgPyBrZXlDb21wYXJlIDogY29sbGF0ZSh4LnZhbHVlLCB5LnZhbHVlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHNsaWNlUmVzdWx0cyhyZXN1bHRzLCBsaW1pdCwgc2tpcCkge1xuICAgIHNraXAgPSBza2lwIHx8IDA7XG4gICAgaWYgKHR5cGVvZiBsaW1pdCA9PT0gJ251bWJlcicpIHtcbiAgICAgIHJldHVybiByZXN1bHRzLnNsaWNlKHNraXAsIGxpbWl0ICsgc2tpcCk7XG4gICAgfSBlbHNlIGlmIChza2lwID4gMCkge1xuICAgICAgcmV0dXJuIHJlc3VsdHMuc2xpY2Uoc2tpcCk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHRzO1xuICB9XG5cbiAgZnVuY3Rpb24gcm93VG9Eb2NJZChyb3cpIHtcbiAgICBjb25zdCB2YWwgPSByb3cudmFsdWU7XG4gICAgLy8gVXNlcnMgY2FuIGV4cGxpY2l0bHkgc3BlY2lmeSBhIGpvaW5lZCBkb2MgX2lkLCBvciBpdFxuICAgIC8vIGRlZmF1bHRzIHRvIHRoZSBkb2MgX2lkIHRoYXQgZW1pdHRlZCB0aGUga2V5L3ZhbHVlLlxuICAgIGNvbnN0IGRvY0lkID0gKHZhbCAmJiB0eXBlb2YgdmFsID09PSAnb2JqZWN0JyAmJiB2YWwuX2lkKSB8fCByb3cuaWQ7XG4gICAgcmV0dXJuIGRvY0lkO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVhZEF0dGFjaG1lbnRzQXNCbG9iT3JCdWZmZXIocmVzKSB7XG4gICAgcmVzLnJvd3MuZm9yRWFjaChmdW5jdGlvbiAocm93KSB7XG4gICAgICBjb25zdCBhdHRzID0gcm93LmRvYyAmJiByb3cuZG9jLl9hdHRhY2htZW50cztcbiAgICAgIGlmICghYXR0cykge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBPYmplY3Qua2V5cyhhdHRzKS5mb3JFYWNoKGZ1bmN0aW9uIChmaWxlbmFtZSkge1xuICAgICAgICBjb25zdCBhdHQgPSBhdHRzW2ZpbGVuYW1lXTtcbiAgICAgICAgYXR0c1tmaWxlbmFtZV0uZGF0YSA9IGI2NFRvQmx1ZmZlcihhdHQuZGF0YSwgYXR0LmNvbnRlbnRfdHlwZSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHBvc3Rwcm9jZXNzQXR0YWNobWVudHMob3B0cykge1xuICAgIHJldHVybiBmdW5jdGlvbiAocmVzKSB7XG4gICAgICBpZiAob3B0cy5pbmNsdWRlX2RvY3MgJiYgb3B0cy5hdHRhY2htZW50cyAmJiBvcHRzLmJpbmFyeSkge1xuICAgICAgICByZWFkQXR0YWNobWVudHNBc0Jsb2JPckJ1ZmZlcihyZXMpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlcztcbiAgICB9O1xuICB9XG5cbiAgZnVuY3Rpb24gYWRkSHR0cFBhcmFtKHBhcmFtTmFtZSwgb3B0cywgcGFyYW1zLCBhc0pzb24pIHtcbiAgICAvLyBhZGQgYW4gaHR0cCBwYXJhbSBmcm9tIG9wdHMgdG8gcGFyYW1zLCBvcHRpb25hbGx5IGpzb24tZW5jb2RlZFxuICAgIGxldCB2YWwgPSBvcHRzW3BhcmFtTmFtZV07XG4gICAgaWYgKHR5cGVvZiB2YWwgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICBpZiAoYXNKc29uKSB7XG4gICAgICAgIHZhbCA9IGVuY29kZVVSSUNvbXBvbmVudChKU09OLnN0cmluZ2lmeSh2YWwpKTtcbiAgICAgIH1cbiAgICAgIHBhcmFtcy5wdXNoKHBhcmFtTmFtZSArICc9JyArIHZhbCk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gY29lcmNlSW50ZWdlcihpbnRlZ2VyQ2FuZGlkYXRlKSB7XG4gICAgaWYgKHR5cGVvZiBpbnRlZ2VyQ2FuZGlkYXRlICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgY29uc3QgYXNOdW1iZXIgPSBOdW1iZXIoaW50ZWdlckNhbmRpZGF0ZSk7XG4gICAgICAvLyBwcmV2ZW50cyBlLmcuICcxZm9vJyBvciAnMS4xJyBiZWluZyBjb2VyY2VkIHRvIDFcbiAgICAgIGlmICghaXNOYU4oYXNOdW1iZXIpICYmIGFzTnVtYmVyID09PSBwYXJzZUludChpbnRlZ2VyQ2FuZGlkYXRlLCAxMCkpIHtcbiAgICAgICAgcmV0dXJuIGFzTnVtYmVyO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGludGVnZXJDYW5kaWRhdGU7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gY29lcmNlT3B0aW9ucyhvcHRzKSB7XG4gICAgb3B0cy5ncm91cF9sZXZlbCA9IGNvZXJjZUludGVnZXIob3B0cy5ncm91cF9sZXZlbCk7XG4gICAgb3B0cy5saW1pdCA9IGNvZXJjZUludGVnZXIob3B0cy5saW1pdCk7XG4gICAgb3B0cy5za2lwID0gY29lcmNlSW50ZWdlcihvcHRzLnNraXApO1xuICAgIHJldHVybiBvcHRzO1xuICB9XG5cbiAgZnVuY3Rpb24gY2hlY2tQb3NpdGl2ZUludGVnZXIobnVtYmVyKSB7XG4gICAgaWYgKG51bWJlcikge1xuICAgICAgaWYgKHR5cGVvZiBudW1iZXIgIT09ICdudW1iZXInKSB7XG4gICAgICAgIHJldHVybiAgbmV3IFF1ZXJ5UGFyc2VFcnJvcihgSW52YWxpZCB2YWx1ZSBmb3IgaW50ZWdlcjogXCIke251bWJlcn1cImApO1xuICAgICAgfVxuICAgICAgaWYgKG51bWJlciA8IDApIHtcbiAgICAgICAgcmV0dXJuIG5ldyBRdWVyeVBhcnNlRXJyb3IoYEludmFsaWQgdmFsdWUgZm9yIHBvc2l0aXZlIGludGVnZXI6IFwiJHtudW1iZXJ9XCJgKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBjaGVja1F1ZXJ5UGFyc2VFcnJvcihvcHRpb25zLCBmdW4pIHtcbiAgICBjb25zdCBzdGFydGtleU5hbWUgPSBvcHRpb25zLmRlc2NlbmRpbmcgPyAnZW5ka2V5JyA6ICdzdGFydGtleSc7XG4gICAgY29uc3QgZW5ka2V5TmFtZSA9IG9wdGlvbnMuZGVzY2VuZGluZyA/ICdzdGFydGtleScgOiAnZW5ka2V5JztcblxuICAgIGlmICh0eXBlb2Ygb3B0aW9uc1tzdGFydGtleU5hbWVdICE9PSAndW5kZWZpbmVkJyAmJlxuICAgICAgdHlwZW9mIG9wdGlvbnNbZW5ka2V5TmFtZV0gIT09ICd1bmRlZmluZWQnICYmXG4gICAgICBjb2xsYXRlKG9wdGlvbnNbc3RhcnRrZXlOYW1lXSwgb3B0aW9uc1tlbmRrZXlOYW1lXSkgPiAwKSB7XG4gICAgICB0aHJvdyBuZXcgUXVlcnlQYXJzZUVycm9yKCdObyByb3dzIGNhbiBtYXRjaCB5b3VyIGtleSByYW5nZSwgJyArXG4gICAgICAgICdyZXZlcnNlIHlvdXIgc3RhcnRfa2V5IGFuZCBlbmRfa2V5IG9yIHNldCB7ZGVzY2VuZGluZyA6IHRydWV9Jyk7XG4gICAgfSBlbHNlIGlmIChmdW4ucmVkdWNlICYmIG9wdGlvbnMucmVkdWNlICE9PSBmYWxzZSkge1xuICAgICAgaWYgKG9wdGlvbnMuaW5jbHVkZV9kb2NzKSB7XG4gICAgICAgIHRocm93IG5ldyBRdWVyeVBhcnNlRXJyb3IoJ3tpbmNsdWRlX2RvY3M6dHJ1ZX0gaXMgaW52YWxpZCBmb3IgcmVkdWNlJyk7XG4gICAgICB9IGVsc2UgaWYgKG9wdGlvbnMua2V5cyAmJiBvcHRpb25zLmtleXMubGVuZ3RoID4gMSAmJlxuICAgICAgICAhb3B0aW9ucy5ncm91cCAmJiAhb3B0aW9ucy5ncm91cF9sZXZlbCkge1xuICAgICAgICB0aHJvdyBuZXcgUXVlcnlQYXJzZUVycm9yKCdNdWx0aS1rZXkgZmV0Y2hlcyBmb3IgcmVkdWNlIHZpZXdzIG11c3QgdXNlICcgK1xuICAgICAgICAgICd7Z3JvdXA6IHRydWV9Jyk7XG4gICAgICB9XG4gICAgfVxuICAgIFsnZ3JvdXBfbGV2ZWwnLCAnbGltaXQnLCAnc2tpcCddLmZvckVhY2goZnVuY3Rpb24gKG9wdGlvbk5hbWUpIHtcbiAgICAgIGNvbnN0IGVycm9yID0gY2hlY2tQb3NpdGl2ZUludGVnZXIob3B0aW9uc1tvcHRpb25OYW1lXSk7XG4gICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBhc3luYyBmdW5jdGlvbiBodHRwUXVlcnkoZGIsIGZ1biwgb3B0cykge1xuICAgIC8vIExpc3Qgb2YgcGFyYW1ldGVycyB0byBhZGQgdG8gdGhlIFBVVCByZXF1ZXN0XG4gICAgbGV0IHBhcmFtcyA9IFtdO1xuICAgIGxldCBib2R5O1xuICAgIGxldCBtZXRob2QgPSAnR0VUJztcbiAgICBsZXQgb2s7XG5cbiAgICAvLyBJZiBvcHRzLnJlZHVjZSBleGlzdHMgYW5kIGlzIGRlZmluZWQsIHRoZW4gYWRkIGl0IHRvIHRoZSBsaXN0XG4gICAgLy8gb2YgcGFyYW1ldGVycy5cbiAgICAvLyBJZiByZWR1Y2U9ZmFsc2UgdGhlbiB0aGUgcmVzdWx0cyBhcmUgdGhhdCBvZiBvbmx5IHRoZSBtYXAgZnVuY3Rpb25cbiAgICAvLyBub3QgdGhlIGZpbmFsIHJlc3VsdCBvZiBtYXAgYW5kIHJlZHVjZS5cbiAgICBhZGRIdHRwUGFyYW0oJ3JlZHVjZScsIG9wdHMsIHBhcmFtcyk7XG4gICAgYWRkSHR0cFBhcmFtKCdpbmNsdWRlX2RvY3MnLCBvcHRzLCBwYXJhbXMpO1xuICAgIGFkZEh0dHBQYXJhbSgnYXR0YWNobWVudHMnLCBvcHRzLCBwYXJhbXMpO1xuICAgIGFkZEh0dHBQYXJhbSgnbGltaXQnLCBvcHRzLCBwYXJhbXMpO1xuICAgIGFkZEh0dHBQYXJhbSgnZGVzY2VuZGluZycsIG9wdHMsIHBhcmFtcyk7XG4gICAgYWRkSHR0cFBhcmFtKCdncm91cCcsIG9wdHMsIHBhcmFtcyk7XG4gICAgYWRkSHR0cFBhcmFtKCdncm91cF9sZXZlbCcsIG9wdHMsIHBhcmFtcyk7XG4gICAgYWRkSHR0cFBhcmFtKCdza2lwJywgb3B0cywgcGFyYW1zKTtcbiAgICBhZGRIdHRwUGFyYW0oJ3N0YWxlJywgb3B0cywgcGFyYW1zKTtcbiAgICBhZGRIdHRwUGFyYW0oJ2NvbmZsaWN0cycsIG9wdHMsIHBhcmFtcyk7XG4gICAgYWRkSHR0cFBhcmFtKCdzdGFydGtleScsIG9wdHMsIHBhcmFtcywgdHJ1ZSk7XG4gICAgYWRkSHR0cFBhcmFtKCdzdGFydF9rZXknLCBvcHRzLCBwYXJhbXMsIHRydWUpO1xuICAgIGFkZEh0dHBQYXJhbSgnZW5ka2V5Jywgb3B0cywgcGFyYW1zLCB0cnVlKTtcbiAgICBhZGRIdHRwUGFyYW0oJ2VuZF9rZXknLCBvcHRzLCBwYXJhbXMsIHRydWUpO1xuICAgIGFkZEh0dHBQYXJhbSgnaW5jbHVzaXZlX2VuZCcsIG9wdHMsIHBhcmFtcyk7XG4gICAgYWRkSHR0cFBhcmFtKCdrZXknLCBvcHRzLCBwYXJhbXMsIHRydWUpO1xuICAgIGFkZEh0dHBQYXJhbSgndXBkYXRlX3NlcScsIG9wdHMsIHBhcmFtcyk7XG5cbiAgICAvLyBGb3JtYXQgdGhlIGxpc3Qgb2YgcGFyYW1ldGVycyBpbnRvIGEgdmFsaWQgVVJJIHF1ZXJ5IHN0cmluZ1xuICAgIHBhcmFtcyA9IHBhcmFtcy5qb2luKCcmJyk7XG4gICAgcGFyYW1zID0gcGFyYW1zID09PSAnJyA/ICcnIDogJz8nICsgcGFyYW1zO1xuXG4gICAgLy8gSWYga2V5cyBhcmUgc3VwcGxpZWQsIGlzc3VlIGEgUE9TVCB0byBjaXJjdW12ZW50IEdFVCBxdWVyeSBzdHJpbmcgbGltaXRzXG4gICAgLy8gc2VlIGh0dHA6Ly93aWtpLmFwYWNoZS5vcmcvY291Y2hkYi9IVFRQX3ZpZXdfQVBJI1F1ZXJ5aW5nX09wdGlvbnNcbiAgICBpZiAodHlwZW9mIG9wdHMua2V5cyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIGNvbnN0IE1BWF9VUkxfTEVOR1RIID0gMjAwMDtcbiAgICAgIC8vIGFjY29yZGluZyB0byBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS80MTcxODQvNjgwNzQyLFxuICAgICAgLy8gdGhlIGRlIGZhY3RvIFVSTCBsZW5ndGggbGltaXQgaXMgMjAwMCBjaGFyYWN0ZXJzXG5cbiAgICAgIGNvbnN0IGtleXNBc1N0cmluZyA9IGBrZXlzPSR7ZW5jb2RlVVJJQ29tcG9uZW50KEpTT04uc3RyaW5naWZ5KG9wdHMua2V5cykpfWA7XG4gICAgICBpZiAoa2V5c0FzU3RyaW5nLmxlbmd0aCArIHBhcmFtcy5sZW5ndGggKyAxIDw9IE1BWF9VUkxfTEVOR1RIKSB7XG4gICAgICAgIC8vIElmIHRoZSBrZXlzIGFyZSBzaG9ydCBlbm91Z2gsIGRvIGEgR0VULiB3ZSBkbyB0aGlzIHRvIHdvcmsgYXJvdW5kXG4gICAgICAgIC8vIFNhZmFyaSBub3QgdW5kZXJzdGFuZGluZyAzMDRzIG9uIFBPU1RzIChzZWUgcG91Y2hkYi9wb3VjaGRiIzEyMzkpXG4gICAgICAgIHBhcmFtcyArPSAocGFyYW1zWzBdID09PSAnPycgPyAnJicgOiAnPycpICsga2V5c0FzU3RyaW5nO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbWV0aG9kID0gJ1BPU1QnO1xuICAgICAgICBpZiAodHlwZW9mIGZ1biA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICBib2R5ID0ge2tleXM6IG9wdHMua2V5c307XG4gICAgICAgIH0gZWxzZSB7IC8vIGZ1biBpcyB7bWFwIDogbWFwZnVufSwgc28gYXBwZW5kIHRvIHRoaXNcbiAgICAgICAgICBmdW4ua2V5cyA9IG9wdHMua2V5cztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFdlIGFyZSByZWZlcmVuY2luZyBhIHF1ZXJ5IGRlZmluZWQgaW4gdGhlIGRlc2lnbiBkb2NcbiAgICBpZiAodHlwZW9mIGZ1biA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGNvbnN0IHBhcnRzID0gcGFyc2VWaWV3TmFtZShmdW4pO1xuXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGRiLmZldGNoKCdfZGVzaWduLycgKyBwYXJ0c1swXSArICcvX3ZpZXcvJyArIHBhcnRzWzFdICsgcGFyYW1zLCB7XG4gICAgICAgIGhlYWRlcnM6IG5ldyBIZWFkZXJzKHsnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nfSksXG4gICAgICAgIG1ldGhvZDogbWV0aG9kLFxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShib2R5KVxuICAgICAgfSk7XG4gICAgICBvayA9IHJlc3BvbnNlLm9rO1xuICAgICAgLy8gc3RhdHVzID0gcmVzcG9uc2Uuc3RhdHVzO1xuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuXG4gICAgICBpZiAoIW9rKSB7XG4gICAgICAgIHJlc3VsdC5zdGF0dXMgPSByZXNwb25zZS5zdGF0dXM7XG4gICAgICAgIHRocm93IGdlbmVyYXRlRXJyb3JGcm9tUmVzcG9uc2UocmVzdWx0KTtcbiAgICAgIH1cblxuICAgICAgLy8gZmFpbCB0aGUgZW50aXJlIHJlcXVlc3QgaWYgdGhlIHJlc3VsdCBjb250YWlucyBhbiBlcnJvclxuICAgICAgcmVzdWx0LnJvd3MuZm9yRWFjaChmdW5jdGlvbiAocm93KSB7XG4gICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgICAgICBpZiAocm93LnZhbHVlICYmIHJvdy52YWx1ZS5lcnJvciAmJiByb3cudmFsdWUuZXJyb3IgPT09IFwiYnVpbHRpbl9yZWR1Y2VfZXJyb3JcIikge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihyb3cucmVhc29uKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSkge1xuICAgICAgICByZXNvbHZlKHJlc3VsdCk7XG4gICAgICB9KS50aGVuKHBvc3Rwcm9jZXNzQXR0YWNobWVudHMob3B0cykpO1xuICAgIH1cblxuICAgIC8vIFdlIGFyZSB1c2luZyBhIHRlbXBvcmFyeSB2aWV3LCB0ZXJyaWJsZSBmb3IgcGVyZm9ybWFuY2UsIGdvb2QgZm9yIHRlc3RpbmdcbiAgICBib2R5ID0gYm9keSB8fCB7fTtcbiAgICBPYmplY3Qua2V5cyhmdW4pLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoZnVuW2tleV0pKSB7XG4gICAgICAgIGJvZHlba2V5XSA9IGZ1bltrZXldO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYm9keVtrZXldID0gZnVuW2tleV0udG9TdHJpbmcoKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZGIuZmV0Y2goJ190ZW1wX3ZpZXcnICsgcGFyYW1zLCB7XG4gICAgICBoZWFkZXJzOiBuZXcgSGVhZGVycyh7J0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJ30pLFxuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShib2R5KVxuICAgIH0pO1xuXG4gICAgb2sgPSByZXNwb25zZS5vaztcbiAgICAvLyBzdGF0dXMgPSByZXNwb25zZS5zdGF0dXM7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgIGlmICghb2spIHtcbiAgICAgIHJlc3VsdC5zdGF0dXMgPSByZXNwb25zZS5zdGF0dXM7XG4gICAgICB0aHJvdyBnZW5lcmF0ZUVycm9yRnJvbVJlc3BvbnNlKHJlc3VsdCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlKSB7XG4gICAgICByZXNvbHZlKHJlc3VsdCk7XG4gICAgfSkudGhlbihwb3N0cHJvY2Vzc0F0dGFjaG1lbnRzKG9wdHMpKTtcbiAgfVxuXG4gIC8vIGN1c3RvbSBhZGFwdGVycyBjYW4gZGVmaW5lIHRoZWlyIG93biBhcGkuX3F1ZXJ5XG4gIC8vIGFuZCBvdmVycmlkZSB0aGUgZGVmYXVsdCBiZWhhdmlvclxuICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICBmdW5jdGlvbiBjdXN0b21RdWVyeShkYiwgZnVuLCBvcHRzKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgIGRiLl9xdWVyeShmdW4sIG9wdHMsIGZ1bmN0aW9uIChlcnIsIHJlcykge1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgcmV0dXJuIHJlamVjdChlcnIpO1xuICAgICAgICB9XG4gICAgICAgIHJlc29sdmUocmVzKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLy8gY3VzdG9tIGFkYXB0ZXJzIGNhbiBkZWZpbmUgdGhlaXIgb3duIGFwaS5fdmlld0NsZWFudXBcbiAgLy8gYW5kIG92ZXJyaWRlIHRoZSBkZWZhdWx0IGJlaGF2aW9yXG4gIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gIGZ1bmN0aW9uIGN1c3RvbVZpZXdDbGVhbnVwKGRiKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgIGRiLl92aWV3Q2xlYW51cChmdW5jdGlvbiAoZXJyLCByZXMpIHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgIHJldHVybiByZWplY3QoZXJyKTtcbiAgICAgICAgfVxuICAgICAgICByZXNvbHZlKHJlcyk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRlZmF1bHRzVG8odmFsdWUpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKHJlYXNvbikge1xuICAgICAgLyogaXN0YW5idWwgaWdub3JlIGVsc2UgKi9cbiAgICAgIGlmIChyZWFzb24uc3RhdHVzID09PSA0MDQpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgcmVhc29uO1xuICAgICAgfVxuICAgIH07XG4gIH1cblxuICAvLyByZXR1cm5zIGEgcHJvbWlzZSBmb3IgYSBsaXN0IG9mIGRvY3MgdG8gdXBkYXRlLCBiYXNlZCBvbiB0aGUgaW5wdXQgZG9jSWQuXG4gIC8vIHRoZSBvcmRlciBkb2Vzbid0IG1hdHRlciwgYmVjYXVzZSBwb3N0LTMuMi4wLCBidWxrRG9jc1xuICAvLyBpcyBhbiBhdG9taWMgb3BlcmF0aW9uIGluIGFsbCB0aHJlZSBhZGFwdGVycy5cbiAgYXN5bmMgZnVuY3Rpb24gZ2V0RG9jc1RvUGVyc2lzdChkb2NJZCwgdmlldywgZG9jSWRzVG9DaGFuZ2VzQW5kRW1pdHMpIHtcbiAgICBjb25zdCBtZXRhRG9jSWQgPSAnX2xvY2FsL2RvY18nICsgZG9jSWQ7XG4gICAgY29uc3QgZGVmYXVsdE1ldGFEb2MgPSB7X2lkOiBtZXRhRG9jSWQsIGtleXM6IFtdfTtcbiAgICBjb25zdCBkb2NEYXRhID0gZG9jSWRzVG9DaGFuZ2VzQW5kRW1pdHMuZ2V0KGRvY0lkKTtcbiAgICBjb25zdCBpbmRleGFibGVLZXlzVG9LZXlWYWx1ZXMgPSBkb2NEYXRhWzBdO1xuICAgIGNvbnN0IGNoYW5nZXMgPSBkb2NEYXRhWzFdO1xuXG4gICAgZnVuY3Rpb24gZ2V0TWV0YURvYygpIHtcbiAgICAgIGlmIChpc0dlbk9uZShjaGFuZ2VzKSkge1xuICAgICAgICAvLyBnZW5lcmF0aW9uIDEsIHNvIHdlIGNhbiBzYWZlbHkgYXNzdW1lIGluaXRpYWwgc3RhdGVcbiAgICAgICAgLy8gZm9yIHBlcmZvcm1hbmNlIHJlYXNvbnMgKGF2b2lkcyB1bm5lY2Vzc2FyeSBHRVRzKVxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGRlZmF1bHRNZXRhRG9jKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB2aWV3LmRiLmdldChtZXRhRG9jSWQpLmNhdGNoKGRlZmF1bHRzVG8oZGVmYXVsdE1ldGFEb2MpKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRLZXlWYWx1ZURvY3MobWV0YURvYykge1xuICAgICAgaWYgKCFtZXRhRG9jLmtleXMubGVuZ3RoKSB7XG4gICAgICAgIC8vIG5vIGtleXMsIG5vIG5lZWQgZm9yIGEgbG9va3VwXG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoe3Jvd3M6IFtdfSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdmlldy5kYi5hbGxEb2NzKHtcbiAgICAgICAga2V5czogbWV0YURvYy5rZXlzLFxuICAgICAgICBpbmNsdWRlX2RvY3M6IHRydWVcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHByb2Nlc3NLZXlWYWx1ZURvY3MobWV0YURvYywga3ZEb2NzUmVzKSB7XG4gICAgICBjb25zdCBrdkRvY3MgPSBbXTtcbiAgICAgIGNvbnN0IG9sZEtleXMgPSBuZXcgU2V0KCk7XG5cbiAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBrdkRvY3NSZXMucm93cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICBjb25zdCByb3cgPSBrdkRvY3NSZXMucm93c1tpXTtcbiAgICAgICAgY29uc3QgZG9jID0gcm93LmRvYztcbiAgICAgICAgaWYgKCFkb2MpIHsgLy8gZGVsZXRlZFxuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGt2RG9jcy5wdXNoKGRvYyk7XG4gICAgICAgIG9sZEtleXMuYWRkKGRvYy5faWQpO1xuICAgICAgICBkb2MuX2RlbGV0ZWQgPSAhaW5kZXhhYmxlS2V5c1RvS2V5VmFsdWVzLmhhcyhkb2MuX2lkKTtcbiAgICAgICAgaWYgKCFkb2MuX2RlbGV0ZWQpIHtcbiAgICAgICAgICBjb25zdCBrZXlWYWx1ZSA9IGluZGV4YWJsZUtleXNUb0tleVZhbHVlcy5nZXQoZG9jLl9pZCk7XG4gICAgICAgICAgaWYgKCd2YWx1ZScgaW4ga2V5VmFsdWUpIHtcbiAgICAgICAgICAgIGRvYy52YWx1ZSA9IGtleVZhbHVlLnZhbHVlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgY29uc3QgbmV3S2V5cyA9IG1hcFRvS2V5c0FycmF5KGluZGV4YWJsZUtleXNUb0tleVZhbHVlcyk7XG4gICAgICBuZXdLZXlzLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgICAgICBpZiAoIW9sZEtleXMuaGFzKGtleSkpIHtcbiAgICAgICAgICAvLyBuZXcgZG9jXG4gICAgICAgICAgY29uc3Qga3ZEb2MgPSB7XG4gICAgICAgICAgICBfaWQ6IGtleVxuICAgICAgICAgIH07XG4gICAgICAgICAgY29uc3Qga2V5VmFsdWUgPSBpbmRleGFibGVLZXlzVG9LZXlWYWx1ZXMuZ2V0KGtleSk7XG4gICAgICAgICAgaWYgKCd2YWx1ZScgaW4ga2V5VmFsdWUpIHtcbiAgICAgICAgICAgIGt2RG9jLnZhbHVlID0ga2V5VmFsdWUudmFsdWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIGt2RG9jcy5wdXNoKGt2RG9jKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBtZXRhRG9jLmtleXMgPSB1bmlxKG5ld0tleXMuY29uY2F0KG1ldGFEb2Mua2V5cykpO1xuICAgICAga3ZEb2NzLnB1c2gobWV0YURvYyk7XG5cbiAgICAgIHJldHVybiBrdkRvY3M7XG4gICAgfVxuXG4gICAgY29uc3QgbWV0YURvYyA9IGF3YWl0IGdldE1ldGFEb2MoKTtcbiAgICBjb25zdCBrZXlWYWx1ZURvY3MgPSBhd2FpdCBnZXRLZXlWYWx1ZURvY3MobWV0YURvYyk7XG4gICAgcmV0dXJuIHByb2Nlc3NLZXlWYWx1ZURvY3MobWV0YURvYywga2V5VmFsdWVEb2NzKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHVwZGF0ZVB1cmdlU2VxKHZpZXcpIHtcbiAgICAvLyB3aXRoIHRoaXMgYXBwcm9hY2gsIHdlIGp1c3QgYXNzdW1lIHRvIGhhdmUgcHJvY2Vzc2VkIGFsbCBtaXNzaW5nIHB1cmdlcyBhbmQgd3JpdGUgdGhlIGxhdGVzdFxuICAgIC8vIHB1cmdlU2VxIGludG8gdGhlIF9sb2NhbC9wdXJnZVNlcSBkb2MuXG4gICAgcmV0dXJuIHZpZXcuc291cmNlREIuZ2V0KCdfbG9jYWwvcHVyZ2VzJykudGhlbihmdW5jdGlvbiAocmVzKSB7XG4gICAgICBjb25zdCBwdXJnZVNlcSA9IHJlcy5wdXJnZVNlcTtcbiAgICAgIHJldHVybiB2aWV3LmRiLmdldCgnX2xvY2FsL3B1cmdlU2VxJykudGhlbihmdW5jdGlvbiAocmVzKSB7XG4gICAgICAgIHJldHVybiByZXMuX3JldjtcbiAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgaWYgKGVyci5zdGF0dXMgIT09IDQwNCkge1xuICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgfSkudGhlbihmdW5jdGlvbiAocmV2KSB7XG4gICAgICAgIHJldHVybiB2aWV3LmRiLnB1dCh7XG4gICAgICAgICAgX2lkOiAnX2xvY2FsL3B1cmdlU2VxJyxcbiAgICAgICAgICBfcmV2OiByZXYsXG4gICAgICAgICAgcHVyZ2VTZXEsXG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfSkuY2F0Y2goZnVuY3Rpb24gKGVycikge1xuICAgICAgaWYgKGVyci5zdGF0dXMgIT09IDQwNCkge1xuICAgICAgICB0aHJvdyBlcnI7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvLyB1cGRhdGVzIGFsbCBlbWl0dGVkIGtleS92YWx1ZSBkb2NzIGFuZCBtZXRhRG9jcyBpbiB0aGUgbXJ2aWV3IGRhdGFiYXNlXG4gIC8vIGZvciB0aGUgZ2l2ZW4gYmF0Y2ggb2YgZG9jdW1lbnRzIGZyb20gdGhlIHNvdXJjZSBkYXRhYmFzZVxuICBmdW5jdGlvbiBzYXZlS2V5VmFsdWVzKHZpZXcsIGRvY0lkc1RvQ2hhbmdlc0FuZEVtaXRzLCBzZXEpIHtcbiAgICB2YXIgc2VxRG9jSWQgPSAnX2xvY2FsL2xhc3RTZXEnO1xuICAgIHJldHVybiB2aWV3LmRiLmdldChzZXFEb2NJZClcbiAgICAgIC5jYXRjaChkZWZhdWx0c1RvKHtfaWQ6IHNlcURvY0lkLCBzZXE6IDB9KSlcbiAgICAgIC50aGVuKGZ1bmN0aW9uIChsYXN0U2VxRG9jKSB7XG4gICAgICAgIHZhciBkb2NJZHMgPSBtYXBUb0tleXNBcnJheShkb2NJZHNUb0NoYW5nZXNBbmRFbWl0cyk7XG4gICAgICAgIHJldHVybiBQcm9taXNlLmFsbChkb2NJZHMubWFwKGZ1bmN0aW9uIChkb2NJZCkge1xuICAgICAgICAgIHJldHVybiBnZXREb2NzVG9QZXJzaXN0KGRvY0lkLCB2aWV3LCBkb2NJZHNUb0NoYW5nZXNBbmRFbWl0cyk7XG4gICAgICAgIH0pKS50aGVuKGZ1bmN0aW9uIChsaXN0T2ZEb2NzVG9QZXJzaXN0KSB7XG4gICAgICAgICAgdmFyIGRvY3NUb1BlcnNpc3QgPSBmbGF0dGVuKGxpc3RPZkRvY3NUb1BlcnNpc3QpO1xuICAgICAgICAgIGxhc3RTZXFEb2Muc2VxID0gc2VxO1xuICAgICAgICAgIGRvY3NUb1BlcnNpc3QucHVzaChsYXN0U2VxRG9jKTtcbiAgICAgICAgICAvLyB3cml0ZSBhbGwgZG9jcyBpbiBhIHNpbmdsZSBvcGVyYXRpb24sIHVwZGF0ZSB0aGUgc2VxIG9uY2VcbiAgICAgICAgICByZXR1cm4gdmlldy5kYi5idWxrRG9jcyh7ZG9jcyA6IGRvY3NUb1BlcnNpc3R9KTtcbiAgICAgICAgfSlcbiAgICAgICAgICAvLyBUT0RPOiB0aGlzIHNob3VsZCBiZSBwbGFjZWQgc29tZXdoZXJlIGVsc2UsIHByb2JhYmx5PyB3ZSdyZSBxdWVyeWluZyBib3RoIGRvY3MgdHdpY2VcbiAgICAgICAgICAvLyAgIChmaXJzdCB0aW1lIHdoZW4gZ2V0dGluZyB0aGUgYWN0dWFsIHB1cmdlcykuXG4gICAgICAgICAgLnRoZW4oKCkgPT4gdXBkYXRlUHVyZ2VTZXEodmlldykpO1xuICAgICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBnZXRRdWV1ZSh2aWV3KSB7XG4gICAgY29uc3Qgdmlld05hbWUgPSB0eXBlb2YgdmlldyA9PT0gJ3N0cmluZycgPyB2aWV3IDogdmlldy5uYW1lO1xuICAgIGxldCBxdWV1ZSA9IHBlcnNpc3RlbnRRdWV1ZXNbdmlld05hbWVdO1xuICAgIGlmICghcXVldWUpIHtcbiAgICAgIHF1ZXVlID0gcGVyc2lzdGVudFF1ZXVlc1t2aWV3TmFtZV0gPSBuZXcgVGFza1F1ZXVlKCk7XG4gICAgfVxuICAgIHJldHVybiBxdWV1ZTtcbiAgfVxuXG4gIGFzeW5jIGZ1bmN0aW9uIHVwZGF0ZVZpZXcodmlldywgb3B0cykge1xuICAgIHJldHVybiBzZXF1ZW50aWFsaXplKGdldFF1ZXVlKHZpZXcpLCBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gdXBkYXRlVmlld0luUXVldWUodmlldywgb3B0cyk7XG4gICAgfSkoKTtcbiAgfVxuXG4gIGFzeW5jIGZ1bmN0aW9uIHVwZGF0ZVZpZXdJblF1ZXVlKHZpZXcsIG9wdHMpIHtcbiAgICAvLyBiaW5kIHRoZSBlbWl0IGZ1bmN0aW9uIG9uY2VcbiAgICBsZXQgbWFwUmVzdWx0cztcbiAgICBsZXQgZG9jO1xuICAgIGxldCB0YXNrSWQ7XG5cbiAgICBmdW5jdGlvbiBlbWl0KGtleSwgdmFsdWUpIHtcbiAgICAgIGNvbnN0IG91dHB1dCA9IHtpZDogZG9jLl9pZCwga2V5OiBub3JtYWxpemVLZXkoa2V5KX07XG4gICAgICAvLyBEb24ndCBleHBsaWNpdGx5IHN0b3JlIHRoZSB2YWx1ZSB1bmxlc3MgaXQncyBkZWZpbmVkIGFuZCBub24tbnVsbC5cbiAgICAgIC8vIFRoaXMgc2F2ZXMgb24gc3RvcmFnZSBzcGFjZSwgYmVjYXVzZSBvZnRlbiBwZW9wbGUgZG9uJ3QgdXNlIGl0LlxuICAgICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3VuZGVmaW5lZCcgJiYgdmFsdWUgIT09IG51bGwpIHtcbiAgICAgICAgb3V0cHV0LnZhbHVlID0gbm9ybWFsaXplS2V5KHZhbHVlKTtcbiAgICAgIH1cbiAgICAgIG1hcFJlc3VsdHMucHVzaChvdXRwdXQpO1xuICAgIH1cblxuICAgIGNvbnN0IG1hcEZ1biA9IG1hcHBlcih2aWV3Lm1hcEZ1biwgZW1pdCk7XG5cbiAgICBsZXQgY3VycmVudFNlcSA9IHZpZXcuc2VxIHx8IDA7XG5cbiAgICBmdW5jdGlvbiBjcmVhdGVUYXNrKCkge1xuICAgICAgcmV0dXJuIHZpZXcuc291cmNlREIuaW5mbygpLnRoZW4oZnVuY3Rpb24gKGluZm8pIHtcbiAgICAgICAgdGFza0lkID0gdmlldy5zb3VyY2VEQi5hY3RpdmVUYXNrcy5hZGQoe1xuICAgICAgICAgIG5hbWU6ICd2aWV3X2luZGV4aW5nJyxcbiAgICAgICAgICB0b3RhbF9pdGVtczogaW5mby51cGRhdGVfc2VxIC0gY3VycmVudFNlcSxcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwcm9jZXNzQ2hhbmdlKGRvY0lkc1RvQ2hhbmdlc0FuZEVtaXRzLCBzZXEpIHtcbiAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBzYXZlS2V5VmFsdWVzKHZpZXcsIGRvY0lkc1RvQ2hhbmdlc0FuZEVtaXRzLCBzZXEpO1xuICAgICAgfTtcbiAgICB9XG5cbiAgICBsZXQgaW5kZXhlZF9kb2NzID0gMDtcbiAgICBjb25zdCBwcm9ncmVzcyA9IHtcbiAgICAgIHZpZXc6IHZpZXcubmFtZSxcbiAgICAgIGluZGV4ZWRfZG9jczogaW5kZXhlZF9kb2NzXG4gICAgfTtcbiAgICB2aWV3LnNvdXJjZURCLmVtaXQoJ2luZGV4aW5nJywgcHJvZ3Jlc3MpO1xuXG4gICAgY29uc3QgcXVldWUgPSBuZXcgVGFza1F1ZXVlKCk7XG5cbiAgICBhc3luYyBmdW5jdGlvbiBwcm9jZXNzTmV4dEJhdGNoKCkge1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCB2aWV3LnNvdXJjZURCLmNoYW5nZXMoe1xuICAgICAgICByZXR1cm5fZG9jczogdHJ1ZSxcbiAgICAgICAgY29uZmxpY3RzOiB0cnVlLFxuICAgICAgICBpbmNsdWRlX2RvY3M6IHRydWUsXG4gICAgICAgIHN0eWxlOiAnYWxsX2RvY3MnLFxuICAgICAgICBzaW5jZTogY3VycmVudFNlcSxcbiAgICAgICAgbGltaXQ6IG9wdHMuY2hhbmdlc19iYXRjaF9zaXplXG4gICAgICB9KTtcbiAgICAgIGNvbnN0IHB1cmdlcyA9IGF3YWl0IGdldFJlY2VudFB1cmdlcygpO1xuICAgICAgcmV0dXJuIHByb2Nlc3NCYXRjaChyZXNwb25zZSwgcHVyZ2VzKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRSZWNlbnRQdXJnZXMoKSB7XG4gICAgICByZXR1cm4gdmlldy5kYi5nZXQoJ19sb2NhbC9wdXJnZVNlcScpLnRoZW4oZnVuY3Rpb24gKHJlcykge1xuICAgICAgICByZXR1cm4gcmVzLnB1cmdlU2VxO1xuICAgICAgfSkuY2F0Y2goZnVuY3Rpb24gKGVycikge1xuICAgICAgICBpZiAoZXJyICYmIGVyci5zdGF0dXMgIT09IDQwNCkge1xuICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gLTE7XG4gICAgICB9KS50aGVuKGZ1bmN0aW9uIChwdXJnZVNlcSkge1xuICAgICAgICByZXR1cm4gdmlldy5zb3VyY2VEQi5nZXQoJ19sb2NhbC9wdXJnZXMnKS50aGVuKGZ1bmN0aW9uIChyZXMpIHtcbiAgICAgICAgICBjb25zdCByZWNlbnRQdXJnZXMgPSByZXMucHVyZ2VzLmZpbHRlcihmdW5jdGlvbiAocHVyZ2UsIGluZGV4KSB7XG4gICAgICAgICAgICByZXR1cm4gaW5kZXggPiBwdXJnZVNlcTtcbiAgICAgICAgICB9KS5tYXAoKHB1cmdlKSA9PiBwdXJnZS5kb2NJZCk7XG5cbiAgICAgICAgICBjb25zdCB1bmlxdWVQdXJnZXMgPSByZWNlbnRQdXJnZXMuZmlsdGVyKGZ1bmN0aW9uIChkb2NJZCwgaW5kZXgpIHtcbiAgICAgICAgICAgIHJldHVybiByZWNlbnRQdXJnZXMuaW5kZXhPZihkb2NJZCkgPT09IGluZGV4O1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgcmV0dXJuIFByb21pc2UuYWxsKHVuaXF1ZVB1cmdlcy5tYXAoZnVuY3Rpb24gKGRvY0lkKSB7XG4gICAgICAgICAgICByZXR1cm4gdmlldy5zb3VyY2VEQi5nZXQoZG9jSWQpLnRoZW4oZnVuY3Rpb24gKGRvYykge1xuICAgICAgICAgICAgICByZXR1cm4geyBkb2NJZCwgZG9jIH07XG4gICAgICAgICAgICB9KS5jYXRjaChmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgIGlmIChlcnIuc3RhdHVzICE9PSA0MDQpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuIHsgZG9jSWQgfTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pKTtcbiAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgIGlmIChlcnIgJiYgZXJyLnN0YXR1cyAhPT0gNDA0KSB7XG4gICAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwcm9jZXNzQmF0Y2gocmVzcG9uc2UsIHB1cmdlcykge1xuICAgICAgdmFyIHJlc3VsdHMgPSByZXNwb25zZS5yZXN1bHRzO1xuICAgICAgaWYgKCFyZXN1bHRzLmxlbmd0aCAmJiAhcHVyZ2VzLmxlbmd0aCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGZvciAobGV0IHB1cmdlIG9mIHB1cmdlcykge1xuICAgICAgICBjb25zdCBpbmRleCA9IHJlc3VsdHMuZmluZEluZGV4KGZ1bmN0aW9uIChjaGFuZ2UpIHtcbiAgICAgICAgICByZXR1cm4gY2hhbmdlLmlkID09PSBwdXJnZS5kb2NJZDtcbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChpbmRleCA8IDApIHtcbiAgICAgICAgICAvLyBtaW1pYyBhIGRiLnJlbW92ZSgpIG9uIHRoZSBjaGFuZ2VzIGZlZWRcbiAgICAgICAgICBjb25zdCBlbnRyeSA9IHtcbiAgICAgICAgICAgIF9pZDogcHVyZ2UuZG9jSWQsXG4gICAgICAgICAgICBkb2M6IHtcbiAgICAgICAgICAgICAgX2lkOiBwdXJnZS5kb2NJZCxcbiAgICAgICAgICAgICAgX2RlbGV0ZWQ6IDEsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgY2hhbmdlczogW10sXG4gICAgICAgICAgfTtcblxuICAgICAgICAgIGlmIChwdXJnZS5kb2MpIHtcbiAgICAgICAgICAgIC8vIHVwZGF0ZSB3aXRoIG5ldyB3aW5uaW5nIHJldiBhZnRlciBwdXJnZVxuICAgICAgICAgICAgZW50cnkuZG9jID0gcHVyZ2UuZG9jO1xuICAgICAgICAgICAgZW50cnkuY2hhbmdlcy5wdXNoKHsgcmV2OiBwdXJnZS5kb2MuX3JldiB9KTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXN1bHRzLnB1c2goZW50cnkpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHZhciBkb2NJZHNUb0NoYW5nZXNBbmRFbWl0cyA9IGNyZWF0ZURvY0lkc1RvQ2hhbmdlc0FuZEVtaXRzKHJlc3VsdHMpO1xuXG4gICAgICBxdWV1ZS5hZGQocHJvY2Vzc0NoYW5nZShkb2NJZHNUb0NoYW5nZXNBbmRFbWl0cywgY3VycmVudFNlcSkpO1xuXG4gICAgICBpbmRleGVkX2RvY3MgPSBpbmRleGVkX2RvY3MgKyByZXN1bHRzLmxlbmd0aDtcbiAgICAgIGNvbnN0IHByb2dyZXNzID0ge1xuICAgICAgICB2aWV3OiB2aWV3Lm5hbWUsXG4gICAgICAgIGxhc3Rfc2VxOiByZXNwb25zZS5sYXN0X3NlcSxcbiAgICAgICAgcmVzdWx0c19jb3VudDogcmVzdWx0cy5sZW5ndGgsXG4gICAgICAgIGluZGV4ZWRfZG9jczogaW5kZXhlZF9kb2NzXG4gICAgICB9O1xuICAgICAgdmlldy5zb3VyY2VEQi5lbWl0KCdpbmRleGluZycsIHByb2dyZXNzKTtcbiAgICAgIHZpZXcuc291cmNlREIuYWN0aXZlVGFza3MudXBkYXRlKHRhc2tJZCwge2NvbXBsZXRlZF9pdGVtczogaW5kZXhlZF9kb2NzfSk7XG5cbiAgICAgIGlmIChyZXN1bHRzLmxlbmd0aCA8IG9wdHMuY2hhbmdlc19iYXRjaF9zaXplKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHJldHVybiBwcm9jZXNzTmV4dEJhdGNoKCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY3JlYXRlRG9jSWRzVG9DaGFuZ2VzQW5kRW1pdHMocmVzdWx0cykge1xuICAgICAgY29uc3QgZG9jSWRzVG9DaGFuZ2VzQW5kRW1pdHMgPSBuZXcgTWFwKCk7XG4gICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gcmVzdWx0cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICBjb25zdCBjaGFuZ2UgPSByZXN1bHRzW2ldO1xuICAgICAgICBpZiAoY2hhbmdlLmRvYy5faWRbMF0gIT09ICdfJykge1xuICAgICAgICAgIG1hcFJlc3VsdHMgPSBbXTtcbiAgICAgICAgICBkb2MgPSBjaGFuZ2UuZG9jO1xuXG4gICAgICAgICAgaWYgKCFkb2MuX2RlbGV0ZWQpIHtcbiAgICAgICAgICAgIHRyeU1hcCh2aWV3LnNvdXJjZURCLCBtYXBGdW4sIGRvYyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIG1hcFJlc3VsdHMuc29ydChzb3J0QnlLZXlUaGVuVmFsdWUpO1xuXG4gICAgICAgICAgY29uc3QgaW5kZXhhYmxlS2V5c1RvS2V5VmFsdWVzID0gY3JlYXRlSW5kZXhhYmxlS2V5c1RvS2V5VmFsdWVzKG1hcFJlc3VsdHMpO1xuICAgICAgICAgIGRvY0lkc1RvQ2hhbmdlc0FuZEVtaXRzLnNldChjaGFuZ2UuZG9jLl9pZCwgW1xuICAgICAgICAgICAgaW5kZXhhYmxlS2V5c1RvS2V5VmFsdWVzLFxuICAgICAgICAgICAgY2hhbmdlLmNoYW5nZXNcbiAgICAgICAgICBdKTtcbiAgICAgICAgfVxuICAgICAgICBjdXJyZW50U2VxID0gY2hhbmdlLnNlcTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBkb2NJZHNUb0NoYW5nZXNBbmRFbWl0cztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjcmVhdGVJbmRleGFibGVLZXlzVG9LZXlWYWx1ZXMobWFwUmVzdWx0cykge1xuICAgICAgY29uc3QgaW5kZXhhYmxlS2V5c1RvS2V5VmFsdWVzID0gbmV3IE1hcCgpO1xuICAgICAgbGV0IGxhc3RLZXk7XG4gICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gbWFwUmVzdWx0cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICBjb25zdCBlbWl0dGVkS2V5VmFsdWUgPSBtYXBSZXN1bHRzW2ldO1xuICAgICAgICBjb25zdCBjb21wbGV4S2V5ID0gW2VtaXR0ZWRLZXlWYWx1ZS5rZXksIGVtaXR0ZWRLZXlWYWx1ZS5pZF07XG4gICAgICAgIGlmIChpID4gMCAmJiBjb2xsYXRlKGVtaXR0ZWRLZXlWYWx1ZS5rZXksIGxhc3RLZXkpID09PSAwKSB7XG4gICAgICAgICAgY29tcGxleEtleS5wdXNoKGkpOyAvLyBkdXAga2V5K2lkLCBzbyBtYWtlIGl0IHVuaXF1ZVxuICAgICAgICB9XG4gICAgICAgIGluZGV4YWJsZUtleXNUb0tleVZhbHVlcy5zZXQodG9JbmRleGFibGVTdHJpbmcoY29tcGxleEtleSksIGVtaXR0ZWRLZXlWYWx1ZSk7XG4gICAgICAgIGxhc3RLZXkgPSBlbWl0dGVkS2V5VmFsdWUua2V5O1xuICAgICAgfVxuICAgICAgcmV0dXJuIGluZGV4YWJsZUtleXNUb0tleVZhbHVlcztcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgYXdhaXQgY3JlYXRlVGFzaygpO1xuICAgICAgYXdhaXQgcHJvY2Vzc05leHRCYXRjaCgpO1xuICAgICAgYXdhaXQgcXVldWUuZmluaXNoKCk7XG4gICAgICB2aWV3LnNlcSA9IGN1cnJlbnRTZXE7XG4gICAgICB2aWV3LnNvdXJjZURCLmFjdGl2ZVRhc2tzLnJlbW92ZSh0YXNrSWQpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICB2aWV3LnNvdXJjZURCLmFjdGl2ZVRhc2tzLnJlbW92ZSh0YXNrSWQsIGVycm9yKTsgICAgICBcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiByZWR1Y2VWaWV3KHZpZXcsIHJlc3VsdHMsIG9wdGlvbnMpIHtcbiAgICBpZiAob3B0aW9ucy5ncm91cF9sZXZlbCA9PT0gMCkge1xuICAgICAgZGVsZXRlIG9wdGlvbnMuZ3JvdXBfbGV2ZWw7XG4gICAgfVxuXG4gICAgY29uc3Qgc2hvdWxkR3JvdXAgPSBvcHRpb25zLmdyb3VwIHx8IG9wdGlvbnMuZ3JvdXBfbGV2ZWw7XG5cbiAgICBjb25zdCByZWR1Y2VGdW4gPSByZWR1Y2VyKHZpZXcucmVkdWNlRnVuKTtcblxuICAgIGNvbnN0IGdyb3VwcyA9IFtdO1xuICAgIGNvbnN0IGx2bCA9IGlzTmFOKG9wdGlvbnMuZ3JvdXBfbGV2ZWwpID8gTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZIDpcbiAgICAgIG9wdGlvbnMuZ3JvdXBfbGV2ZWw7XG4gICAgcmVzdWx0cy5mb3JFYWNoKGZ1bmN0aW9uIChlKSB7XG4gICAgICBjb25zdCBsYXN0ID0gZ3JvdXBzW2dyb3Vwcy5sZW5ndGggLSAxXTtcbiAgICAgIGxldCBncm91cEtleSA9IHNob3VsZEdyb3VwID8gZS5rZXkgOiBudWxsO1xuXG4gICAgICAvLyBvbmx5IHNldCBncm91cF9sZXZlbCBmb3IgYXJyYXkga2V5c1xuICAgICAgaWYgKHNob3VsZEdyb3VwICYmIEFycmF5LmlzQXJyYXkoZ3JvdXBLZXkpKSB7XG4gICAgICAgIGdyb3VwS2V5ID0gZ3JvdXBLZXkuc2xpY2UoMCwgbHZsKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGxhc3QgJiYgY29sbGF0ZShsYXN0Lmdyb3VwS2V5LCBncm91cEtleSkgPT09IDApIHtcbiAgICAgICAgbGFzdC5rZXlzLnB1c2goW2Uua2V5LCBlLmlkXSk7XG4gICAgICAgIGxhc3QudmFsdWVzLnB1c2goZS52YWx1ZSk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGdyb3Vwcy5wdXNoKHtcbiAgICAgICAga2V5czogW1tlLmtleSwgZS5pZF1dLFxuICAgICAgICB2YWx1ZXM6IFtlLnZhbHVlXSxcbiAgICAgICAgZ3JvdXBLZXk6IGdyb3VwS2V5XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICByZXN1bHRzID0gW107XG4gICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGdyb3Vwcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgY29uc3QgZSA9IGdyb3Vwc1tpXTtcbiAgICAgIGNvbnN0IHJlZHVjZVRyeSA9IHRyeVJlZHVjZSh2aWV3LnNvdXJjZURCLCByZWR1Y2VGdW4sIGUua2V5cywgZS52YWx1ZXMsIGZhbHNlKTtcbiAgICAgIGlmIChyZWR1Y2VUcnkuZXJyb3IgJiYgcmVkdWNlVHJ5LmVycm9yIGluc3RhbmNlb2YgQnVpbHRJbkVycm9yKSB7XG4gICAgICAgIC8vIENvdWNoREIgcmV0dXJucyBhbiBlcnJvciBpZiBhIGJ1aWx0LWluIGVycm9ycyBvdXRcbiAgICAgICAgdGhyb3cgcmVkdWNlVHJ5LmVycm9yO1xuICAgICAgfVxuICAgICAgcmVzdWx0cy5wdXNoKHtcbiAgICAgICAgLy8gQ291Y2hEQiBqdXN0IHNldHMgdGhlIHZhbHVlIHRvIG51bGwgaWYgYSBub24tYnVpbHQtaW4gZXJyb3JzIG91dFxuICAgICAgICB2YWx1ZTogcmVkdWNlVHJ5LmVycm9yID8gbnVsbCA6IHJlZHVjZVRyeS5vdXRwdXQsXG4gICAgICAgIGtleTogZS5ncm91cEtleVxuICAgICAgfSk7XG4gICAgfVxuICAgIC8vIG5vIHRvdGFsX3Jvd3Mvb2Zmc2V0IHdoZW4gcmVkdWNpbmdcbiAgICByZXR1cm4ge3Jvd3M6IHNsaWNlUmVzdWx0cyhyZXN1bHRzLCBvcHRpb25zLmxpbWl0LCBvcHRpb25zLnNraXApfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHF1ZXJ5Vmlldyh2aWV3LCBvcHRzKSB7XG4gICAgcmV0dXJuIHNlcXVlbnRpYWxpemUoZ2V0UXVldWUodmlldyksIGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBxdWVyeVZpZXdJblF1ZXVlKHZpZXcsIG9wdHMpO1xuICAgIH0pKCk7XG4gIH1cblxuICBhc3luYyBmdW5jdGlvbiBxdWVyeVZpZXdJblF1ZXVlKHZpZXcsIG9wdHMpIHtcbiAgICBsZXQgdG90YWxSb3dzO1xuICAgIGNvbnN0IHNob3VsZFJlZHVjZSA9IHZpZXcucmVkdWNlRnVuICYmIG9wdHMucmVkdWNlICE9PSBmYWxzZTtcbiAgICBjb25zdCBza2lwID0gb3B0cy5za2lwIHx8IDA7XG4gICAgaWYgKHR5cGVvZiBvcHRzLmtleXMgIT09ICd1bmRlZmluZWQnICYmICFvcHRzLmtleXMubGVuZ3RoKSB7XG4gICAgICAvLyBlcXVpdmFsZW50IHF1ZXJ5XG4gICAgICBvcHRzLmxpbWl0ID0gMDtcbiAgICAgIGRlbGV0ZSBvcHRzLmtleXM7XG4gICAgfVxuXG4gICAgYXN5bmMgZnVuY3Rpb24gZmV0Y2hGcm9tVmlldyh2aWV3T3B0cykge1xuICAgICAgdmlld09wdHMuaW5jbHVkZV9kb2NzID0gdHJ1ZTtcbiAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IHZpZXcuZGIuYWxsRG9jcyh2aWV3T3B0cyk7XG4gICAgICB0b3RhbFJvd3MgPSByZXMudG90YWxfcm93cztcblxuICAgICAgcmV0dXJuIHJlcy5yb3dzLm1hcChmdW5jdGlvbiAocmVzdWx0KSB7XG4gICAgICAgIC8vIGltcGxpY2l0IG1pZ3JhdGlvbiAtIGluIG9sZGVyIHZlcnNpb25zIG9mIFBvdWNoREIsXG4gICAgICAgIC8vIHdlIGV4cGxpY2l0bHkgc3RvcmVkIHRoZSBkb2MgYXMge2lkOiAuLi4sIGtleTogLi4uLCB2YWx1ZTogLi4ufVxuICAgICAgICAvLyB0aGlzIGlzIHRlc3RlZCBpbiBhIG1pZ3JhdGlvbiB0ZXN0XG4gICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gICAgICAgIGlmICgndmFsdWUnIGluIHJlc3VsdC5kb2MgJiYgdHlwZW9mIHJlc3VsdC5kb2MudmFsdWUgPT09ICdvYmplY3QnICYmXG4gICAgICAgICAgcmVzdWx0LmRvYy52YWx1ZSAhPT0gbnVsbCkge1xuICAgICAgICAgIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyhyZXN1bHQuZG9jLnZhbHVlKS5zb3J0KCk7XG4gICAgICAgICAgLy8gdGhpcyBkZXRlY3Rpb24gbWV0aG9kIGlzIG5vdCBwZXJmZWN0LCBidXQgaXQncyB1bmxpa2VseSB0aGUgdXNlclxuICAgICAgICAgIC8vIGVtaXR0ZWQgYSB2YWx1ZSB3aGljaCB3YXMgYW4gb2JqZWN0IHdpdGggdGhlc2UgMyBleGFjdCBrZXlzXG4gICAgICAgICAgY29uc3QgZXhwZWN0ZWRLZXlzID0gWydpZCcsICdrZXknLCAndmFsdWUnXTtcbiAgICAgICAgICBpZiAoIShrZXlzIDwgZXhwZWN0ZWRLZXlzIHx8IGtleXMgPiBleHBlY3RlZEtleXMpKSB7XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0LmRvYy52YWx1ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBwYXJzZWRLZXlBbmREb2NJZCA9IHBhcnNlSW5kZXhhYmxlU3RyaW5nKHJlc3VsdC5kb2MuX2lkKTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBrZXk6IHBhcnNlZEtleUFuZERvY0lkWzBdLFxuICAgICAgICAgIGlkOiBwYXJzZWRLZXlBbmREb2NJZFsxXSxcbiAgICAgICAgICB2YWx1ZTogKCd2YWx1ZScgaW4gcmVzdWx0LmRvYyA/IHJlc3VsdC5kb2MudmFsdWUgOiBudWxsKVxuICAgICAgICB9O1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgYXN5bmMgZnVuY3Rpb24gb25NYXBSZXN1bHRzUmVhZHkocm93cykge1xuICAgICAgbGV0IGZpbmFsUmVzdWx0cztcbiAgICAgIGlmIChzaG91bGRSZWR1Y2UpIHtcbiAgICAgICAgZmluYWxSZXN1bHRzID0gcmVkdWNlVmlldyh2aWV3LCByb3dzLCBvcHRzKTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIG9wdHMua2V5cyA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgZmluYWxSZXN1bHRzID0ge1xuICAgICAgICAgIHRvdGFsX3Jvd3M6IHRvdGFsUm93cyxcbiAgICAgICAgICBvZmZzZXQ6IHNraXAsXG4gICAgICAgICAgcm93czogcm93c1xuICAgICAgICB9O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gc3VwcG9ydCBsaW1pdCwgc2tpcCBmb3Iga2V5cyBxdWVyeVxuICAgICAgICBmaW5hbFJlc3VsdHMgPSB7XG4gICAgICAgICAgdG90YWxfcm93czogdG90YWxSb3dzLFxuICAgICAgICAgIG9mZnNldDogc2tpcCxcbiAgICAgICAgICByb3dzOiBzbGljZVJlc3VsdHMocm93cyxvcHRzLmxpbWl0LG9wdHMuc2tpcClcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgICAgaWYgKG9wdHMudXBkYXRlX3NlcSkge1xuICAgICAgICBmaW5hbFJlc3VsdHMudXBkYXRlX3NlcSA9IHZpZXcuc2VxO1xuICAgICAgfVxuICAgICAgaWYgKG9wdHMuaW5jbHVkZV9kb2NzKSB7XG4gICAgICAgIGNvbnN0IGRvY0lkcyA9IHVuaXEocm93cy5tYXAocm93VG9Eb2NJZCkpO1xuXG4gICAgICAgIGNvbnN0IGFsbERvY3NSZXMgPSBhd2FpdCB2aWV3LnNvdXJjZURCLmFsbERvY3Moe1xuICAgICAgICAgIGtleXM6IGRvY0lkcyxcbiAgICAgICAgICBpbmNsdWRlX2RvY3M6IHRydWUsXG4gICAgICAgICAgY29uZmxpY3RzOiBvcHRzLmNvbmZsaWN0cyxcbiAgICAgICAgICBhdHRhY2htZW50czogb3B0cy5hdHRhY2htZW50cyxcbiAgICAgICAgICBiaW5hcnk6IG9wdHMuYmluYXJ5XG4gICAgICAgIH0pO1xuICAgICAgICB2YXIgZG9jSWRzVG9Eb2NzID0gbmV3IE1hcCgpO1xuICAgICAgICBhbGxEb2NzUmVzLnJvd3MuZm9yRWFjaChmdW5jdGlvbiAocm93KSB7XG4gICAgICAgICAgZG9jSWRzVG9Eb2NzLnNldChyb3cuaWQsIHJvdy5kb2MpO1xuICAgICAgICB9KTtcbiAgICAgICAgcm93cy5mb3JFYWNoKGZ1bmN0aW9uIChyb3cpIHtcbiAgICAgICAgICB2YXIgZG9jSWQgPSByb3dUb0RvY0lkKHJvdyk7XG4gICAgICAgICAgdmFyIGRvYyA9IGRvY0lkc1RvRG9jcy5nZXQoZG9jSWQpO1xuICAgICAgICAgIGlmIChkb2MpIHtcbiAgICAgICAgICAgIHJvdy5kb2MgPSBkb2M7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGZpbmFsUmVzdWx0cztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBmaW5hbFJlc3VsdHM7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBvcHRzLmtleXMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICBjb25zdCBrZXlzID0gb3B0cy5rZXlzO1xuICAgICAgY29uc3QgZmV0Y2hQcm9taXNlcyA9IGtleXMubWFwKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgY29uc3Qgdmlld09wdHMgPSB7XG4gICAgICAgICAgc3RhcnRrZXkgOiB0b0luZGV4YWJsZVN0cmluZyhba2V5XSksXG4gICAgICAgICAgZW5ka2V5ICAgOiB0b0luZGV4YWJsZVN0cmluZyhba2V5LCB7fV0pXG4gICAgICAgIH07XG4gICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgICAgICBpZiAob3B0cy51cGRhdGVfc2VxKSB7XG4gICAgICAgICAgdmlld09wdHMudXBkYXRlX3NlcSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZldGNoRnJvbVZpZXcodmlld09wdHMpO1xuICAgICAgfSk7XG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBQcm9taXNlLmFsbChmZXRjaFByb21pc2VzKTtcbiAgICAgIGNvbnN0IGZsYXR0ZW5lZFJlc3VsdCA9IGZsYXR0ZW4ocmVzdWx0KTtcbiAgICAgIHJldHVybiBvbk1hcFJlc3VsdHNSZWFkeShmbGF0dGVuZWRSZXN1bHQpO1xuICAgIH0gZWxzZSB7IC8vIG5vcm1hbCBxdWVyeSwgbm8gJ2tleXMnXG4gICAgICBjb25zdCB2aWV3T3B0cyA9IHtcbiAgICAgICAgZGVzY2VuZGluZyA6IG9wdHMuZGVzY2VuZGluZ1xuICAgICAgfTtcbiAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgICAgaWYgKG9wdHMudXBkYXRlX3NlcSkge1xuICAgICAgICB2aWV3T3B0cy51cGRhdGVfc2VxID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGxldCBzdGFydGtleTtcbiAgICAgIGxldCBlbmRrZXk7XG4gICAgICBpZiAoJ3N0YXJ0X2tleScgaW4gb3B0cykge1xuICAgICAgICBzdGFydGtleSA9IG9wdHMuc3RhcnRfa2V5O1xuICAgICAgfVxuICAgICAgaWYgKCdzdGFydGtleScgaW4gb3B0cykge1xuICAgICAgICBzdGFydGtleSA9IG9wdHMuc3RhcnRrZXk7XG4gICAgICB9XG4gICAgICBpZiAoJ2VuZF9rZXknIGluIG9wdHMpIHtcbiAgICAgICAgZW5ka2V5ID0gb3B0cy5lbmRfa2V5O1xuICAgICAgfVxuICAgICAgaWYgKCdlbmRrZXknIGluIG9wdHMpIHtcbiAgICAgICAgZW5ka2V5ID0gb3B0cy5lbmRrZXk7XG4gICAgICB9XG4gICAgICBpZiAodHlwZW9mIHN0YXJ0a2V5ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICB2aWV3T3B0cy5zdGFydGtleSA9IG9wdHMuZGVzY2VuZGluZyA/XG4gICAgICAgICAgdG9JbmRleGFibGVTdHJpbmcoW3N0YXJ0a2V5LCB7fV0pIDpcbiAgICAgICAgICB0b0luZGV4YWJsZVN0cmluZyhbc3RhcnRrZXldKTtcbiAgICAgIH1cbiAgICAgIGlmICh0eXBlb2YgZW5ka2V5ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBsZXQgaW5jbHVzaXZlRW5kID0gb3B0cy5pbmNsdXNpdmVfZW5kICE9PSBmYWxzZTtcbiAgICAgICAgaWYgKG9wdHMuZGVzY2VuZGluZykge1xuICAgICAgICAgIGluY2x1c2l2ZUVuZCA9ICFpbmNsdXNpdmVFbmQ7XG4gICAgICAgIH1cblxuICAgICAgICB2aWV3T3B0cy5lbmRrZXkgPSB0b0luZGV4YWJsZVN0cmluZyhcbiAgICAgICAgICBpbmNsdXNpdmVFbmQgPyBbZW5ka2V5LCB7fV0gOiBbZW5ka2V5XSk7XG4gICAgICB9XG4gICAgICBpZiAodHlwZW9mIG9wdHMua2V5ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBjb25zdCBrZXlTdGFydCA9IHRvSW5kZXhhYmxlU3RyaW5nKFtvcHRzLmtleV0pO1xuICAgICAgICBjb25zdCBrZXlFbmQgPSB0b0luZGV4YWJsZVN0cmluZyhbb3B0cy5rZXksIHt9XSk7XG4gICAgICAgIGlmICh2aWV3T3B0cy5kZXNjZW5kaW5nKSB7XG4gICAgICAgICAgdmlld09wdHMuZW5ka2V5ID0ga2V5U3RhcnQ7XG4gICAgICAgICAgdmlld09wdHMuc3RhcnRrZXkgPSBrZXlFbmQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmlld09wdHMuc3RhcnRrZXkgPSBrZXlTdGFydDtcbiAgICAgICAgICB2aWV3T3B0cy5lbmRrZXkgPSBrZXlFbmQ7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmICghc2hvdWxkUmVkdWNlKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygb3B0cy5saW1pdCA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICB2aWV3T3B0cy5saW1pdCA9IG9wdHMubGltaXQ7XG4gICAgICAgIH1cbiAgICAgICAgdmlld09wdHMuc2tpcCA9IHNraXA7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGZldGNoRnJvbVZpZXcodmlld09wdHMpO1xuICAgICAgcmV0dXJuIG9uTWFwUmVzdWx0c1JlYWR5KHJlc3VsdCk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZnVuY3Rpb24gaHR0cFZpZXdDbGVhbnVwKGRiKSB7XG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBkYi5mZXRjaCgnX3ZpZXdfY2xlYW51cCcsIHtcbiAgICAgIGhlYWRlcnM6IG5ldyBIZWFkZXJzKHsnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nfSksXG4gICAgICBtZXRob2Q6ICdQT1NUJ1xuICAgIH0pO1xuICAgIHJldHVybiByZXNwb25zZS5qc29uKCk7XG4gIH1cblxuICBhc3luYyBmdW5jdGlvbiBsb2NhbFZpZXdDbGVhbnVwKGRiKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG1ldGFEb2MgPSBhd2FpdCBkYi5nZXQoJ19sb2NhbC8nICsgbG9jYWxEb2NOYW1lKTtcbiAgICAgIGNvbnN0IGRvY3NUb1ZpZXdzID0gbmV3IE1hcCgpO1xuXG4gICAgICBPYmplY3Qua2V5cyhtZXRhRG9jLnZpZXdzKS5mb3JFYWNoKGZ1bmN0aW9uIChmdWxsVmlld05hbWUpIHtcbiAgICAgICAgY29uc3QgcGFydHMgPSBwYXJzZVZpZXdOYW1lKGZ1bGxWaWV3TmFtZSk7XG4gICAgICAgIGNvbnN0IGRlc2lnbkRvY05hbWUgPSAnX2Rlc2lnbi8nICsgcGFydHNbMF07XG4gICAgICAgIGNvbnN0IHZpZXdOYW1lID0gcGFydHNbMV07XG4gICAgICAgIGxldCB2aWV3cyA9IGRvY3NUb1ZpZXdzLmdldChkZXNpZ25Eb2NOYW1lKTtcbiAgICAgICAgaWYgKCF2aWV3cykge1xuICAgICAgICAgIHZpZXdzID0gbmV3IFNldCgpO1xuICAgICAgICAgIGRvY3NUb1ZpZXdzLnNldChkZXNpZ25Eb2NOYW1lLCB2aWV3cyk7XG4gICAgICAgIH1cbiAgICAgICAgdmlld3MuYWRkKHZpZXdOYW1lKTtcbiAgICAgIH0pO1xuICAgICAgY29uc3Qgb3B0cyA9IHtcbiAgICAgICAga2V5cyA6IG1hcFRvS2V5c0FycmF5KGRvY3NUb1ZpZXdzKSxcbiAgICAgICAgaW5jbHVkZV9kb2NzIDogdHJ1ZVxuICAgICAgfTtcblxuICAgICAgY29uc3QgcmVzID0gYXdhaXQgZGIuYWxsRG9jcyhvcHRzKTtcbiAgICAgIGNvbnN0IHZpZXdzVG9TdGF0dXMgPSB7fTtcbiAgICAgIHJlcy5yb3dzLmZvckVhY2goZnVuY3Rpb24gKHJvdykge1xuICAgICAgICBjb25zdCBkZG9jTmFtZSA9IHJvdy5rZXkuc3Vic3RyaW5nKDgpOyAvLyBjdXRzIG9mZiAnX2Rlc2lnbi8nXG4gICAgICAgIGRvY3NUb1ZpZXdzLmdldChyb3cua2V5KS5mb3JFYWNoKGZ1bmN0aW9uICh2aWV3TmFtZSkge1xuICAgICAgICAgIGxldCBmdWxsVmlld05hbWUgPSBkZG9jTmFtZSArICcvJyArIHZpZXdOYW1lO1xuICAgICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgICAgICAgIGlmICghbWV0YURvYy52aWV3c1tmdWxsVmlld05hbWVdKSB7XG4gICAgICAgICAgICAvLyBuZXcgZm9ybWF0LCB3aXRob3V0IHNsYXNoZXMsIHRvIHN1cHBvcnQgUG91Y2hEQiAyLjIuMFxuICAgICAgICAgICAgLy8gbWlncmF0aW9uIHRlc3QgaW4gcG91Y2hkYidzIGJyb3dzZXIubWlncmF0aW9uLmpzIHZlcmlmaWVzIHRoaXNcbiAgICAgICAgICAgIGZ1bGxWaWV3TmFtZSA9IHZpZXdOYW1lO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCB2aWV3REJOYW1lcyA9IE9iamVjdC5rZXlzKG1ldGFEb2Mudmlld3NbZnVsbFZpZXdOYW1lXSk7XG4gICAgICAgICAgLy8gZGVzaWduIGRvYyBkZWxldGVkLCBvciB2aWV3IGZ1bmN0aW9uIG5vbmV4aXN0ZW50XG4gICAgICAgICAgY29uc3Qgc3RhdHVzSXNHb29kID0gcm93LmRvYyAmJiByb3cuZG9jLnZpZXdzICYmXG4gICAgICAgICAgICByb3cuZG9jLnZpZXdzW3ZpZXdOYW1lXTtcbiAgICAgICAgICB2aWV3REJOYW1lcy5mb3JFYWNoKGZ1bmN0aW9uICh2aWV3REJOYW1lKSB7XG4gICAgICAgICAgICB2aWV3c1RvU3RhdHVzW3ZpZXdEQk5hbWVdID1cbiAgICAgICAgICAgICAgdmlld3NUb1N0YXR1c1t2aWV3REJOYW1lXSB8fCBzdGF0dXNJc0dvb2Q7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IGRic1RvRGVsZXRlID0gT2JqZWN0LmtleXModmlld3NUb1N0YXR1cylcbiAgICAgICAgLmZpbHRlcihmdW5jdGlvbiAodmlld0RCTmFtZSkgeyByZXR1cm4gIXZpZXdzVG9TdGF0dXNbdmlld0RCTmFtZV07IH0pO1xuXG4gICAgICBjb25zdCBkZXN0cm95UHJvbWlzZXMgPSBkYnNUb0RlbGV0ZS5tYXAoZnVuY3Rpb24gKHZpZXdEQk5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHNlcXVlbnRpYWxpemUoZ2V0UXVldWUodmlld0RCTmFtZSksIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICByZXR1cm4gbmV3IGRiLmNvbnN0cnVjdG9yKHZpZXdEQk5hbWUsIGRiLl9fb3B0cykuZGVzdHJveSgpO1xuICAgICAgICB9KSgpO1xuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiBQcm9taXNlLmFsbChkZXN0cm95UHJvbWlzZXMpLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4ge29rOiB0cnVlfTtcbiAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgaWYgKGVyci5zdGF0dXMgPT09IDQwNCkge1xuICAgICAgICByZXR1cm4ge29rOiB0cnVlfTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IGVycjtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBhc3luYyBmdW5jdGlvbiBxdWVyeVByb21pc2VkKGRiLCBmdW4sIG9wdHMpIHtcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgIGlmICh0eXBlb2YgZGIuX3F1ZXJ5ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICByZXR1cm4gY3VzdG9tUXVlcnkoZGIsIGZ1biwgb3B0cyk7XG4gICAgfVxuICAgIGlmIChpc1JlbW90ZShkYikpIHtcbiAgICAgIHJldHVybiBodHRwUXVlcnkoZGIsIGZ1biwgb3B0cyk7XG4gICAgfVxuXG4gICAgY29uc3QgdXBkYXRlVmlld09wdHMgPSB7XG4gICAgICBjaGFuZ2VzX2JhdGNoX3NpemU6IGRiLl9fb3B0cy52aWV3X3VwZGF0ZV9jaGFuZ2VzX2JhdGNoX3NpemUgfHwgQ0hBTkdFU19CQVRDSF9TSVpFXG4gICAgfTtcblxuICAgIGlmICh0eXBlb2YgZnVuICE9PSAnc3RyaW5nJykge1xuICAgICAgLy8gdGVtcF92aWV3XG4gICAgICBjaGVja1F1ZXJ5UGFyc2VFcnJvcihvcHRzLCBmdW4pO1xuXG4gICAgICB0ZW1wVmlld1F1ZXVlLmFkZChhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNvbnN0IHZpZXcgPSBhd2FpdCBjcmVhdGVWaWV3KFxuICAgICAgICAgIC8qIHNvdXJjZURCICovIGRiLFxuICAgICAgICAgIC8qIHZpZXdOYW1lICovICd0ZW1wX3ZpZXcvdGVtcF92aWV3JyxcbiAgICAgICAgICAvKiBtYXBGdW4gKi8gZnVuLm1hcCxcbiAgICAgICAgICAvKiByZWR1Y2VGdW4gKi8gZnVuLnJlZHVjZSxcbiAgICAgICAgICAvKiB0ZW1wb3JhcnkgKi8gdHJ1ZSxcbiAgICAgICAgICAvKiBsb2NhbERvY05hbWUgKi8gbG9jYWxEb2NOYW1lKTtcblxuICAgICAgICByZXR1cm4gZmluKHVwZGF0ZVZpZXcodmlldywgdXBkYXRlVmlld09wdHMpLnRoZW4oXG4gICAgICAgICAgZnVuY3Rpb24gKCkgeyByZXR1cm4gcXVlcnlWaWV3KHZpZXcsIG9wdHMpOyB9KSxcbiAgICAgICAgICBmdW5jdGlvbiAoKSB7IHJldHVybiB2aWV3LmRiLmRlc3Ryb3koKTsgfVxuICAgICAgICApO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gdGVtcFZpZXdRdWV1ZS5maW5pc2goKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gcGVyc2lzdGVudCB2aWV3XG4gICAgICBjb25zdCBmdWxsVmlld05hbWUgPSBmdW47XG4gICAgICBjb25zdCBwYXJ0cyA9IHBhcnNlVmlld05hbWUoZnVsbFZpZXdOYW1lKTtcbiAgICAgIGNvbnN0IGRlc2lnbkRvY05hbWUgPSBwYXJ0c1swXTtcbiAgICAgIGNvbnN0IHZpZXdOYW1lID0gcGFydHNbMV07XG5cbiAgICAgIGNvbnN0IGRvYyA9IGF3YWl0IGRiLmdldCgnX2Rlc2lnbi8nICsgZGVzaWduRG9jTmFtZSk7XG4gICAgICBmdW4gPSBkb2Mudmlld3MgJiYgZG9jLnZpZXdzW3ZpZXdOYW1lXTtcblxuICAgICAgaWYgKCFmdW4pIHtcbiAgICAgICAgLy8gYmFzaWMgdmFsaWRhdG9yOyBpdCdzIGFzc3VtZWQgdGhhdCBldmVyeSBzdWJjbGFzcyB3b3VsZCB3YW50IHRoaXNcbiAgICAgICAgdGhyb3cgbmV3IE5vdEZvdW5kRXJyb3IoYGRkb2MgJHtkb2MuX2lkfSBoYXMgbm8gdmlldyBuYW1lZCAke3ZpZXdOYW1lfWApO1xuICAgICAgfVxuXG4gICAgICBkZG9jVmFsaWRhdG9yKGRvYywgdmlld05hbWUpO1xuICAgICAgY2hlY2tRdWVyeVBhcnNlRXJyb3Iob3B0cywgZnVuKTtcblxuICAgICAgY29uc3QgdmlldyA9IGF3YWl0IGNyZWF0ZVZpZXcoXG4gICAgICAgIC8qIHNvdXJjZURCICovIGRiLFxuICAgICAgICAvKiB2aWV3TmFtZSAqLyBmdWxsVmlld05hbWUsXG4gICAgICAgIC8qIG1hcEZ1biAqLyBmdW4ubWFwLFxuICAgICAgICAvKiByZWR1Y2VGdW4gKi8gZnVuLnJlZHVjZSxcbiAgICAgICAgLyogdGVtcG9yYXJ5ICovIGZhbHNlLFxuICAgICAgICAvKiBsb2NhbERvY05hbWUgKi8gbG9jYWxEb2NOYW1lKTtcblxuICAgICAgaWYgKG9wdHMuc3RhbGUgPT09ICdvaycgfHwgb3B0cy5zdGFsZSA9PT0gJ3VwZGF0ZV9hZnRlcicpIHtcbiAgICAgICAgaWYgKG9wdHMuc3RhbGUgPT09ICd1cGRhdGVfYWZ0ZXInKSB7XG4gICAgICAgICAgbmV4dFRpY2soZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdXBkYXRlVmlldyh2aWV3LCB1cGRhdGVWaWV3T3B0cyk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHF1ZXJ5Vmlldyh2aWV3LCBvcHRzKTtcbiAgICAgIH0gZWxzZSB7IC8vIHN0YWxlIG5vdCBva1xuICAgICAgICBhd2FpdCB1cGRhdGVWaWV3KHZpZXcsIHVwZGF0ZVZpZXdPcHRzKTtcbiAgICAgICAgcmV0dXJuIHF1ZXJ5Vmlldyh2aWV3LCBvcHRzKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBhYnN0cmFjdFF1ZXJ5KGZ1biwgb3B0cywgY2FsbGJhY2spIHtcbiAgICBjb25zdCBkYiA9IHRoaXM7XG4gICAgaWYgKHR5cGVvZiBvcHRzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBjYWxsYmFjayA9IG9wdHM7XG4gICAgICBvcHRzID0ge307XG4gICAgfVxuICAgIG9wdHMgPSBvcHRzID8gY29lcmNlT3B0aW9ucyhvcHRzKSA6IHt9O1xuXG4gICAgaWYgKHR5cGVvZiBmdW4gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGZ1biA9IHttYXAgOiBmdW59O1xuICAgIH1cblxuICAgIGNvbnN0IHByb21pc2UgPSBQcm9taXNlLnJlc29sdmUoKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBxdWVyeVByb21pc2VkKGRiLCBmdW4sIG9wdHMpO1xuICAgIH0pO1xuICAgIHByb21pc2VkQ2FsbGJhY2socHJvbWlzZSwgY2FsbGJhY2spO1xuICAgIHJldHVybiBwcm9taXNlO1xuICB9XG5cbiAgY29uc3QgYWJzdHJhY3RWaWV3Q2xlYW51cCA9IGNhbGxiYWNraWZ5KGZ1bmN0aW9uICgpIHtcbiAgICBjb25zdCBkYiA9IHRoaXM7XG4gICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICBpZiAodHlwZW9mIGRiLl92aWV3Q2xlYW51cCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgcmV0dXJuIGN1c3RvbVZpZXdDbGVhbnVwKGRiKTtcbiAgICB9XG4gICAgaWYgKGlzUmVtb3RlKGRiKSkge1xuICAgICAgcmV0dXJuIGh0dHBWaWV3Q2xlYW51cChkYik7XG4gICAgfVxuICAgIHJldHVybiBsb2NhbFZpZXdDbGVhbnVwKGRiKTtcbiAgfSk7XG5cbiAgcmV0dXJuIHtcbiAgICBxdWVyeTogYWJzdHJhY3RRdWVyeSxcbiAgICB2aWV3Q2xlYW51cDogYWJzdHJhY3RWaWV3Q2xlYW51cFxuICB9O1xufVxuXG5leHBvcnQgZGVmYXVsdCBjcmVhdGVBYnN0cmFjdE1hcFJlZHVjZTtcbiJdLCJuYW1lcyI6WyJuZXh0VGljayJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU0sU0FBUyxDQUFDO0FBQ2hCLEVBQUUsV0FBVyxHQUFHO0FBQ2hCLElBQUksSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLE9BQU8sQ0FBQyxVQUFVLE9BQU8sRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ2pFLEdBQUc7QUFDSDtBQUNBLEVBQUUsR0FBRyxDQUFDLGNBQWMsRUFBRTtBQUN0QixJQUFJLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsWUFBWTtBQUNsRDtBQUNBLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxZQUFZO0FBQ3hCLE1BQU0sT0FBTyxjQUFjLEVBQUUsQ0FBQztBQUM5QixL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
