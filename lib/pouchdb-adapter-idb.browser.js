import { changesHandler as Changes, uuid } from './pouchdb-utils.browser.js';
import { t as traverseRevTree, w as winningRev } from './rootToLeaf-f8d0e78a.js';
import { a as isLocalId, i as isDeleted } from './isLocalId-d067de54.js';
import { c as compactTree, l as latest } from './latest-0521537f.js';
import { createError, IDB_ERROR, MISSING_STUB, MISSING_DOC, REV_CONFLICT } from './pouchdb-errors.browser.js';
import { p as parseDoc } from './parseDoc-5d2a34bd.js';
import { i as immediate, h as hasLocalStorage } from './functionName-9335a350.js';
import './__node-resolve_empty-5ffda92e.js';
import './spark-md5-2c57e5fc.js';
import { p as preprocessAttachments } from './preprocessAttachments-5fe0c9da.js';
import { p as processDocs } from './processDocs-7ad6f99c.js';
import { p as pick } from './bulkGetShim-d4877145.js';
import { btoa } from './pouchdb-binary-utils.browser.js';
import { safeJsonStringify, safeJsonParse } from './pouchdb-json.browser.js';
import { a as b64ToBluffer } from './base64StringToBlobOrBuffer-browser-cdc72594.js';
import { r as readAsBinaryString } from './blobOrBufferToBase64-browser-bbef19a6.js';
import { c as collectConflicts } from './collectConflicts-6afe46fc.js';
import { c as clone } from './clone-abfcddc8.js';
import { f as filterChange } from './parseUri-b061a2c5.js';
import { t as toPromise } from './toPromise-9dada06a.js';
import { g as guardedConsole } from './guardedConsole-f54e5a40.js';
import './explainError-browser-c025e6c9.js';
import './flatten-994f45c6.js';
import './rev-5645662a.js';
import './stringMd5-browser-5aecd2bd.js';
import './isRemote-f9121da9.js';
import './normalizeDdocFunctionName-ea3481cf.js';
import './scopeEval-ff3a416d.js';
import './upsert-331b6913.js';
import './_commonjsHelpers-24198af3.js';
import './binaryMd5-browser-25ce905b.js';
import './merge-7299d068.js';
import './revExists-12209d1c.js';

// IndexedDB requires a versioned database structure, so we use the
// version here to manage migrations.
var ADAPTER_VERSION = 5;

// The object stores created for each database
// DOC_STORE stores the document meta data, its revision history and state
// Keyed by document id
var DOC_STORE = 'document-store';
// BY_SEQ_STORE stores a particular version of a document, keyed by its
// sequence id
var BY_SEQ_STORE = 'by-sequence';
// Where we store attachments
var ATTACH_STORE = 'attach-store';
// Where we store many-to-many relations
// between attachment digests and seqs
var ATTACH_AND_SEQ_STORE = 'attach-seq-store';

// Where we store database-wide meta data in a single record
// keyed by id: META_STORE
var META_STORE = 'meta-store';
// Where we store local documents
var LOCAL_STORE = 'local-store';
// Where we detect blob support
var DETECT_BLOB_SUPPORT_STORE = 'detect-blob-support';

function idbError(callback) {
  return function (evt) {
    var message = 'unknown_error';
    if (evt.target && evt.target.error) {
      message = evt.target.error.name || evt.target.error.message;
    }
    callback(createError(IDB_ERROR, message, evt.type));
  };
}

// Unfortunately, the metadata has to be stringified
// when it is put into the database, because otherwise
// IndexedDB can throw errors for deeply-nested objects.
// Originally we just used JSON.parse/JSON.stringify; now
// we use this custom vuvuzela library that avoids recursion.
// If we could do it all over again, we'd probably use a
// format for the revision trees other than JSON.
function encodeMetadata(metadata, winningRev, deleted) {
  return {
    data: safeJsonStringify(metadata),
    winningRev: winningRev,
    deletedOrLocal: deleted ? '1' : '0',
    seq: metadata.seq, // highest seq for this doc
    id: metadata.id
  };
}

function decodeMetadata(storedObject) {
  if (!storedObject) {
    return null;
  }
  var metadata = safeJsonParse(storedObject.data);
  metadata.winningRev = storedObject.winningRev;
  metadata.deleted = storedObject.deletedOrLocal === '1';
  metadata.seq = storedObject.seq;
  return metadata;
}

// read the doc back out from the database. we don't store the
// _id or _rev because we already have _doc_id_rev.
function decodeDoc(doc) {
  if (!doc) {
    return doc;
  }
  var idx = doc._doc_id_rev.lastIndexOf(':');
  doc._id = doc._doc_id_rev.substring(0, idx - 1);
  doc._rev = doc._doc_id_rev.substring(idx + 1);
  delete doc._doc_id_rev;
  return doc;
}

// Read a blob from the database, encoding as necessary
// and translating from base64 if the IDB doesn't support
// native Blobs
function readBlobData(body, type, asBlob, callback) {
  if (asBlob) {
    if (!body) {
      callback(new Blob([''], {type: type}));
    } else if (typeof body !== 'string') { // we have blob support
      callback(body);
    } else { // no blob support
      callback(b64ToBluffer(body, type));
    }
  } else { // as base64 string
    if (!body) {
      callback('');
    } else if (typeof body !== 'string') { // we have blob support
      readAsBinaryString(body, function (binary) {
        callback(btoa(binary));
      });
    } else { // no blob support
      callback(body);
    }
  }
}

function fetchAttachmentsIfNecessary(doc, opts, txn, cb) {
  var attachments = Object.keys(doc._attachments || {});
  if (!attachments.length) {
    return cb && cb();
  }
  var numDone = 0;

  function checkDone() {
    if (++numDone === attachments.length && cb) {
      cb();
    }
  }

  function fetchAttachment(doc, att) {
    var attObj = doc._attachments[att];
    var digest = attObj.digest;
    var req = txn.objectStore(ATTACH_STORE).get(digest);
    req.onsuccess = function (e) {
      attObj.body = e.target.result.body;
      checkDone();
    };
  }

  attachments.forEach(function (att) {
    if (opts.attachments && opts.include_docs) {
      fetchAttachment(doc, att);
    } else {
      doc._attachments[att].stub = true;
      checkDone();
    }
  });
}

// IDB-specific postprocessing necessary because
// we don't know whether we stored a true Blob or
// a base64-encoded string, and if it's a Blob it
// needs to be read outside of the transaction context
function postProcessAttachments(results, asBlob) {
  return Promise.all(results.map(function (row) {
    if (row.doc && row.doc._attachments) {
      var attNames = Object.keys(row.doc._attachments);
      return Promise.all(attNames.map(function (att) {
        var attObj = row.doc._attachments[att];
        if (!('body' in attObj)) { // already processed
          return;
        }
        var body = attObj.body;
        var type = attObj.content_type;
        return new Promise(function (resolve) {
          readBlobData(body, type, asBlob, function (data) {
            row.doc._attachments[att] = Object.assign(
              pick(attObj, ['digest', 'content_type']),
              {data: data}
            );
            resolve();
          });
        });
      }));
    }
  }));
}

function compactRevs(revs, docId, txn) {

  var possiblyOrphanedDigests = [];
  var seqStore = txn.objectStore(BY_SEQ_STORE);
  var attStore = txn.objectStore(ATTACH_STORE);
  var attAndSeqStore = txn.objectStore(ATTACH_AND_SEQ_STORE);
  var count = revs.length;

  function checkDone() {
    count--;
    if (!count) { // done processing all revs
      deleteOrphanedAttachments();
    }
  }

  function deleteOrphanedAttachments() {
    if (!possiblyOrphanedDigests.length) {
      return;
    }
    possiblyOrphanedDigests.forEach(function (digest) {
      var countReq = attAndSeqStore.index('digestSeq').count(
        IDBKeyRange.bound(
          digest + '::', digest + '::\uffff', false, false));
      countReq.onsuccess = function (e) {
        var count = e.target.result;
        if (!count) {
          // orphaned
          attStore.delete(digest);
        }
      };
    });
  }

  revs.forEach(function (rev) {
    var index = seqStore.index('_doc_id_rev');
    var key = docId + "::" + rev;
    index.getKey(key).onsuccess = function (e) {
      var seq = e.target.result;
      if (typeof seq !== 'number') {
        return checkDone();
      }
      seqStore.delete(seq);

      var cursor = attAndSeqStore.index('seq')
        .openCursor(IDBKeyRange.only(seq));

      cursor.onsuccess = function (event) {
        var cursor = event.target.result;
        if (cursor) {
          var digest = cursor.value.digestSeq.split('::')[0];
          possiblyOrphanedDigests.push(digest);
          attAndSeqStore.delete(cursor.primaryKey);
          cursor.continue();
        } else { // done
          checkDone();
        }
      };
    };
  });
}

function openTransactionSafely(idb, stores, mode) {
  try {
    return {
      txn: idb.transaction(stores, mode)
    };
  } catch (err) {
    return {
      error: err
    };
  }
}

var changesHandler = new Changes();

function idbBulkDocs(dbOpts, req, opts, api, idb, callback) {
  var docInfos = req.docs;
  var txn;
  var docStore;
  var bySeqStore;
  var attachStore;
  var attachAndSeqStore;
  var metaStore;
  var docInfoError;
  var metaDoc;

  for (var i = 0, len = docInfos.length; i < len; i++) {
    var doc = docInfos[i];
    if (doc._id && isLocalId(doc._id)) {
      continue;
    }
    doc = docInfos[i] = parseDoc(doc, opts.new_edits, dbOpts);
    if (doc.error && !docInfoError) {
      docInfoError = doc;
    }
  }

  if (docInfoError) {
    return callback(docInfoError);
  }

  var allDocsProcessed = false;
  var docCountDelta = 0;
  var results = new Array(docInfos.length);
  var fetchedDocs = new Map();
  var preconditionErrored = false;
  var blobType = api._meta.blobSupport ? 'blob' : 'base64';

  preprocessAttachments(docInfos, blobType, function (err) {
    if (err) {
      return callback(err);
    }
    startTransaction();
  });

  function startTransaction() {

    var stores = [
      DOC_STORE, BY_SEQ_STORE,
      ATTACH_STORE,
      LOCAL_STORE, ATTACH_AND_SEQ_STORE,
      META_STORE
    ];
    var txnResult = openTransactionSafely(idb, stores, 'readwrite');
    if (txnResult.error) {
      return callback(txnResult.error);
    }
    txn = txnResult.txn;
    txn.onabort = idbError(callback);
    txn.ontimeout = idbError(callback);
    txn.oncomplete = complete;
    docStore = txn.objectStore(DOC_STORE);
    bySeqStore = txn.objectStore(BY_SEQ_STORE);
    attachStore = txn.objectStore(ATTACH_STORE);
    attachAndSeqStore = txn.objectStore(ATTACH_AND_SEQ_STORE);
    metaStore = txn.objectStore(META_STORE);

    metaStore.get(META_STORE).onsuccess = function (e) {
      metaDoc = e.target.result;
      updateDocCountIfReady();
    };

    verifyAttachments(function (err) {
      if (err) {
        preconditionErrored = true;
        return callback(err);
      }
      fetchExistingDocs();
    });
  }

  function onAllDocsProcessed() {
    allDocsProcessed = true;
    updateDocCountIfReady();
  }

  function idbProcessDocs() {
    processDocs(dbOpts.revs_limit, docInfos, api, fetchedDocs,
                txn, results, writeDoc, opts, onAllDocsProcessed);
  }

  function updateDocCountIfReady() {
    if (!metaDoc || !allDocsProcessed) {
      return;
    }
    // caching the docCount saves a lot of time in allDocs() and
    // info(), which is why we go to all the trouble of doing this
    metaDoc.docCount += docCountDelta;
    metaStore.put(metaDoc);
  }

  function fetchExistingDocs() {

    if (!docInfos.length) {
      return;
    }

    var numFetched = 0;

    function checkDone() {
      if (++numFetched === docInfos.length) {
        idbProcessDocs();
      }
    }

    function readMetadata(event) {
      var metadata = decodeMetadata(event.target.result);

      if (metadata) {
        fetchedDocs.set(metadata.id, metadata);
      }
      checkDone();
    }

    for (var i = 0, len = docInfos.length; i < len; i++) {
      var docInfo = docInfos[i];
      if (docInfo._id && isLocalId(docInfo._id)) {
        checkDone(); // skip local docs
        continue;
      }
      var req = docStore.get(docInfo.metadata.id);
      req.onsuccess = readMetadata;
    }
  }

  function complete() {
    if (preconditionErrored) {
      return;
    }

    changesHandler.notify(api._meta.name);
    callback(null, results);
  }

  function verifyAttachment(digest, callback) {

    var req = attachStore.get(digest);
    req.onsuccess = function (e) {
      if (!e.target.result) {
        var err = createError(MISSING_STUB,
          'unknown stub attachment with digest ' +
          digest);
        err.status = 412;
        callback(err);
      } else {
        callback();
      }
    };
  }

  function verifyAttachments(finish) {


    var digests = [];
    docInfos.forEach(function (docInfo) {
      if (docInfo.data && docInfo.data._attachments) {
        Object.keys(docInfo.data._attachments).forEach(function (filename) {
          var att = docInfo.data._attachments[filename];
          if (att.stub) {
            digests.push(att.digest);
          }
        });
      }
    });
    if (!digests.length) {
      return finish();
    }
    var numDone = 0;
    var err;

    function checkDone() {
      if (++numDone === digests.length) {
        finish(err);
      }
    }
    digests.forEach(function (digest) {
      verifyAttachment(digest, function (attErr) {
        if (attErr && !err) {
          err = attErr;
        }
        checkDone();
      });
    });
  }

  function writeDoc(docInfo, winningRev, winningRevIsDeleted, newRevIsDeleted,
                    isUpdate, delta, resultsIdx, callback) {

    docInfo.metadata.winningRev = winningRev;
    docInfo.metadata.deleted = winningRevIsDeleted;

    var doc = docInfo.data;
    doc._id = docInfo.metadata.id;
    doc._rev = docInfo.metadata.rev;

    if (newRevIsDeleted) {
      doc._deleted = true;
    }

    var hasAttachments = doc._attachments &&
      Object.keys(doc._attachments).length;
    if (hasAttachments) {
      return writeAttachments(docInfo, winningRev, winningRevIsDeleted,
        isUpdate, resultsIdx, callback);
    }

    docCountDelta += delta;
    updateDocCountIfReady();

    finishDoc(docInfo, winningRev, winningRevIsDeleted,
      isUpdate, resultsIdx, callback);
  }

  function finishDoc(docInfo, winningRev, winningRevIsDeleted,
                     isUpdate, resultsIdx, callback) {

    var doc = docInfo.data;
    var metadata = docInfo.metadata;

    doc._doc_id_rev = metadata.id + '::' + metadata.rev;
    delete doc._id;
    delete doc._rev;

    function afterPutDoc(e) {
      var revsToDelete = docInfo.stemmedRevs || [];

      if (isUpdate && api.auto_compaction) {
        revsToDelete = revsToDelete.concat(compactTree(docInfo.metadata));
      }

      if (revsToDelete && revsToDelete.length) {
        compactRevs(revsToDelete, docInfo.metadata.id, txn);
      }

      metadata.seq = e.target.result;
      // Current _rev is calculated from _rev_tree on read
      // delete metadata.rev;
      var metadataToStore = encodeMetadata(metadata, winningRev,
        winningRevIsDeleted);
      var metaDataReq = docStore.put(metadataToStore);
      metaDataReq.onsuccess = afterPutMetadata;
    }

    function afterPutDocError(e) {
      // ConstraintError, need to update, not put (see #1638 for details)
      e.preventDefault(); // avoid transaction abort
      e.stopPropagation(); // avoid transaction onerror
      var index = bySeqStore.index('_doc_id_rev');
      var getKeyReq = index.getKey(doc._doc_id_rev);
      getKeyReq.onsuccess = function (e) {
        var putReq = bySeqStore.put(doc, e.target.result);
        putReq.onsuccess = afterPutDoc;
      };
    }

    function afterPutMetadata() {
      results[resultsIdx] = {
        ok: true,
        id: metadata.id,
        rev: metadata.rev
      };
      fetchedDocs.set(docInfo.metadata.id, docInfo.metadata);
      insertAttachmentMappings(docInfo, metadata.seq, callback);
    }

    var putReq = bySeqStore.put(doc);

    putReq.onsuccess = afterPutDoc;
    putReq.onerror = afterPutDocError;
  }

  function writeAttachments(docInfo, winningRev, winningRevIsDeleted,
                            isUpdate, resultsIdx, callback) {


    var doc = docInfo.data;

    var numDone = 0;
    var attachments = Object.keys(doc._attachments);

    function collectResults() {
      if (numDone === attachments.length) {
        finishDoc(docInfo, winningRev, winningRevIsDeleted,
          isUpdate, resultsIdx, callback);
      }
    }

    function attachmentSaved() {
      numDone++;
      collectResults();
    }

    attachments.forEach(function (key) {
      var att = docInfo.data._attachments[key];
      if (!att.stub) {
        var data = att.data;
        delete att.data;
        att.revpos = parseInt(winningRev, 10);
        var digest = att.digest;
        saveAttachment(digest, data, attachmentSaved);
      } else {
        numDone++;
        collectResults();
      }
    });
  }

  // map seqs to attachment digests, which
  // we will need later during compaction
  function insertAttachmentMappings(docInfo, seq, callback) {

    var attsAdded = 0;
    var attsToAdd = Object.keys(docInfo.data._attachments || {});

    if (!attsToAdd.length) {
      return callback();
    }

    function checkDone() {
      if (++attsAdded === attsToAdd.length) {
        callback();
      }
    }

    function add(att) {
      var digest = docInfo.data._attachments[att].digest;
      var req = attachAndSeqStore.put({
        seq: seq,
        digestSeq: digest + '::' + seq
      });

      req.onsuccess = checkDone;
      req.onerror = function (e) {
        // this callback is for a constaint error, which we ignore
        // because this docid/rev has already been associated with
        // the digest (e.g. when new_edits == false)
        e.preventDefault(); // avoid transaction abort
        e.stopPropagation(); // avoid transaction onerror
        checkDone();
      };
    }
    for (var i = 0; i < attsToAdd.length; i++) {
      add(attsToAdd[i]); // do in parallel
    }
  }

  function saveAttachment(digest, data, callback) {


    var getKeyReq = attachStore.count(digest);
    getKeyReq.onsuccess = function (e) {
      var count = e.target.result;
      if (count) {
        return callback(); // already exists
      }
      var newAtt = {
        digest: digest,
        body: data
      };
      var putReq = attachStore.put(newAtt);
      putReq.onsuccess = callback;
    };
  }
}

// Abstraction over IDBCursor and getAll()/getAllKeys() that allows us to batch our operations
// while falling back to a normal IDBCursor operation on browsers that don't support getAll() or
// getAllKeys(). This allows for a much faster implementation than just straight-up cursors, because
// we're not processing each document one-at-a-time.
function runBatchedCursor(objectStore, keyRange, descending, batchSize, onBatch) {

  if (batchSize === -1) {
    batchSize = 1000;
  }

  // Bail out of getAll()/getAllKeys() in the following cases:
  // 1) either method is unsupported - we need both
  // 2) batchSize is 1 (might as well use IDBCursor)
  // 3) descending – no real way to do this via getAll()/getAllKeys()

  var useGetAll = typeof objectStore.getAll === 'function' &&
    typeof objectStore.getAllKeys === 'function' &&
    batchSize > 1 && !descending;

  var keysBatch;
  var valuesBatch;
  var pseudoCursor;

  function onGetAll(e) {
    valuesBatch = e.target.result;
    if (keysBatch) {
      onBatch(keysBatch, valuesBatch, pseudoCursor);
    }
  }

  function onGetAllKeys(e) {
    keysBatch = e.target.result;
    if (valuesBatch) {
      onBatch(keysBatch, valuesBatch, pseudoCursor);
    }
  }

  function continuePseudoCursor() {
    if (!keysBatch.length) { // no more results
      return onBatch();
    }
    // fetch next batch, exclusive start
    var lastKey = keysBatch[keysBatch.length - 1];
    var newKeyRange;
    if (keyRange && keyRange.upper) {
      try {
        newKeyRange = IDBKeyRange.bound(lastKey, keyRange.upper,
          true, keyRange.upperOpen);
      } catch (e) {
        if (e.name === "DataError" && e.code === 0) {
          return onBatch(); // we're done, startkey and endkey are equal
        }
      }
    } else {
      newKeyRange = IDBKeyRange.lowerBound(lastKey, true);
    }
    keyRange = newKeyRange;
    keysBatch = null;
    valuesBatch = null;
    objectStore.getAll(keyRange, batchSize).onsuccess = onGetAll;
    objectStore.getAllKeys(keyRange, batchSize).onsuccess = onGetAllKeys;
  }

  function onCursor(e) {
    var cursor = e.target.result;
    if (!cursor) { // done
      return onBatch();
    }
    // regular IDBCursor acts like a batch where batch size is always 1
    onBatch([cursor.key], [cursor.value], cursor);
  }

  if (useGetAll) {
    pseudoCursor = {"continue": continuePseudoCursor};
    objectStore.getAll(keyRange, batchSize).onsuccess = onGetAll;
    objectStore.getAllKeys(keyRange, batchSize).onsuccess = onGetAllKeys;
  } else if (descending) {
    objectStore.openCursor(keyRange, 'prev').onsuccess = onCursor;
  } else {
    objectStore.openCursor(keyRange).onsuccess = onCursor;
  }
}

// simple shim for objectStore.getAll(), falling back to IDBCursor
function getAll(objectStore, keyRange, onSuccess) {
  if (typeof objectStore.getAll === 'function') {
    // use native getAll
    objectStore.getAll(keyRange).onsuccess = onSuccess;
    return;
  }
  // fall back to cursors
  var values = [];

  function onCursor(e) {
    var cursor = e.target.result;
    if (cursor) {
      values.push(cursor.value);
      cursor.continue();
    } else {
      onSuccess({
        target: {
          result: values
        }
      });
    }
  }

  objectStore.openCursor(keyRange).onsuccess = onCursor;
}

function allDocsKeys(keys, docStore, onBatch) {
  // It's not guaranted to be returned in right order  
  var valuesBatch = new Array(keys.length);
  var count = 0;
  keys.forEach(function (key, index) {
    docStore.get(key).onsuccess = function (event) {
      if (event.target.result) {
        valuesBatch[index] = event.target.result;
      } else {
        valuesBatch[index] = {key: key, error: 'not_found'};
      }
      count++;
      if (count === keys.length) {
        onBatch(keys, valuesBatch, {});
      }
    };
  });
}

function createKeyRange(start, end, inclusiveEnd, key, descending) {
  try {
    if (start && end) {
      if (descending) {
        return IDBKeyRange.bound(end, start, !inclusiveEnd, false);
      } else {
        return IDBKeyRange.bound(start, end, false, !inclusiveEnd);
      }
    } else if (start) {
      if (descending) {
        return IDBKeyRange.upperBound(start);
      } else {
        return IDBKeyRange.lowerBound(start);
      }
    } else if (end) {
      if (descending) {
        return IDBKeyRange.lowerBound(end, !inclusiveEnd);
      } else {
        return IDBKeyRange.upperBound(end, !inclusiveEnd);
      }
    } else if (key) {
      return IDBKeyRange.only(key);
    }
  } catch (e) {
    return {error: e};
  }
  return null;
}

function idbAllDocs(opts, idb, callback) {
  var start = 'startkey' in opts ? opts.startkey : false;
  var end = 'endkey' in opts ? opts.endkey : false;
  var key = 'key' in opts ? opts.key : false;
  var keys = 'keys' in opts ? opts.keys : false; 
  var skip = opts.skip || 0;
  var limit = typeof opts.limit === 'number' ? opts.limit : -1;
  var inclusiveEnd = opts.inclusive_end !== false;

  var keyRange ; 
  var keyRangeError;
  if (!keys) {
    keyRange = createKeyRange(start, end, inclusiveEnd, key, opts.descending);
    keyRangeError = keyRange && keyRange.error;
    if (keyRangeError && 
      !(keyRangeError.name === "DataError" && keyRangeError.code === 0)) {
      // DataError with error code 0 indicates start is less than end, so
      // can just do an empty query. Else need to throw
      return callback(createError(IDB_ERROR,
        keyRangeError.name, keyRangeError.message));
    }
  }

  var stores = [DOC_STORE, BY_SEQ_STORE, META_STORE];

  if (opts.attachments) {
    stores.push(ATTACH_STORE);
  }
  var txnResult = openTransactionSafely(idb, stores, 'readonly');
  if (txnResult.error) {
    return callback(txnResult.error);
  }
  var txn = txnResult.txn;
  txn.oncomplete = onTxnComplete;
  txn.onabort = idbError(callback);
  var docStore = txn.objectStore(DOC_STORE);
  var seqStore = txn.objectStore(BY_SEQ_STORE);
  var metaStore = txn.objectStore(META_STORE);
  var docIdRevIndex = seqStore.index('_doc_id_rev');
  var results = [];
  var docCount;
  var updateSeq;

  metaStore.get(META_STORE).onsuccess = function (e) {
    docCount = e.target.result.docCount;
  };

  /* istanbul ignore if */
  if (opts.update_seq) {
    getMaxUpdateSeq(seqStore, function (e) { 
      if (e.target.result && e.target.result.length > 0) {
        updateSeq = e.target.result[0];
      }
    });
  }

  function getMaxUpdateSeq(objectStore, onSuccess) {
    function onCursor(e) {
      var cursor = e.target.result;
      var maxKey = undefined;
      if (cursor && cursor.key) {
        maxKey = cursor.key;
      } 
      return onSuccess({
        target: {
          result: [maxKey]
        }
      });
    }
    objectStore.openCursor(null, 'prev').onsuccess = onCursor;
  }

  // if the user specifies include_docs=true, then we don't
  // want to block the main cursor while we're fetching the doc
  function fetchDocAsynchronously(metadata, row, winningRev) {
    var key = metadata.id + "::" + winningRev;
    docIdRevIndex.get(key).onsuccess =  function onGetDoc(e) {
      row.doc = decodeDoc(e.target.result) || {};
      if (opts.conflicts) {
        var conflicts = collectConflicts(metadata);
        if (conflicts.length) {
          row.doc._conflicts = conflicts;
        }
      }
      fetchAttachmentsIfNecessary(row.doc, opts, txn);
    };
  }

  function allDocsInner(winningRev, metadata) {
    var row = {
      id: metadata.id,
      key: metadata.id,
      value: {
        rev: winningRev
      }
    };
    var deleted = metadata.deleted;
    if (deleted) {
      if (keys) {
        results.push(row);
        // deleted docs are okay with "keys" requests
        row.value.deleted = true;
        row.doc = null;
      }
    } else if (skip-- <= 0) {
      results.push(row);
      if (opts.include_docs) {
        fetchDocAsynchronously(metadata, row, winningRev);
      }
    }
  }

  function processBatch(batchValues) {
    for (var i = 0, len = batchValues.length; i < len; i++) {
      if (results.length === limit) {
        break;
      }
      var batchValue = batchValues[i];
      if (batchValue.error && keys) {
        // key was not found with "keys" requests
        results.push(batchValue);
        continue;
      }
      var metadata = decodeMetadata(batchValue);
      var winningRev = metadata.winningRev;
      allDocsInner(winningRev, metadata);
    }
  }

  function onBatch(batchKeys, batchValues, cursor) {
    if (!cursor) {
      return;
    }
    processBatch(batchValues);
    if (results.length < limit) {
      cursor.continue();
    }
  }

  function onGetAll(e) {
    var values = e.target.result;
    if (opts.descending) {
      values = values.reverse();
    }
    processBatch(values);
  }

  function onResultsReady() {
    var returnVal = {
      total_rows: docCount,
      offset: opts.skip,
      rows: results
    };
    
    /* istanbul ignore if */
    if (opts.update_seq && updateSeq !== undefined) {
      returnVal.update_seq = updateSeq;
    }
    callback(null, returnVal);
  }

  function onTxnComplete() {
    if (opts.attachments) {
      postProcessAttachments(results, opts.binary).then(onResultsReady);
    } else {
      onResultsReady();
    }
  }

  // don't bother doing any requests if start > end or limit === 0
  if (keyRangeError || limit === 0) {
    return;
  }
  if (keys) {
    return allDocsKeys(keys, docStore, onBatch);
  }
  if (limit === -1) { // just fetch everything
    return getAll(docStore, keyRange, onGetAll);
  }
  // else do a cursor
  // choose a batch size based on the skip, since we'll need to skip that many
  runBatchedCursor(docStore, keyRange, opts.descending, limit + skip, onBatch);
}

//
// Blobs are not supported in all versions of IndexedDB, notably
// Chrome <37 and Android <5. In those versions, storing a blob will throw.
//
// Various other blob bugs exist in Chrome v37-42 (inclusive).
// Detecting them is expensive and confusing to users, and Chrome 37-42
// is at very low usage worldwide, so we do a hacky userAgent check instead.
//
// content-type bug: https://code.google.com/p/chromium/issues/detail?id=408120
// 404 bug: https://code.google.com/p/chromium/issues/detail?id=447916
// FileReader bug: https://code.google.com/p/chromium/issues/detail?id=447836
//
function checkBlobSupport(txn) {
  return new Promise(function (resolve) {
    var blob = new Blob(['']);
    var req = txn.objectStore(DETECT_BLOB_SUPPORT_STORE).put(blob, 'key');

    req.onsuccess = function () {
      var matchedChrome = navigator.userAgent.match(/Chrome\/(\d+)/);
      var matchedEdge = navigator.userAgent.match(/Edge\//);
      // MS Edge pretends to be Chrome 42:
      // https://msdn.microsoft.com/en-us/library/hh869301%28v=vs.85%29.aspx
      resolve(matchedEdge || !matchedChrome ||
        parseInt(matchedChrome[1], 10) >= 43);
    };

    req.onerror = txn.onabort = function (e) {
      // If the transaction aborts now its due to not being able to
      // write to the database, likely due to the disk being full
      e.preventDefault();
      e.stopPropagation();
      resolve(false);
    };
  }).catch(function () {
    return false; // error, so assume unsupported
  });
}

function countDocs(txn, cb) {
  var index = txn.objectStore(DOC_STORE).index('deletedOrLocal');
  index.count(IDBKeyRange.only('0')).onsuccess = function (e) {
    cb(e.target.result);
  };
}

// This task queue ensures that IDB open calls are done in their own tick
// and sequentially - i.e. we wait for the async IDB open to *fully* complete
// before calling the next one. This works around IE/Edge race conditions in IDB.


var running = false;
var queue = [];

function tryCode(fun, err, res, PouchDB) {
  try {
    fun(err, res);
  } catch (err) {
    // Shouldn't happen, but in some odd cases
    // IndexedDB implementations might throw a sync
    // error, in which case this will at least log it.
    PouchDB.emit('error', err);
  }
}

function applyNext() {
  if (running || !queue.length) {
    return;
  }
  running = true;
  queue.shift()();
}

function enqueueTask(action, callback, PouchDB) {
  queue.push(function runAction() {
    action(function runCallback(err, res) {
      tryCode(callback, err, res, PouchDB);
      running = false;
      immediate(function runNext() {
        applyNext();
      });
    });
  });
  applyNext();
}

function changes(opts, api, dbName, idb) {
  opts = clone(opts);

  if (opts.continuous) {
    var id = dbName + ':' + uuid();
    changesHandler.addListener(dbName, id, api, opts);
    changesHandler.notify(dbName);
    return {
      cancel: function () {
        changesHandler.removeListener(dbName, id);
      }
    };
  }

  var docIds = opts.doc_ids && new Set(opts.doc_ids);

  opts.since = opts.since || 0;
  var lastSeq = opts.since;

  var limit = 'limit' in opts ? opts.limit : -1;
  if (limit === 0) {
    limit = 1; // per CouchDB _changes spec
  }

  var results = [];
  var numResults = 0;
  var filter = filterChange(opts);
  var docIdsToMetadata = new Map();

  var txn;
  var bySeqStore;
  var docStore;
  var docIdRevIndex;

  function onBatch(batchKeys, batchValues, cursor) {
    if (!cursor || !batchKeys.length) { // done
      return;
    }

    var winningDocs = new Array(batchKeys.length);
    var metadatas = new Array(batchKeys.length);

    function processMetadataAndWinningDoc(metadata, winningDoc) {
      var change = opts.processChange(winningDoc, metadata, opts);
      lastSeq = change.seq = metadata.seq;

      var filtered = filter(change);
      if (typeof filtered === 'object') { // anything but true/false indicates error
        return Promise.reject(filtered);
      }

      if (!filtered) {
        return Promise.resolve();
      }
      numResults++;
      if (opts.return_docs) {
        results.push(change);
      }
      // process the attachment immediately
      // for the benefit of live listeners
      if (opts.attachments && opts.include_docs) {
        return new Promise(function (resolve) {
          fetchAttachmentsIfNecessary(winningDoc, opts, txn, function () {
            postProcessAttachments([change], opts.binary).then(function () {
              resolve(change);
            });
          });
        });
      } else {
        return Promise.resolve(change);
      }
    }

    function onBatchDone() {
      var promises = [];
      for (var i = 0, len = winningDocs.length; i < len; i++) {
        if (numResults === limit) {
          break;
        }
        var winningDoc = winningDocs[i];
        if (!winningDoc) {
          continue;
        }
        var metadata = metadatas[i];
        promises.push(processMetadataAndWinningDoc(metadata, winningDoc));
      }

      Promise.all(promises).then(function (changes) {
        for (var i = 0, len = changes.length; i < len; i++) {
          if (changes[i]) {
            opts.onChange(changes[i]);
          }
        }
      }).catch(opts.complete);

      if (numResults !== limit) {
        cursor.continue();
      }
    }

    // Fetch all metadatas/winningdocs from this batch in parallel, then process
    // them all only once all data has been collected. This is done in parallel
    // because it's faster than doing it one-at-a-time.
    var numDone = 0;
    batchValues.forEach(function (value, i) {
      var doc = decodeDoc(value);
      var seq = batchKeys[i];
      fetchWinningDocAndMetadata(doc, seq, function (metadata, winningDoc) {
        metadatas[i] = metadata;
        winningDocs[i] = winningDoc;
        if (++numDone === batchKeys.length) {
          onBatchDone();
        }
      });
    });
  }

  function onGetMetadata(doc, seq, metadata, cb) {
    if (metadata.seq !== seq) {
      // some other seq is later
      return cb();
    }

    if (metadata.winningRev === doc._rev) {
      // this is the winning doc
      return cb(metadata, doc);
    }

    // fetch winning doc in separate request
    var docIdRev = doc._id + '::' + metadata.winningRev;
    var req = docIdRevIndex.get(docIdRev);
    req.onsuccess = function (e) {
      cb(metadata, decodeDoc(e.target.result));
    };
  }

  function fetchWinningDocAndMetadata(doc, seq, cb) {
    if (docIds && !docIds.has(doc._id)) {
      return cb();
    }

    var metadata = docIdsToMetadata.get(doc._id);
    if (metadata) { // cached
      return onGetMetadata(doc, seq, metadata, cb);
    }
    // metadata not cached, have to go fetch it
    docStore.get(doc._id).onsuccess = function (e) {
      metadata = decodeMetadata(e.target.result);
      docIdsToMetadata.set(doc._id, metadata);
      onGetMetadata(doc, seq, metadata, cb);
    };
  }

  function finish() {
    opts.complete(null, {
      results: results,
      last_seq: lastSeq
    });
  }

  function onTxnComplete() {
    if (!opts.continuous && opts.attachments) {
      // cannot guarantee that postProcessing was already done,
      // so do it again
      postProcessAttachments(results).then(finish);
    } else {
      finish();
    }
  }

  var objectStores = [DOC_STORE, BY_SEQ_STORE];
  if (opts.attachments) {
    objectStores.push(ATTACH_STORE);
  }
  var txnResult = openTransactionSafely(idb, objectStores, 'readonly');
  if (txnResult.error) {
    return opts.complete(txnResult.error);
  }
  txn = txnResult.txn;
  txn.onabort = idbError(opts.complete);
  txn.oncomplete = onTxnComplete;

  bySeqStore = txn.objectStore(BY_SEQ_STORE);
  docStore = txn.objectStore(DOC_STORE);
  docIdRevIndex = bySeqStore.index('_doc_id_rev');

  var keyRange = (opts.since && !opts.descending) ?
    IDBKeyRange.lowerBound(opts.since, true) : null;

  runBatchedCursor(bySeqStore, keyRange, opts.descending, limit, onBatch);
}

var cachedDBs = new Map();
var blobSupportPromise;
var openReqList = new Map();

function IdbPouch(opts, callback) {
  var api = this;

  enqueueTask(function (thisCallback) {
    init(api, opts, thisCallback);
  }, callback, api.constructor);
}

function init(api, opts, callback) {

  var dbName = opts.name;

  var idb = null;
  var idbGlobalFailureError = null;
  api._meta = null;

  function enrichCallbackError(callback) {
    return function (error, result) {
      if (error && error instanceof Error && !error.reason) {
        if (idbGlobalFailureError) {
          error.reason = idbGlobalFailureError;
        }
      }

      callback(error, result);
    };
  }

  // called when creating a fresh new database
  function createSchema(db) {
    var docStore = db.createObjectStore(DOC_STORE, {keyPath : 'id'});
    db.createObjectStore(BY_SEQ_STORE, {autoIncrement: true})
      .createIndex('_doc_id_rev', '_doc_id_rev', {unique: true});
    db.createObjectStore(ATTACH_STORE, {keyPath: 'digest'});
    db.createObjectStore(META_STORE, {keyPath: 'id', autoIncrement: false});
    db.createObjectStore(DETECT_BLOB_SUPPORT_STORE);

    // added in v2
    docStore.createIndex('deletedOrLocal', 'deletedOrLocal', {unique : false});

    // added in v3
    db.createObjectStore(LOCAL_STORE, {keyPath: '_id'});

    // added in v4
    var attAndSeqStore = db.createObjectStore(ATTACH_AND_SEQ_STORE,
      {autoIncrement: true});
    attAndSeqStore.createIndex('seq', 'seq');
    attAndSeqStore.createIndex('digestSeq', 'digestSeq', {unique: true});
  }

  // migration to version 2
  // unfortunately "deletedOrLocal" is a misnomer now that we no longer
  // store local docs in the main doc-store, but whaddyagonnado
  function addDeletedOrLocalIndex(txn, callback) {
    var docStore = txn.objectStore(DOC_STORE);
    docStore.createIndex('deletedOrLocal', 'deletedOrLocal', {unique : false});

    docStore.openCursor().onsuccess = function (event) {
      var cursor = event.target.result;
      if (cursor) {
        var metadata = cursor.value;
        var deleted = isDeleted(metadata);
        metadata.deletedOrLocal = deleted ? "1" : "0";
        docStore.put(metadata);
        cursor.continue();
      } else {
        callback();
      }
    };
  }

  // migration to version 3 (part 1)
  function createLocalStoreSchema(db) {
    db.createObjectStore(LOCAL_STORE, {keyPath: '_id'})
      .createIndex('_doc_id_rev', '_doc_id_rev', {unique: true});
  }

  // migration to version 3 (part 2)
  function migrateLocalStore(txn, cb) {
    var localStore = txn.objectStore(LOCAL_STORE);
    var docStore = txn.objectStore(DOC_STORE);
    var seqStore = txn.objectStore(BY_SEQ_STORE);

    var cursor = docStore.openCursor();
    cursor.onsuccess = function (event) {
      var cursor = event.target.result;
      if (cursor) {
        var metadata = cursor.value;
        var docId = metadata.id;
        var local = isLocalId(docId);
        var rev = winningRev(metadata);
        if (local) {
          var docIdRev = docId + "::" + rev;
          // remove all seq entries
          // associated with this docId
          var start = docId + "::";
          var end = docId + "::~";
          var index = seqStore.index('_doc_id_rev');
          var range = IDBKeyRange.bound(start, end, false, false);
          var seqCursor = index.openCursor(range);
          seqCursor.onsuccess = function (e) {
            seqCursor = e.target.result;
            if (!seqCursor) {
              // done
              docStore.delete(cursor.primaryKey);
              cursor.continue();
            } else {
              var data = seqCursor.value;
              if (data._doc_id_rev === docIdRev) {
                localStore.put(data);
              }
              seqStore.delete(seqCursor.primaryKey);
              seqCursor.continue();
            }
          };
        } else {
          cursor.continue();
        }
      } else if (cb) {
        cb();
      }
    };
  }

  // migration to version 4 (part 1)
  function addAttachAndSeqStore(db) {
    var attAndSeqStore = db.createObjectStore(ATTACH_AND_SEQ_STORE,
      {autoIncrement: true});
    attAndSeqStore.createIndex('seq', 'seq');
    attAndSeqStore.createIndex('digestSeq', 'digestSeq', {unique: true});
  }

  // migration to version 4 (part 2)
  function migrateAttsAndSeqs(txn, callback) {
    var seqStore = txn.objectStore(BY_SEQ_STORE);
    var attStore = txn.objectStore(ATTACH_STORE);
    var attAndSeqStore = txn.objectStore(ATTACH_AND_SEQ_STORE);

    // need to actually populate the table. this is the expensive part,
    // so as an optimization, check first that this database even
    // contains attachments
    var req = attStore.count();
    req.onsuccess = function (e) {
      var count = e.target.result;
      if (!count) {
        return callback(); // done
      }

      seqStore.openCursor().onsuccess = function (e) {
        var cursor = e.target.result;
        if (!cursor) {
          return callback(); // done
        }
        var doc = cursor.value;
        var seq = cursor.primaryKey;
        var atts = Object.keys(doc._attachments || {});
        var digestMap = {};
        for (var j = 0; j < atts.length; j++) {
          var att = doc._attachments[atts[j]];
          digestMap[att.digest] = true; // uniq digests, just in case
        }
        var digests = Object.keys(digestMap);
        for (j = 0; j < digests.length; j++) {
          var digest = digests[j];
          attAndSeqStore.put({
            seq: seq,
            digestSeq: digest + '::' + seq
          });
        }
        cursor.continue();
      };
    };
  }

  // migration to version 5
  // Instead of relying on on-the-fly migration of metadata,
  // this brings the doc-store to its modern form:
  // - metadata.winningrev
  // - metadata.seq
  // - stringify the metadata when storing it
  function migrateMetadata(txn) {

    function decodeMetadataCompat(storedObject) {
      if (!storedObject.data) {
        // old format, when we didn't store it stringified
        storedObject.deleted = storedObject.deletedOrLocal === '1';
        return storedObject;
      }
      return decodeMetadata(storedObject);
    }

    // ensure that every metadata has a winningRev and seq,
    // which was previously created on-the-fly but better to migrate
    var bySeqStore = txn.objectStore(BY_SEQ_STORE);
    var docStore = txn.objectStore(DOC_STORE);
    var cursor = docStore.openCursor();
    cursor.onsuccess = function (e) {
      var cursor = e.target.result;
      if (!cursor) {
        return; // done
      }
      var metadata = decodeMetadataCompat(cursor.value);

      metadata.winningRev = metadata.winningRev ||
        winningRev(metadata);

      function fetchMetadataSeq() {
        // metadata.seq was added post-3.2.0, so if it's missing,
        // we need to fetch it manually
        var start = metadata.id + '::';
        var end = metadata.id + '::\uffff';
        var req = bySeqStore.index('_doc_id_rev').openCursor(
          IDBKeyRange.bound(start, end));

        var metadataSeq = 0;
        req.onsuccess = function (e) {
          var cursor = e.target.result;
          if (!cursor) {
            metadata.seq = metadataSeq;
            return onGetMetadataSeq();
          }
          var seq = cursor.primaryKey;
          if (seq > metadataSeq) {
            metadataSeq = seq;
          }
          cursor.continue();
        };
      }

      function onGetMetadataSeq() {
        var metadataToStore = encodeMetadata(metadata,
          metadata.winningRev, metadata.deleted);

        var req = docStore.put(metadataToStore);
        req.onsuccess = function () {
          cursor.continue();
        };
      }

      if (metadata.seq) {
        return onGetMetadataSeq();
      }

      fetchMetadataSeq();
    };

  }

  api._remote = false;
  api.type = function () {
    return 'idb';
  };

  api._id = toPromise(function (callback) {
    callback(null, api._meta.instanceId);
  });

  api._bulkDocs = function idb_bulkDocs(req, reqOpts, callback) {
    idbBulkDocs(opts, req, reqOpts, api, idb, enrichCallbackError(callback));
  };

  // First we look up the metadata in the ids database, then we fetch the
  // current revision(s) from the by sequence store
  api._get = function idb_get(id, opts, callback) {
    var doc;
    var metadata;
    var err;
    var txn = opts.ctx;
    if (!txn) {
      var txnResult = openTransactionSafely(idb,
        [DOC_STORE, BY_SEQ_STORE, ATTACH_STORE], 'readonly');
      if (txnResult.error) {
        return callback(txnResult.error);
      }
      txn = txnResult.txn;
    }

    function finish() {
      callback(err, {doc: doc, metadata: metadata, ctx: txn});
    }

    txn.objectStore(DOC_STORE).get(id).onsuccess = function (e) {
      metadata = decodeMetadata(e.target.result);
      // we can determine the result here if:
      // 1. there is no such document
      // 2. the document is deleted and we don't ask about specific rev
      // When we ask with opts.rev we expect the answer to be either
      // doc (possibly with _deleted=true) or missing error
      if (!metadata) {
        err = createError(MISSING_DOC, 'missing');
        return finish();
      }

      var rev;
      if (!opts.rev) {
        rev = metadata.winningRev;
        var deleted = isDeleted(metadata);
        if (deleted) {
          err = createError(MISSING_DOC, "deleted");
          return finish();
        }
      } else {
        rev = opts.latest ? latest(opts.rev, metadata) : opts.rev;
      }

      var objectStore = txn.objectStore(BY_SEQ_STORE);
      var key = metadata.id + '::' + rev;

      objectStore.index('_doc_id_rev').get(key).onsuccess = function (e) {
        doc = e.target.result;
        if (doc) {
          doc = decodeDoc(doc);
        }
        if (!doc) {
          err = createError(MISSING_DOC, 'missing');
          return finish();
        }
        finish();
      };
    };
  };

  api._getAttachment = function (docId, attachId, attachment, opts, callback) {
    var txn;
    if (opts.ctx) {
      txn = opts.ctx;
    } else {
      var txnResult = openTransactionSafely(idb,
        [DOC_STORE, BY_SEQ_STORE, ATTACH_STORE], 'readonly');
      if (txnResult.error) {
        return callback(txnResult.error);
      }
      txn = txnResult.txn;
    }
    var digest = attachment.digest;
    var type = attachment.content_type;

    txn.objectStore(ATTACH_STORE).get(digest).onsuccess = function (e) {
      var body = e.target.result.body;
      readBlobData(body, type, opts.binary, function (blobData) {
        callback(null, blobData);
      });
    };
  };

  api._info = function idb_info(callback) {
    var updateSeq;
    var docCount;

    var txnResult = openTransactionSafely(idb, [META_STORE, BY_SEQ_STORE], 'readonly');
    if (txnResult.error) {
      return callback(txnResult.error);
    }
    var txn = txnResult.txn;
    txn.objectStore(META_STORE).get(META_STORE).onsuccess = function (e) {
      docCount = e.target.result.docCount;
    };
    txn.objectStore(BY_SEQ_STORE).openCursor(null, 'prev').onsuccess = function (e) {
      var cursor = e.target.result;
      updateSeq = cursor ? cursor.key : 0;
    };

    txn.oncomplete = function () {
      callback(null, {
        doc_count: docCount,
        update_seq: updateSeq,
        // for debugging
        idb_attachment_format: (api._meta.blobSupport ? 'binary' : 'base64')
      });
    };
  };

  api._allDocs = function idb_allDocs(opts, callback) {
    idbAllDocs(opts, idb, enrichCallbackError(callback));
  };

  api._changes = function idbChanges(opts) {
    return changes(opts, api, dbName, idb);
  };

  api._close = function (callback) {
    // https://developer.mozilla.org/en-US/docs/IndexedDB/IDBDatabase#close
    // "Returns immediately and closes the connection in a separate thread..."
    idb.close();
    cachedDBs.delete(dbName);
    callback();
  };

  api._getRevisionTree = function (docId, callback) {
    var txnResult = openTransactionSafely(idb, [DOC_STORE], 'readonly');
    if (txnResult.error) {
      return callback(txnResult.error);
    }
    var txn = txnResult.txn;
    var req = txn.objectStore(DOC_STORE).get(docId);
    req.onsuccess = function (event) {
      var doc = decodeMetadata(event.target.result);
      if (!doc) {
        callback(createError(MISSING_DOC));
      } else {
        callback(null, doc.rev_tree);
      }
    };
  };

  // This function removes revisions of document docId
  // which are listed in revs and sets this document
  // revision to to rev_tree
  api._doCompaction = function (docId, revs, callback) {
    var stores = [
      DOC_STORE,
      BY_SEQ_STORE,
      ATTACH_STORE,
      ATTACH_AND_SEQ_STORE
    ];
    var txnResult = openTransactionSafely(idb, stores, 'readwrite');
    if (txnResult.error) {
      return callback(txnResult.error);
    }
    var txn = txnResult.txn;

    var docStore = txn.objectStore(DOC_STORE);

    docStore.get(docId).onsuccess = function (event) {
      var metadata = decodeMetadata(event.target.result);
      traverseRevTree(metadata.rev_tree, function (isLeaf, pos,
                                                         revHash, ctx, opts) {
        var rev = pos + '-' + revHash;
        if (revs.indexOf(rev) !== -1) {
          opts.status = 'missing';
        }
      });
      compactRevs(revs, docId, txn);
      var winningRev = metadata.winningRev;
      var deleted = metadata.deleted;
      txn.objectStore(DOC_STORE).put(
        encodeMetadata(metadata, winningRev, deleted));
    };
    txn.onabort = idbError(callback);
    txn.oncomplete = function () {
      callback();
    };
  };


  api._getLocal = function (id, callback) {
    var txnResult = openTransactionSafely(idb, [LOCAL_STORE], 'readonly');
    if (txnResult.error) {
      return callback(txnResult.error);
    }
    var tx = txnResult.txn;
    var req = tx.objectStore(LOCAL_STORE).get(id);

    req.onerror = idbError(callback);
    req.onsuccess = function (e) {
      var doc = e.target.result;
      if (!doc) {
        callback(createError(MISSING_DOC));
      } else {
        delete doc['_doc_id_rev']; // for backwards compat
        callback(null, doc);
      }
    };
  };

  api._putLocal = function (doc, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    delete doc._revisions; // ignore this, trust the rev
    var oldRev = doc._rev;
    var id = doc._id;
    if (!oldRev) {
      doc._rev = '0-1';
    } else {
      doc._rev = '0-' + (parseInt(oldRev.split('-')[1], 10) + 1);
    }

    var tx = opts.ctx;
    var ret;
    if (!tx) {
      var txnResult = openTransactionSafely(idb, [LOCAL_STORE], 'readwrite');
      if (txnResult.error) {
        return callback(txnResult.error);
      }
      tx = txnResult.txn;
      tx.onerror = idbError(callback);
      tx.oncomplete = function () {
        if (ret) {
          callback(null, ret);
        }
      };
    }

    var oStore = tx.objectStore(LOCAL_STORE);
    var req;
    if (oldRev) {
      req = oStore.get(id);
      req.onsuccess = function (e) {
        var oldDoc = e.target.result;
        if (!oldDoc || oldDoc._rev !== oldRev) {
          callback(createError(REV_CONFLICT));
        } else { // update
          var req = oStore.put(doc);
          req.onsuccess = function () {
            ret = {ok: true, id: doc._id, rev: doc._rev};
            if (opts.ctx) { // return immediately
              callback(null, ret);
            }
          };
        }
      };
    } else { // new doc
      req = oStore.add(doc);
      req.onerror = function (e) {
        // constraint error, already exists
        callback(createError(REV_CONFLICT));
        e.preventDefault(); // avoid transaction abort
        e.stopPropagation(); // avoid transaction onerror
      };
      req.onsuccess = function () {
        ret = {ok: true, id: doc._id, rev: doc._rev};
        if (opts.ctx) { // return immediately
          callback(null, ret);
        }
      };
    }
  };

  api._removeLocal = function (doc, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    var tx = opts.ctx;
    if (!tx) {
      var txnResult = openTransactionSafely(idb, [LOCAL_STORE], 'readwrite');
      if (txnResult.error) {
        return callback(txnResult.error);
      }
      tx = txnResult.txn;
      tx.oncomplete = function () {
        if (ret) {
          callback(null, ret);
        }
      };
    }
    var ret;
    var id = doc._id;
    var oStore = tx.objectStore(LOCAL_STORE);
    var req = oStore.get(id);

    req.onerror = idbError(callback);
    req.onsuccess = function (e) {
      var oldDoc = e.target.result;
      if (!oldDoc || oldDoc._rev !== doc._rev) {
        callback(createError(MISSING_DOC));
      } else {
        oStore.delete(id);
        ret = {ok: true, id: id, rev: '0-0'};
        if (opts.ctx) { // return immediately
          callback(null, ret);
        }
      }
    };
  };

  api._destroy = function (opts, callback) {
    changesHandler.removeAllListeners(dbName);

    //Close open request for "dbName" database to fix ie delay.
    var openReq = openReqList.get(dbName);
    if (openReq && openReq.result) {
      openReq.result.close();
      cachedDBs.delete(dbName);
    }
    var req = indexedDB.deleteDatabase(dbName);

    req.onsuccess = function () {
      //Remove open request from the list.
      openReqList.delete(dbName);
      if (hasLocalStorage() && (dbName in localStorage)) {
        delete localStorage[dbName];
      }
      callback(null, { 'ok': true });
    };

    req.onerror = idbError(callback);
  };

  var cached = cachedDBs.get(dbName);

  if (cached) {
    idb = cached.idb;
    api._meta = cached.global;
    return immediate(function () {
      callback(null, api);
    });
  }

  var req = indexedDB.open(dbName, ADAPTER_VERSION);
  openReqList.set(dbName, req);

  req.onupgradeneeded = function (e) {
    var db = e.target.result;
    if (e.oldVersion < 1) {
      return createSchema(db); // new db, initial schema
    }
    // do migrations

    var txn = e.currentTarget.transaction;
    // these migrations have to be done in this function, before
    // control is returned to the event loop, because IndexedDB

    if (e.oldVersion < 3) {
      createLocalStoreSchema(db); // v2 -> v3
    }
    if (e.oldVersion < 4) {
      addAttachAndSeqStore(db); // v3 -> v4
    }

    var migrations = [
      addDeletedOrLocalIndex, // v1 -> v2
      migrateLocalStore,      // v2 -> v3
      migrateAttsAndSeqs,     // v3 -> v4
      migrateMetadata         // v4 -> v5
    ];

    var i = e.oldVersion;

    function next() {
      var migration = migrations[i - 1];
      i++;
      if (migration) {
        migration(txn, next);
      }
    }

    next();
  };

  req.onsuccess = function (e) {

    idb = e.target.result;

    idb.onversionchange = function () {
      idb.close();
      cachedDBs.delete(dbName);
    };

    idb.onabort = function (e) {
      guardedConsole('error', 'Database has a global failure', e.target.error);
      idbGlobalFailureError = e.target.error;
      idb.close();
      cachedDBs.delete(dbName);
    };

    // Do a few setup operations (in parallel as much as possible):
    // 1. Fetch meta doc
    // 2. Check blob support
    // 3. Calculate docCount
    // 4. Generate an instanceId if necessary
    // 5. Store docCount and instanceId on meta doc

    var txn = idb.transaction([
      META_STORE,
      DETECT_BLOB_SUPPORT_STORE,
      DOC_STORE
    ], 'readwrite');

    var storedMetaDoc = false;
    var metaDoc;
    var docCount;
    var blobSupport;
    var instanceId;

    function completeSetup() {
      if (typeof blobSupport === 'undefined' || !storedMetaDoc) {
        return;
      }
      api._meta = {
        name: dbName,
        instanceId: instanceId,
        blobSupport: blobSupport
      };

      cachedDBs.set(dbName, {
        idb: idb,
        global: api._meta
      });
      callback(null, api);
    }

    function storeMetaDocIfReady() {
      if (typeof docCount === 'undefined' || typeof metaDoc === 'undefined') {
        return;
      }
      var instanceKey = dbName + '_id';
      if (instanceKey in metaDoc) {
        instanceId = metaDoc[instanceKey];
      } else {
        metaDoc[instanceKey] = instanceId = uuid();
      }
      metaDoc.docCount = docCount;
      txn.objectStore(META_STORE).put(metaDoc);
    }

    //
    // fetch or generate the instanceId
    //
    txn.objectStore(META_STORE).get(META_STORE).onsuccess = function (e) {
      metaDoc = e.target.result || { id: META_STORE };
      storeMetaDocIfReady();
    };

    //
    // countDocs
    //
    countDocs(txn, function (count) {
      docCount = count;
      storeMetaDocIfReady();
    });

    //
    // check blob support
    //
    if (!blobSupportPromise) {
      // make sure blob support is only checked once
      blobSupportPromise = checkBlobSupport(txn);
    }

    blobSupportPromise.then(function (val) {
      blobSupport = val;
      completeSetup();
    });

    // only when the metadata put transaction has completed,
    // consider the setup done
    txn.oncomplete = function () {
      storedMetaDoc = true;
      completeSetup();
    };
    txn.onabort = idbError(callback);
  };

  req.onerror = function (e) {
    var msg = e.target.error && e.target.error.message;

    if (!msg) {
      msg = 'Failed to open indexedDB, are you in private browsing mode?';
    } else if (msg.indexOf("stored database is a higher version") !== -1) {
      msg = new Error('This DB was created with the newer "indexeddb" adapter, but you are trying to open it with the older "idb" adapter');
    }

    guardedConsole('error', msg);
    callback(createError(IDB_ERROR, msg));
  };
}

IdbPouch.valid = function () {
  // Following #7085 buggy idb versions (typically Safari < 10.1) are
  // considered valid.

  // On Firefox SecurityError is thrown while referencing indexedDB if cookies
  // are not allowed. `typeof indexedDB` also triggers the error.
  try {
    // some outdated implementations of IDB that appear on Samsung
    // and HTC Android devices <4.4 are missing IDBKeyRange
    return typeof indexedDB !== 'undefined' && typeof IDBKeyRange !== 'undefined';
  } catch (e) {
    return false;
  }
};

function IDBPouch (PouchDB) {
  PouchDB.adapter('idb', IdbPouch, true);
}

export { IDBPouch as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG91Y2hkYi1hZGFwdGVyLWlkYi5icm93c2VyLmpzIiwic291cmNlcyI6WyIuLi9wYWNrYWdlcy9wb3VjaGRiLWFkYXB0ZXItaWRiL3NyYy9jb25zdGFudHMuanMiLCIuLi9wYWNrYWdlcy9wb3VjaGRiLWFkYXB0ZXItaWRiL3NyYy91dGlscy5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItYWRhcHRlci1pZGIvc3JjL2NoYW5nZXNIYW5kbGVyLmpzIiwiLi4vcGFja2FnZXMvcG91Y2hkYi1hZGFwdGVyLWlkYi9zcmMvYnVsa0RvY3MuanMiLCIuLi9wYWNrYWdlcy9wb3VjaGRiLWFkYXB0ZXItaWRiL3NyYy9ydW5CYXRjaGVkQ3Vyc29yLmpzIiwiLi4vcGFja2FnZXMvcG91Y2hkYi1hZGFwdGVyLWlkYi9zcmMvZ2V0QWxsLmpzIiwiLi4vcGFja2FnZXMvcG91Y2hkYi1hZGFwdGVyLWlkYi9zcmMvYWxsRG9jcy5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItYWRhcHRlci1pZGIvc3JjL2Jsb2JTdXBwb3J0LmpzIiwiLi4vcGFja2FnZXMvcG91Y2hkYi1hZGFwdGVyLWlkYi9zcmMvY291bnREb2NzLmpzIiwiLi4vcGFja2FnZXMvcG91Y2hkYi1hZGFwdGVyLWlkYi9zcmMvdGFza1F1ZXVlLmpzIiwiLi4vcGFja2FnZXMvcG91Y2hkYi1hZGFwdGVyLWlkYi9zcmMvY2hhbmdlcy5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItYWRhcHRlci1pZGIvc3JjL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIEluZGV4ZWREQiByZXF1aXJlcyBhIHZlcnNpb25lZCBkYXRhYmFzZSBzdHJ1Y3R1cmUsIHNvIHdlIHVzZSB0aGVcbi8vIHZlcnNpb24gaGVyZSB0byBtYW5hZ2UgbWlncmF0aW9ucy5cbnZhciBBREFQVEVSX1ZFUlNJT04gPSA1O1xuXG4vLyBUaGUgb2JqZWN0IHN0b3JlcyBjcmVhdGVkIGZvciBlYWNoIGRhdGFiYXNlXG4vLyBET0NfU1RPUkUgc3RvcmVzIHRoZSBkb2N1bWVudCBtZXRhIGRhdGEsIGl0cyByZXZpc2lvbiBoaXN0b3J5IGFuZCBzdGF0ZVxuLy8gS2V5ZWQgYnkgZG9jdW1lbnQgaWRcbnZhciBET0NfU1RPUkUgPSAnZG9jdW1lbnQtc3RvcmUnO1xuLy8gQllfU0VRX1NUT1JFIHN0b3JlcyBhIHBhcnRpY3VsYXIgdmVyc2lvbiBvZiBhIGRvY3VtZW50LCBrZXllZCBieSBpdHNcbi8vIHNlcXVlbmNlIGlkXG52YXIgQllfU0VRX1NUT1JFID0gJ2J5LXNlcXVlbmNlJztcbi8vIFdoZXJlIHdlIHN0b3JlIGF0dGFjaG1lbnRzXG52YXIgQVRUQUNIX1NUT1JFID0gJ2F0dGFjaC1zdG9yZSc7XG4vLyBXaGVyZSB3ZSBzdG9yZSBtYW55LXRvLW1hbnkgcmVsYXRpb25zXG4vLyBiZXR3ZWVuIGF0dGFjaG1lbnQgZGlnZXN0cyBhbmQgc2Vxc1xudmFyIEFUVEFDSF9BTkRfU0VRX1NUT1JFID0gJ2F0dGFjaC1zZXEtc3RvcmUnO1xuXG4vLyBXaGVyZSB3ZSBzdG9yZSBkYXRhYmFzZS13aWRlIG1ldGEgZGF0YSBpbiBhIHNpbmdsZSByZWNvcmRcbi8vIGtleWVkIGJ5IGlkOiBNRVRBX1NUT1JFXG52YXIgTUVUQV9TVE9SRSA9ICdtZXRhLXN0b3JlJztcbi8vIFdoZXJlIHdlIHN0b3JlIGxvY2FsIGRvY3VtZW50c1xudmFyIExPQ0FMX1NUT1JFID0gJ2xvY2FsLXN0b3JlJztcbi8vIFdoZXJlIHdlIGRldGVjdCBibG9iIHN1cHBvcnRcbnZhciBERVRFQ1RfQkxPQl9TVVBQT1JUX1NUT1JFID0gJ2RldGVjdC1ibG9iLXN1cHBvcnQnO1xuXG5leHBvcnQge1xuICBBREFQVEVSX1ZFUlNJT04gYXMgQURBUFRFUl9WRVJTSU9OLFxuICBET0NfU1RPUkUgYXMgRE9DX1NUT1JFLFxuICBCWV9TRVFfU1RPUkUgYXMgQllfU0VRX1NUT1JFLFxuICBBVFRBQ0hfU1RPUkUgYXMgQVRUQUNIX1NUT1JFLFxuICBBVFRBQ0hfQU5EX1NFUV9TVE9SRSBhcyBBVFRBQ0hfQU5EX1NFUV9TVE9SRSxcbiAgTUVUQV9TVE9SRSBhcyBNRVRBX1NUT1JFLFxuICBMT0NBTF9TVE9SRSBhcyBMT0NBTF9TVE9SRSxcbiAgREVURUNUX0JMT0JfU1VQUE9SVF9TVE9SRSBhcyBERVRFQ1RfQkxPQl9TVVBQT1JUX1NUT1JFXG59OyIsIlxuaW1wb3J0IHsgY3JlYXRlRXJyb3IsIElEQl9FUlJPUiB9IGZyb20gJ3BvdWNoZGItZXJyb3JzJztcbmltcG9ydCB7XG4gIHBpY2tcbn0gZnJvbSAncG91Y2hkYi11dGlscyc7XG5pbXBvcnQge1xuICBzYWZlSnNvblBhcnNlLFxuICBzYWZlSnNvblN0cmluZ2lmeVxufSBmcm9tICdwb3VjaGRiLWpzb24nO1xuaW1wb3J0IHtcbiAgYnRvYSxcbiAgcmVhZEFzQmluYXJ5U3RyaW5nLFxuICBiYXNlNjRTdHJpbmdUb0Jsb2JPckJ1ZmZlciBhcyBiNjRTdHJpbmdUb0Jsb2IsXG59IGZyb20gJ3BvdWNoZGItYmluYXJ5LXV0aWxzJztcbmltcG9ydCB7IEFUVEFDSF9BTkRfU0VRX1NUT1JFLCBBVFRBQ0hfU1RPUkUsIEJZX1NFUV9TVE9SRSB9IGZyb20gJy4vY29uc3RhbnRzJztcblxuZnVuY3Rpb24gaWRiRXJyb3IoY2FsbGJhY2spIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIChldnQpIHtcbiAgICB2YXIgbWVzc2FnZSA9ICd1bmtub3duX2Vycm9yJztcbiAgICBpZiAoZXZ0LnRhcmdldCAmJiBldnQudGFyZ2V0LmVycm9yKSB7XG4gICAgICBtZXNzYWdlID0gZXZ0LnRhcmdldC5lcnJvci5uYW1lIHx8IGV2dC50YXJnZXQuZXJyb3IubWVzc2FnZTtcbiAgICB9XG4gICAgY2FsbGJhY2soY3JlYXRlRXJyb3IoSURCX0VSUk9SLCBtZXNzYWdlLCBldnQudHlwZSkpO1xuICB9O1xufVxuXG4vLyBVbmZvcnR1bmF0ZWx5LCB0aGUgbWV0YWRhdGEgaGFzIHRvIGJlIHN0cmluZ2lmaWVkXG4vLyB3aGVuIGl0IGlzIHB1dCBpbnRvIHRoZSBkYXRhYmFzZSwgYmVjYXVzZSBvdGhlcndpc2Vcbi8vIEluZGV4ZWREQiBjYW4gdGhyb3cgZXJyb3JzIGZvciBkZWVwbHktbmVzdGVkIG9iamVjdHMuXG4vLyBPcmlnaW5hbGx5IHdlIGp1c3QgdXNlZCBKU09OLnBhcnNlL0pTT04uc3RyaW5naWZ5OyBub3dcbi8vIHdlIHVzZSB0aGlzIGN1c3RvbSB2dXZ1emVsYSBsaWJyYXJ5IHRoYXQgYXZvaWRzIHJlY3Vyc2lvbi5cbi8vIElmIHdlIGNvdWxkIGRvIGl0IGFsbCBvdmVyIGFnYWluLCB3ZSdkIHByb2JhYmx5IHVzZSBhXG4vLyBmb3JtYXQgZm9yIHRoZSByZXZpc2lvbiB0cmVlcyBvdGhlciB0aGFuIEpTT04uXG5mdW5jdGlvbiBlbmNvZGVNZXRhZGF0YShtZXRhZGF0YSwgd2lubmluZ1JldiwgZGVsZXRlZCkge1xuICByZXR1cm4ge1xuICAgIGRhdGE6IHNhZmVKc29uU3RyaW5naWZ5KG1ldGFkYXRhKSxcbiAgICB3aW5uaW5nUmV2OiB3aW5uaW5nUmV2LFxuICAgIGRlbGV0ZWRPckxvY2FsOiBkZWxldGVkID8gJzEnIDogJzAnLFxuICAgIHNlcTogbWV0YWRhdGEuc2VxLCAvLyBoaWdoZXN0IHNlcSBmb3IgdGhpcyBkb2NcbiAgICBpZDogbWV0YWRhdGEuaWRcbiAgfTtcbn1cblxuZnVuY3Rpb24gZGVjb2RlTWV0YWRhdGEoc3RvcmVkT2JqZWN0KSB7XG4gIGlmICghc3RvcmVkT2JqZWN0KSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgdmFyIG1ldGFkYXRhID0gc2FmZUpzb25QYXJzZShzdG9yZWRPYmplY3QuZGF0YSk7XG4gIG1ldGFkYXRhLndpbm5pbmdSZXYgPSBzdG9yZWRPYmplY3Qud2lubmluZ1JldjtcbiAgbWV0YWRhdGEuZGVsZXRlZCA9IHN0b3JlZE9iamVjdC5kZWxldGVkT3JMb2NhbCA9PT0gJzEnO1xuICBtZXRhZGF0YS5zZXEgPSBzdG9yZWRPYmplY3Quc2VxO1xuICByZXR1cm4gbWV0YWRhdGE7XG59XG5cbi8vIHJlYWQgdGhlIGRvYyBiYWNrIG91dCBmcm9tIHRoZSBkYXRhYmFzZS4gd2UgZG9uJ3Qgc3RvcmUgdGhlXG4vLyBfaWQgb3IgX3JldiBiZWNhdXNlIHdlIGFscmVhZHkgaGF2ZSBfZG9jX2lkX3Jldi5cbmZ1bmN0aW9uIGRlY29kZURvYyhkb2MpIHtcbiAgaWYgKCFkb2MpIHtcbiAgICByZXR1cm4gZG9jO1xuICB9XG4gIHZhciBpZHggPSBkb2MuX2RvY19pZF9yZXYubGFzdEluZGV4T2YoJzonKTtcbiAgZG9jLl9pZCA9IGRvYy5fZG9jX2lkX3Jldi5zdWJzdHJpbmcoMCwgaWR4IC0gMSk7XG4gIGRvYy5fcmV2ID0gZG9jLl9kb2NfaWRfcmV2LnN1YnN0cmluZyhpZHggKyAxKTtcbiAgZGVsZXRlIGRvYy5fZG9jX2lkX3JldjtcbiAgcmV0dXJuIGRvYztcbn1cblxuLy8gUmVhZCBhIGJsb2IgZnJvbSB0aGUgZGF0YWJhc2UsIGVuY29kaW5nIGFzIG5lY2Vzc2FyeVxuLy8gYW5kIHRyYW5zbGF0aW5nIGZyb20gYmFzZTY0IGlmIHRoZSBJREIgZG9lc24ndCBzdXBwb3J0XG4vLyBuYXRpdmUgQmxvYnNcbmZ1bmN0aW9uIHJlYWRCbG9iRGF0YShib2R5LCB0eXBlLCBhc0Jsb2IsIGNhbGxiYWNrKSB7XG4gIGlmIChhc0Jsb2IpIHtcbiAgICBpZiAoIWJvZHkpIHtcbiAgICAgIGNhbGxiYWNrKG5ldyBCbG9iKFsnJ10sIHt0eXBlOiB0eXBlfSkpO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIGJvZHkgIT09ICdzdHJpbmcnKSB7IC8vIHdlIGhhdmUgYmxvYiBzdXBwb3J0XG4gICAgICBjYWxsYmFjayhib2R5KTtcbiAgICB9IGVsc2UgeyAvLyBubyBibG9iIHN1cHBvcnRcbiAgICAgIGNhbGxiYWNrKGI2NFN0cmluZ1RvQmxvYihib2R5LCB0eXBlKSk7XG4gICAgfVxuICB9IGVsc2UgeyAvLyBhcyBiYXNlNjQgc3RyaW5nXG4gICAgaWYgKCFib2R5KSB7XG4gICAgICBjYWxsYmFjaygnJyk7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgYm9keSAhPT0gJ3N0cmluZycpIHsgLy8gd2UgaGF2ZSBibG9iIHN1cHBvcnRcbiAgICAgIHJlYWRBc0JpbmFyeVN0cmluZyhib2R5LCBmdW5jdGlvbiAoYmluYXJ5KSB7XG4gICAgICAgIGNhbGxiYWNrKGJ0b2EoYmluYXJ5KSk7XG4gICAgICB9KTtcbiAgICB9IGVsc2UgeyAvLyBubyBibG9iIHN1cHBvcnRcbiAgICAgIGNhbGxiYWNrKGJvZHkpO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBmZXRjaEF0dGFjaG1lbnRzSWZOZWNlc3NhcnkoZG9jLCBvcHRzLCB0eG4sIGNiKSB7XG4gIHZhciBhdHRhY2htZW50cyA9IE9iamVjdC5rZXlzKGRvYy5fYXR0YWNobWVudHMgfHwge30pO1xuICBpZiAoIWF0dGFjaG1lbnRzLmxlbmd0aCkge1xuICAgIHJldHVybiBjYiAmJiBjYigpO1xuICB9XG4gIHZhciBudW1Eb25lID0gMDtcblxuICBmdW5jdGlvbiBjaGVja0RvbmUoKSB7XG4gICAgaWYgKCsrbnVtRG9uZSA9PT0gYXR0YWNobWVudHMubGVuZ3RoICYmIGNiKSB7XG4gICAgICBjYigpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGZldGNoQXR0YWNobWVudChkb2MsIGF0dCkge1xuICAgIHZhciBhdHRPYmogPSBkb2MuX2F0dGFjaG1lbnRzW2F0dF07XG4gICAgdmFyIGRpZ2VzdCA9IGF0dE9iai5kaWdlc3Q7XG4gICAgdmFyIHJlcSA9IHR4bi5vYmplY3RTdG9yZShBVFRBQ0hfU1RPUkUpLmdldChkaWdlc3QpO1xuICAgIHJlcS5vbnN1Y2Nlc3MgPSBmdW5jdGlvbiAoZSkge1xuICAgICAgYXR0T2JqLmJvZHkgPSBlLnRhcmdldC5yZXN1bHQuYm9keTtcbiAgICAgIGNoZWNrRG9uZSgpO1xuICAgIH07XG4gIH1cblxuICBhdHRhY2htZW50cy5mb3JFYWNoKGZ1bmN0aW9uIChhdHQpIHtcbiAgICBpZiAob3B0cy5hdHRhY2htZW50cyAmJiBvcHRzLmluY2x1ZGVfZG9jcykge1xuICAgICAgZmV0Y2hBdHRhY2htZW50KGRvYywgYXR0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgZG9jLl9hdHRhY2htZW50c1thdHRdLnN0dWIgPSB0cnVlO1xuICAgICAgY2hlY2tEb25lKCk7XG4gICAgfVxuICB9KTtcbn1cblxuLy8gSURCLXNwZWNpZmljIHBvc3Rwcm9jZXNzaW5nIG5lY2Vzc2FyeSBiZWNhdXNlXG4vLyB3ZSBkb24ndCBrbm93IHdoZXRoZXIgd2Ugc3RvcmVkIGEgdHJ1ZSBCbG9iIG9yXG4vLyBhIGJhc2U2NC1lbmNvZGVkIHN0cmluZywgYW5kIGlmIGl0J3MgYSBCbG9iIGl0XG4vLyBuZWVkcyB0byBiZSByZWFkIG91dHNpZGUgb2YgdGhlIHRyYW5zYWN0aW9uIGNvbnRleHRcbmZ1bmN0aW9uIHBvc3RQcm9jZXNzQXR0YWNobWVudHMocmVzdWx0cywgYXNCbG9iKSB7XG4gIHJldHVybiBQcm9taXNlLmFsbChyZXN1bHRzLm1hcChmdW5jdGlvbiAocm93KSB7XG4gICAgaWYgKHJvdy5kb2MgJiYgcm93LmRvYy5fYXR0YWNobWVudHMpIHtcbiAgICAgIHZhciBhdHROYW1lcyA9IE9iamVjdC5rZXlzKHJvdy5kb2MuX2F0dGFjaG1lbnRzKTtcbiAgICAgIHJldHVybiBQcm9taXNlLmFsbChhdHROYW1lcy5tYXAoZnVuY3Rpb24gKGF0dCkge1xuICAgICAgICB2YXIgYXR0T2JqID0gcm93LmRvYy5fYXR0YWNobWVudHNbYXR0XTtcbiAgICAgICAgaWYgKCEoJ2JvZHknIGluIGF0dE9iaikpIHsgLy8gYWxyZWFkeSBwcm9jZXNzZWRcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGJvZHkgPSBhdHRPYmouYm9keTtcbiAgICAgICAgdmFyIHR5cGUgPSBhdHRPYmouY29udGVudF90eXBlO1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUpIHtcbiAgICAgICAgICByZWFkQmxvYkRhdGEoYm9keSwgdHlwZSwgYXNCbG9iLCBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICAgICAgcm93LmRvYy5fYXR0YWNobWVudHNbYXR0XSA9IE9iamVjdC5hc3NpZ24oXG4gICAgICAgICAgICAgIHBpY2soYXR0T2JqLCBbJ2RpZ2VzdCcsICdjb250ZW50X3R5cGUnXSksXG4gICAgICAgICAgICAgIHtkYXRhOiBkYXRhfVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICB9KSk7XG4gICAgfVxuICB9KSk7XG59XG5cbmZ1bmN0aW9uIGNvbXBhY3RSZXZzKHJldnMsIGRvY0lkLCB0eG4pIHtcblxuICB2YXIgcG9zc2libHlPcnBoYW5lZERpZ2VzdHMgPSBbXTtcbiAgdmFyIHNlcVN0b3JlID0gdHhuLm9iamVjdFN0b3JlKEJZX1NFUV9TVE9SRSk7XG4gIHZhciBhdHRTdG9yZSA9IHR4bi5vYmplY3RTdG9yZShBVFRBQ0hfU1RPUkUpO1xuICB2YXIgYXR0QW5kU2VxU3RvcmUgPSB0eG4ub2JqZWN0U3RvcmUoQVRUQUNIX0FORF9TRVFfU1RPUkUpO1xuICB2YXIgY291bnQgPSByZXZzLmxlbmd0aDtcblxuICBmdW5jdGlvbiBjaGVja0RvbmUoKSB7XG4gICAgY291bnQtLTtcbiAgICBpZiAoIWNvdW50KSB7IC8vIGRvbmUgcHJvY2Vzc2luZyBhbGwgcmV2c1xuICAgICAgZGVsZXRlT3JwaGFuZWRBdHRhY2htZW50cygpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGRlbGV0ZU9ycGhhbmVkQXR0YWNobWVudHMoKSB7XG4gICAgaWYgKCFwb3NzaWJseU9ycGhhbmVkRGlnZXN0cy5sZW5ndGgpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgcG9zc2libHlPcnBoYW5lZERpZ2VzdHMuZm9yRWFjaChmdW5jdGlvbiAoZGlnZXN0KSB7XG4gICAgICB2YXIgY291bnRSZXEgPSBhdHRBbmRTZXFTdG9yZS5pbmRleCgnZGlnZXN0U2VxJykuY291bnQoXG4gICAgICAgIElEQktleVJhbmdlLmJvdW5kKFxuICAgICAgICAgIGRpZ2VzdCArICc6OicsIGRpZ2VzdCArICc6OlxcdWZmZmYnLCBmYWxzZSwgZmFsc2UpKTtcbiAgICAgIGNvdW50UmVxLm9uc3VjY2VzcyA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICAgIHZhciBjb3VudCA9IGUudGFyZ2V0LnJlc3VsdDtcbiAgICAgICAgaWYgKCFjb3VudCkge1xuICAgICAgICAgIC8vIG9ycGhhbmVkXG4gICAgICAgICAgYXR0U3RvcmUuZGVsZXRlKGRpZ2VzdCk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICByZXZzLmZvckVhY2goZnVuY3Rpb24gKHJldikge1xuICAgIHZhciBpbmRleCA9IHNlcVN0b3JlLmluZGV4KCdfZG9jX2lkX3JldicpO1xuICAgIHZhciBrZXkgPSBkb2NJZCArIFwiOjpcIiArIHJldjtcbiAgICBpbmRleC5nZXRLZXkoa2V5KS5vbnN1Y2Nlc3MgPSBmdW5jdGlvbiAoZSkge1xuICAgICAgdmFyIHNlcSA9IGUudGFyZ2V0LnJlc3VsdDtcbiAgICAgIGlmICh0eXBlb2Ygc2VxICE9PSAnbnVtYmVyJykge1xuICAgICAgICByZXR1cm4gY2hlY2tEb25lKCk7XG4gICAgICB9XG4gICAgICBzZXFTdG9yZS5kZWxldGUoc2VxKTtcblxuICAgICAgdmFyIGN1cnNvciA9IGF0dEFuZFNlcVN0b3JlLmluZGV4KCdzZXEnKVxuICAgICAgICAub3BlbkN1cnNvcihJREJLZXlSYW5nZS5vbmx5KHNlcSkpO1xuXG4gICAgICBjdXJzb3Iub25zdWNjZXNzID0gZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICAgIHZhciBjdXJzb3IgPSBldmVudC50YXJnZXQucmVzdWx0O1xuICAgICAgICBpZiAoY3Vyc29yKSB7XG4gICAgICAgICAgdmFyIGRpZ2VzdCA9IGN1cnNvci52YWx1ZS5kaWdlc3RTZXEuc3BsaXQoJzo6JylbMF07XG4gICAgICAgICAgcG9zc2libHlPcnBoYW5lZERpZ2VzdHMucHVzaChkaWdlc3QpO1xuICAgICAgICAgIGF0dEFuZFNlcVN0b3JlLmRlbGV0ZShjdXJzb3IucHJpbWFyeUtleSk7XG4gICAgICAgICAgY3Vyc29yLmNvbnRpbnVlKCk7XG4gICAgICAgIH0gZWxzZSB7IC8vIGRvbmVcbiAgICAgICAgICBjaGVja0RvbmUoKTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9O1xuICB9KTtcbn1cblxuZnVuY3Rpb24gb3BlblRyYW5zYWN0aW9uU2FmZWx5KGlkYiwgc3RvcmVzLCBtb2RlKSB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHR4bjogaWRiLnRyYW5zYWN0aW9uKHN0b3JlcywgbW9kZSlcbiAgICB9O1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICByZXR1cm4ge1xuICAgICAgZXJyb3I6IGVyclxuICAgIH07XG4gIH1cbn1cblxuZXhwb3J0IHtcbiAgZmV0Y2hBdHRhY2htZW50c0lmTmVjZXNzYXJ5LFxuICBvcGVuVHJhbnNhY3Rpb25TYWZlbHksXG4gIGNvbXBhY3RSZXZzLFxuICBwb3N0UHJvY2Vzc0F0dGFjaG1lbnRzLFxuICBpZGJFcnJvcixcbiAgZW5jb2RlTWV0YWRhdGEsXG4gIGRlY29kZU1ldGFkYXRhLFxuICBkZWNvZGVEb2MsXG4gIHJlYWRCbG9iRGF0YVxufTtcbiIsImltcG9ydCB7IGNoYW5nZXNIYW5kbGVyIGFzIENoYW5nZXMgfSBmcm9tICdwb3VjaGRiLXV0aWxzJztcbmV4cG9ydCBkZWZhdWx0IG5ldyBDaGFuZ2VzKCk7IiwiaW1wb3J0IHsgY3JlYXRlRXJyb3IsIE1JU1NJTkdfU1RVQiB9IGZyb20gJ3BvdWNoZGItZXJyb3JzJztcbmltcG9ydCB7XG4gIHByZXByb2Nlc3NBdHRhY2htZW50cyxcbiAgcHJvY2Vzc0RvY3MsXG4gIGlzTG9jYWxJZCxcbiAgcGFyc2VEb2Ncbn0gZnJvbSAncG91Y2hkYi1hZGFwdGVyLXV0aWxzJztcblxuaW1wb3J0IHtcbiAgY29tcGFjdFRyZWVcbn0gZnJvbSAncG91Y2hkYi1tZXJnZSc7XG5cbmltcG9ydCB7XG4gIEFUVEFDSF9BTkRfU0VRX1NUT1JFLFxuICBBVFRBQ0hfU1RPUkUsXG4gIEJZX1NFUV9TVE9SRSxcbiAgRE9DX1NUT1JFLFxuICBMT0NBTF9TVE9SRSxcbiAgTUVUQV9TVE9SRVxufSBmcm9tICcuL2NvbnN0YW50cyc7XG5cbmltcG9ydCB7XG4gIGNvbXBhY3RSZXZzLFxuICBkZWNvZGVNZXRhZGF0YSxcbiAgZW5jb2RlTWV0YWRhdGEsXG4gIGlkYkVycm9yLFxuICBvcGVuVHJhbnNhY3Rpb25TYWZlbHlcbn0gZnJvbSAnLi91dGlscyc7XG5cbmltcG9ydCBjaGFuZ2VzSGFuZGxlciBmcm9tICcuL2NoYW5nZXNIYW5kbGVyJztcblxuZnVuY3Rpb24gaWRiQnVsa0RvY3MoZGJPcHRzLCByZXEsIG9wdHMsIGFwaSwgaWRiLCBjYWxsYmFjaykge1xuICB2YXIgZG9jSW5mb3MgPSByZXEuZG9jcztcbiAgdmFyIHR4bjtcbiAgdmFyIGRvY1N0b3JlO1xuICB2YXIgYnlTZXFTdG9yZTtcbiAgdmFyIGF0dGFjaFN0b3JlO1xuICB2YXIgYXR0YWNoQW5kU2VxU3RvcmU7XG4gIHZhciBtZXRhU3RvcmU7XG4gIHZhciBkb2NJbmZvRXJyb3I7XG4gIHZhciBtZXRhRG9jO1xuXG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSBkb2NJbmZvcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIHZhciBkb2MgPSBkb2NJbmZvc1tpXTtcbiAgICBpZiAoZG9jLl9pZCAmJiBpc0xvY2FsSWQoZG9jLl9pZCkpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBkb2MgPSBkb2NJbmZvc1tpXSA9IHBhcnNlRG9jKGRvYywgb3B0cy5uZXdfZWRpdHMsIGRiT3B0cyk7XG4gICAgaWYgKGRvYy5lcnJvciAmJiAhZG9jSW5mb0Vycm9yKSB7XG4gICAgICBkb2NJbmZvRXJyb3IgPSBkb2M7XG4gICAgfVxuICB9XG5cbiAgaWYgKGRvY0luZm9FcnJvcikge1xuICAgIHJldHVybiBjYWxsYmFjayhkb2NJbmZvRXJyb3IpO1xuICB9XG5cbiAgdmFyIGFsbERvY3NQcm9jZXNzZWQgPSBmYWxzZTtcbiAgdmFyIGRvY0NvdW50RGVsdGEgPSAwO1xuICB2YXIgcmVzdWx0cyA9IG5ldyBBcnJheShkb2NJbmZvcy5sZW5ndGgpO1xuICB2YXIgZmV0Y2hlZERvY3MgPSBuZXcgTWFwKCk7XG4gIHZhciBwcmVjb25kaXRpb25FcnJvcmVkID0gZmFsc2U7XG4gIHZhciBibG9iVHlwZSA9IGFwaS5fbWV0YS5ibG9iU3VwcG9ydCA/ICdibG9iJyA6ICdiYXNlNjQnO1xuXG4gIHByZXByb2Nlc3NBdHRhY2htZW50cyhkb2NJbmZvcywgYmxvYlR5cGUsIGZ1bmN0aW9uIChlcnIpIHtcbiAgICBpZiAoZXJyKSB7XG4gICAgICByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICB9XG4gICAgc3RhcnRUcmFuc2FjdGlvbigpO1xuICB9KTtcblxuICBmdW5jdGlvbiBzdGFydFRyYW5zYWN0aW9uKCkge1xuXG4gICAgdmFyIHN0b3JlcyA9IFtcbiAgICAgIERPQ19TVE9SRSwgQllfU0VRX1NUT1JFLFxuICAgICAgQVRUQUNIX1NUT1JFLFxuICAgICAgTE9DQUxfU1RPUkUsIEFUVEFDSF9BTkRfU0VRX1NUT1JFLFxuICAgICAgTUVUQV9TVE9SRVxuICAgIF07XG4gICAgdmFyIHR4blJlc3VsdCA9IG9wZW5UcmFuc2FjdGlvblNhZmVseShpZGIsIHN0b3JlcywgJ3JlYWR3cml0ZScpO1xuICAgIGlmICh0eG5SZXN1bHQuZXJyb3IpIHtcbiAgICAgIHJldHVybiBjYWxsYmFjayh0eG5SZXN1bHQuZXJyb3IpO1xuICAgIH1cbiAgICB0eG4gPSB0eG5SZXN1bHQudHhuO1xuICAgIHR4bi5vbmFib3J0ID0gaWRiRXJyb3IoY2FsbGJhY2spO1xuICAgIHR4bi5vbnRpbWVvdXQgPSBpZGJFcnJvcihjYWxsYmFjayk7XG4gICAgdHhuLm9uY29tcGxldGUgPSBjb21wbGV0ZTtcbiAgICBkb2NTdG9yZSA9IHR4bi5vYmplY3RTdG9yZShET0NfU1RPUkUpO1xuICAgIGJ5U2VxU3RvcmUgPSB0eG4ub2JqZWN0U3RvcmUoQllfU0VRX1NUT1JFKTtcbiAgICBhdHRhY2hTdG9yZSA9IHR4bi5vYmplY3RTdG9yZShBVFRBQ0hfU1RPUkUpO1xuICAgIGF0dGFjaEFuZFNlcVN0b3JlID0gdHhuLm9iamVjdFN0b3JlKEFUVEFDSF9BTkRfU0VRX1NUT1JFKTtcbiAgICBtZXRhU3RvcmUgPSB0eG4ub2JqZWN0U3RvcmUoTUVUQV9TVE9SRSk7XG5cbiAgICBtZXRhU3RvcmUuZ2V0KE1FVEFfU1RPUkUpLm9uc3VjY2VzcyA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICBtZXRhRG9jID0gZS50YXJnZXQucmVzdWx0O1xuICAgICAgdXBkYXRlRG9jQ291bnRJZlJlYWR5KCk7XG4gICAgfTtcblxuICAgIHZlcmlmeUF0dGFjaG1lbnRzKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgcHJlY29uZGl0aW9uRXJyb3JlZCA9IHRydWU7XG4gICAgICAgIHJldHVybiBjYWxsYmFjayhlcnIpO1xuICAgICAgfVxuICAgICAgZmV0Y2hFeGlzdGluZ0RvY3MoKTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG9uQWxsRG9jc1Byb2Nlc3NlZCgpIHtcbiAgICBhbGxEb2NzUHJvY2Vzc2VkID0gdHJ1ZTtcbiAgICB1cGRhdGVEb2NDb3VudElmUmVhZHkoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGlkYlByb2Nlc3NEb2NzKCkge1xuICAgIHByb2Nlc3NEb2NzKGRiT3B0cy5yZXZzX2xpbWl0LCBkb2NJbmZvcywgYXBpLCBmZXRjaGVkRG9jcyxcbiAgICAgICAgICAgICAgICB0eG4sIHJlc3VsdHMsIHdyaXRlRG9jLCBvcHRzLCBvbkFsbERvY3NQcm9jZXNzZWQpO1xuICB9XG5cbiAgZnVuY3Rpb24gdXBkYXRlRG9jQ291bnRJZlJlYWR5KCkge1xuICAgIGlmICghbWV0YURvYyB8fCAhYWxsRG9jc1Byb2Nlc3NlZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvLyBjYWNoaW5nIHRoZSBkb2NDb3VudCBzYXZlcyBhIGxvdCBvZiB0aW1lIGluIGFsbERvY3MoKSBhbmRcbiAgICAvLyBpbmZvKCksIHdoaWNoIGlzIHdoeSB3ZSBnbyB0byBhbGwgdGhlIHRyb3VibGUgb2YgZG9pbmcgdGhpc1xuICAgIG1ldGFEb2MuZG9jQ291bnQgKz0gZG9jQ291bnREZWx0YTtcbiAgICBtZXRhU3RvcmUucHV0KG1ldGFEb2MpO1xuICB9XG5cbiAgZnVuY3Rpb24gZmV0Y2hFeGlzdGluZ0RvY3MoKSB7XG5cbiAgICBpZiAoIWRvY0luZm9zLmxlbmd0aCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBudW1GZXRjaGVkID0gMDtcblxuICAgIGZ1bmN0aW9uIGNoZWNrRG9uZSgpIHtcbiAgICAgIGlmICgrK251bUZldGNoZWQgPT09IGRvY0luZm9zLmxlbmd0aCkge1xuICAgICAgICBpZGJQcm9jZXNzRG9jcygpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHJlYWRNZXRhZGF0YShldmVudCkge1xuICAgICAgdmFyIG1ldGFkYXRhID0gZGVjb2RlTWV0YWRhdGEoZXZlbnQudGFyZ2V0LnJlc3VsdCk7XG5cbiAgICAgIGlmIChtZXRhZGF0YSkge1xuICAgICAgICBmZXRjaGVkRG9jcy5zZXQobWV0YWRhdGEuaWQsIG1ldGFkYXRhKTtcbiAgICAgIH1cbiAgICAgIGNoZWNrRG9uZSgpO1xuICAgIH1cblxuICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBkb2NJbmZvcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgdmFyIGRvY0luZm8gPSBkb2NJbmZvc1tpXTtcbiAgICAgIGlmIChkb2NJbmZvLl9pZCAmJiBpc0xvY2FsSWQoZG9jSW5mby5faWQpKSB7XG4gICAgICAgIGNoZWNrRG9uZSgpOyAvLyBza2lwIGxvY2FsIGRvY3NcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICB2YXIgcmVxID0gZG9jU3RvcmUuZ2V0KGRvY0luZm8ubWV0YWRhdGEuaWQpO1xuICAgICAgcmVxLm9uc3VjY2VzcyA9IHJlYWRNZXRhZGF0YTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBjb21wbGV0ZSgpIHtcbiAgICBpZiAocHJlY29uZGl0aW9uRXJyb3JlZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNoYW5nZXNIYW5kbGVyLm5vdGlmeShhcGkuX21ldGEubmFtZSk7XG4gICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0cyk7XG4gIH1cblxuICBmdW5jdGlvbiB2ZXJpZnlBdHRhY2htZW50KGRpZ2VzdCwgY2FsbGJhY2spIHtcblxuICAgIHZhciByZXEgPSBhdHRhY2hTdG9yZS5nZXQoZGlnZXN0KTtcbiAgICByZXEub25zdWNjZXNzID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgIGlmICghZS50YXJnZXQucmVzdWx0KSB7XG4gICAgICAgIHZhciBlcnIgPSBjcmVhdGVFcnJvcihNSVNTSU5HX1NUVUIsXG4gICAgICAgICAgJ3Vua25vd24gc3R1YiBhdHRhY2htZW50IHdpdGggZGlnZXN0ICcgK1xuICAgICAgICAgIGRpZ2VzdCk7XG4gICAgICAgIGVyci5zdGF0dXMgPSA0MTI7XG4gICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgfVxuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiB2ZXJpZnlBdHRhY2htZW50cyhmaW5pc2gpIHtcblxuXG4gICAgdmFyIGRpZ2VzdHMgPSBbXTtcbiAgICBkb2NJbmZvcy5mb3JFYWNoKGZ1bmN0aW9uIChkb2NJbmZvKSB7XG4gICAgICBpZiAoZG9jSW5mby5kYXRhICYmIGRvY0luZm8uZGF0YS5fYXR0YWNobWVudHMpIHtcbiAgICAgICAgT2JqZWN0LmtleXMoZG9jSW5mby5kYXRhLl9hdHRhY2htZW50cykuZm9yRWFjaChmdW5jdGlvbiAoZmlsZW5hbWUpIHtcbiAgICAgICAgICB2YXIgYXR0ID0gZG9jSW5mby5kYXRhLl9hdHRhY2htZW50c1tmaWxlbmFtZV07XG4gICAgICAgICAgaWYgKGF0dC5zdHViKSB7XG4gICAgICAgICAgICBkaWdlc3RzLnB1c2goYXR0LmRpZ2VzdCk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBpZiAoIWRpZ2VzdHMubGVuZ3RoKSB7XG4gICAgICByZXR1cm4gZmluaXNoKCk7XG4gICAgfVxuICAgIHZhciBudW1Eb25lID0gMDtcbiAgICB2YXIgZXJyO1xuXG4gICAgZnVuY3Rpb24gY2hlY2tEb25lKCkge1xuICAgICAgaWYgKCsrbnVtRG9uZSA9PT0gZGlnZXN0cy5sZW5ndGgpIHtcbiAgICAgICAgZmluaXNoKGVycik7XG4gICAgICB9XG4gICAgfVxuICAgIGRpZ2VzdHMuZm9yRWFjaChmdW5jdGlvbiAoZGlnZXN0KSB7XG4gICAgICB2ZXJpZnlBdHRhY2htZW50KGRpZ2VzdCwgZnVuY3Rpb24gKGF0dEVycikge1xuICAgICAgICBpZiAoYXR0RXJyICYmICFlcnIpIHtcbiAgICAgICAgICBlcnIgPSBhdHRFcnI7XG4gICAgICAgIH1cbiAgICAgICAgY2hlY2tEb25lKCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHdyaXRlRG9jKGRvY0luZm8sIHdpbm5pbmdSZXYsIHdpbm5pbmdSZXZJc0RlbGV0ZWQsIG5ld1JldklzRGVsZXRlZCxcbiAgICAgICAgICAgICAgICAgICAgaXNVcGRhdGUsIGRlbHRhLCByZXN1bHRzSWR4LCBjYWxsYmFjaykge1xuXG4gICAgZG9jSW5mby5tZXRhZGF0YS53aW5uaW5nUmV2ID0gd2lubmluZ1JldjtcbiAgICBkb2NJbmZvLm1ldGFkYXRhLmRlbGV0ZWQgPSB3aW5uaW5nUmV2SXNEZWxldGVkO1xuXG4gICAgdmFyIGRvYyA9IGRvY0luZm8uZGF0YTtcbiAgICBkb2MuX2lkID0gZG9jSW5mby5tZXRhZGF0YS5pZDtcbiAgICBkb2MuX3JldiA9IGRvY0luZm8ubWV0YWRhdGEucmV2O1xuXG4gICAgaWYgKG5ld1JldklzRGVsZXRlZCkge1xuICAgICAgZG9jLl9kZWxldGVkID0gdHJ1ZTtcbiAgICB9XG5cbiAgICB2YXIgaGFzQXR0YWNobWVudHMgPSBkb2MuX2F0dGFjaG1lbnRzICYmXG4gICAgICBPYmplY3Qua2V5cyhkb2MuX2F0dGFjaG1lbnRzKS5sZW5ndGg7XG4gICAgaWYgKGhhc0F0dGFjaG1lbnRzKSB7XG4gICAgICByZXR1cm4gd3JpdGVBdHRhY2htZW50cyhkb2NJbmZvLCB3aW5uaW5nUmV2LCB3aW5uaW5nUmV2SXNEZWxldGVkLFxuICAgICAgICBpc1VwZGF0ZSwgcmVzdWx0c0lkeCwgY2FsbGJhY2spO1xuICAgIH1cblxuICAgIGRvY0NvdW50RGVsdGEgKz0gZGVsdGE7XG4gICAgdXBkYXRlRG9jQ291bnRJZlJlYWR5KCk7XG5cbiAgICBmaW5pc2hEb2MoZG9jSW5mbywgd2lubmluZ1Jldiwgd2lubmluZ1JldklzRGVsZXRlZCxcbiAgICAgIGlzVXBkYXRlLCByZXN1bHRzSWR4LCBjYWxsYmFjayk7XG4gIH1cblxuICBmdW5jdGlvbiBmaW5pc2hEb2MoZG9jSW5mbywgd2lubmluZ1Jldiwgd2lubmluZ1JldklzRGVsZXRlZCxcbiAgICAgICAgICAgICAgICAgICAgIGlzVXBkYXRlLCByZXN1bHRzSWR4LCBjYWxsYmFjaykge1xuXG4gICAgdmFyIGRvYyA9IGRvY0luZm8uZGF0YTtcbiAgICB2YXIgbWV0YWRhdGEgPSBkb2NJbmZvLm1ldGFkYXRhO1xuXG4gICAgZG9jLl9kb2NfaWRfcmV2ID0gbWV0YWRhdGEuaWQgKyAnOjonICsgbWV0YWRhdGEucmV2O1xuICAgIGRlbGV0ZSBkb2MuX2lkO1xuICAgIGRlbGV0ZSBkb2MuX3JldjtcblxuICAgIGZ1bmN0aW9uIGFmdGVyUHV0RG9jKGUpIHtcbiAgICAgIHZhciByZXZzVG9EZWxldGUgPSBkb2NJbmZvLnN0ZW1tZWRSZXZzIHx8IFtdO1xuXG4gICAgICBpZiAoaXNVcGRhdGUgJiYgYXBpLmF1dG9fY29tcGFjdGlvbikge1xuICAgICAgICByZXZzVG9EZWxldGUgPSByZXZzVG9EZWxldGUuY29uY2F0KGNvbXBhY3RUcmVlKGRvY0luZm8ubWV0YWRhdGEpKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHJldnNUb0RlbGV0ZSAmJiByZXZzVG9EZWxldGUubGVuZ3RoKSB7XG4gICAgICAgIGNvbXBhY3RSZXZzKHJldnNUb0RlbGV0ZSwgZG9jSW5mby5tZXRhZGF0YS5pZCwgdHhuKTtcbiAgICAgIH1cblxuICAgICAgbWV0YWRhdGEuc2VxID0gZS50YXJnZXQucmVzdWx0O1xuICAgICAgLy8gQ3VycmVudCBfcmV2IGlzIGNhbGN1bGF0ZWQgZnJvbSBfcmV2X3RyZWUgb24gcmVhZFxuICAgICAgLy8gZGVsZXRlIG1ldGFkYXRhLnJldjtcbiAgICAgIHZhciBtZXRhZGF0YVRvU3RvcmUgPSBlbmNvZGVNZXRhZGF0YShtZXRhZGF0YSwgd2lubmluZ1JldixcbiAgICAgICAgd2lubmluZ1JldklzRGVsZXRlZCk7XG4gICAgICB2YXIgbWV0YURhdGFSZXEgPSBkb2NTdG9yZS5wdXQobWV0YWRhdGFUb1N0b3JlKTtcbiAgICAgIG1ldGFEYXRhUmVxLm9uc3VjY2VzcyA9IGFmdGVyUHV0TWV0YWRhdGE7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWZ0ZXJQdXREb2NFcnJvcihlKSB7XG4gICAgICAvLyBDb25zdHJhaW50RXJyb3IsIG5lZWQgdG8gdXBkYXRlLCBub3QgcHV0IChzZWUgIzE2MzggZm9yIGRldGFpbHMpXG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7IC8vIGF2b2lkIHRyYW5zYWN0aW9uIGFib3J0XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpOyAvLyBhdm9pZCB0cmFuc2FjdGlvbiBvbmVycm9yXG4gICAgICB2YXIgaW5kZXggPSBieVNlcVN0b3JlLmluZGV4KCdfZG9jX2lkX3JldicpO1xuICAgICAgdmFyIGdldEtleVJlcSA9IGluZGV4LmdldEtleShkb2MuX2RvY19pZF9yZXYpO1xuICAgICAgZ2V0S2V5UmVxLm9uc3VjY2VzcyA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICAgIHZhciBwdXRSZXEgPSBieVNlcVN0b3JlLnB1dChkb2MsIGUudGFyZ2V0LnJlc3VsdCk7XG4gICAgICAgIHB1dFJlcS5vbnN1Y2Nlc3MgPSBhZnRlclB1dERvYztcbiAgICAgIH07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWZ0ZXJQdXRNZXRhZGF0YSgpIHtcbiAgICAgIHJlc3VsdHNbcmVzdWx0c0lkeF0gPSB7XG4gICAgICAgIG9rOiB0cnVlLFxuICAgICAgICBpZDogbWV0YWRhdGEuaWQsXG4gICAgICAgIHJldjogbWV0YWRhdGEucmV2XG4gICAgICB9O1xuICAgICAgZmV0Y2hlZERvY3Muc2V0KGRvY0luZm8ubWV0YWRhdGEuaWQsIGRvY0luZm8ubWV0YWRhdGEpO1xuICAgICAgaW5zZXJ0QXR0YWNobWVudE1hcHBpbmdzKGRvY0luZm8sIG1ldGFkYXRhLnNlcSwgY2FsbGJhY2spO1xuICAgIH1cblxuICAgIHZhciBwdXRSZXEgPSBieVNlcVN0b3JlLnB1dChkb2MpO1xuXG4gICAgcHV0UmVxLm9uc3VjY2VzcyA9IGFmdGVyUHV0RG9jO1xuICAgIHB1dFJlcS5vbmVycm9yID0gYWZ0ZXJQdXREb2NFcnJvcjtcbiAgfVxuXG4gIGZ1bmN0aW9uIHdyaXRlQXR0YWNobWVudHMoZG9jSW5mbywgd2lubmluZ1Jldiwgd2lubmluZ1JldklzRGVsZXRlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpc1VwZGF0ZSwgcmVzdWx0c0lkeCwgY2FsbGJhY2spIHtcblxuXG4gICAgdmFyIGRvYyA9IGRvY0luZm8uZGF0YTtcblxuICAgIHZhciBudW1Eb25lID0gMDtcbiAgICB2YXIgYXR0YWNobWVudHMgPSBPYmplY3Qua2V5cyhkb2MuX2F0dGFjaG1lbnRzKTtcblxuICAgIGZ1bmN0aW9uIGNvbGxlY3RSZXN1bHRzKCkge1xuICAgICAgaWYgKG51bURvbmUgPT09IGF0dGFjaG1lbnRzLmxlbmd0aCkge1xuICAgICAgICBmaW5pc2hEb2MoZG9jSW5mbywgd2lubmluZ1Jldiwgd2lubmluZ1JldklzRGVsZXRlZCxcbiAgICAgICAgICBpc1VwZGF0ZSwgcmVzdWx0c0lkeCwgY2FsbGJhY2spO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGF0dGFjaG1lbnRTYXZlZCgpIHtcbiAgICAgIG51bURvbmUrKztcbiAgICAgIGNvbGxlY3RSZXN1bHRzKCk7XG4gICAgfVxuXG4gICAgYXR0YWNobWVudHMuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgICB2YXIgYXR0ID0gZG9jSW5mby5kYXRhLl9hdHRhY2htZW50c1trZXldO1xuICAgICAgaWYgKCFhdHQuc3R1Yikge1xuICAgICAgICB2YXIgZGF0YSA9IGF0dC5kYXRhO1xuICAgICAgICBkZWxldGUgYXR0LmRhdGE7XG4gICAgICAgIGF0dC5yZXZwb3MgPSBwYXJzZUludCh3aW5uaW5nUmV2LCAxMCk7XG4gICAgICAgIHZhciBkaWdlc3QgPSBhdHQuZGlnZXN0O1xuICAgICAgICBzYXZlQXR0YWNobWVudChkaWdlc3QsIGRhdGEsIGF0dGFjaG1lbnRTYXZlZCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBudW1Eb25lKys7XG4gICAgICAgIGNvbGxlY3RSZXN1bHRzKCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvLyBtYXAgc2VxcyB0byBhdHRhY2htZW50IGRpZ2VzdHMsIHdoaWNoXG4gIC8vIHdlIHdpbGwgbmVlZCBsYXRlciBkdXJpbmcgY29tcGFjdGlvblxuICBmdW5jdGlvbiBpbnNlcnRBdHRhY2htZW50TWFwcGluZ3MoZG9jSW5mbywgc2VxLCBjYWxsYmFjaykge1xuXG4gICAgdmFyIGF0dHNBZGRlZCA9IDA7XG4gICAgdmFyIGF0dHNUb0FkZCA9IE9iamVjdC5rZXlzKGRvY0luZm8uZGF0YS5fYXR0YWNobWVudHMgfHwge30pO1xuXG4gICAgaWYgKCFhdHRzVG9BZGQubGVuZ3RoKSB7XG4gICAgICByZXR1cm4gY2FsbGJhY2soKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjaGVja0RvbmUoKSB7XG4gICAgICBpZiAoKythdHRzQWRkZWQgPT09IGF0dHNUb0FkZC5sZW5ndGgpIHtcbiAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhZGQoYXR0KSB7XG4gICAgICB2YXIgZGlnZXN0ID0gZG9jSW5mby5kYXRhLl9hdHRhY2htZW50c1thdHRdLmRpZ2VzdDtcbiAgICAgIHZhciByZXEgPSBhdHRhY2hBbmRTZXFTdG9yZS5wdXQoe1xuICAgICAgICBzZXE6IHNlcSxcbiAgICAgICAgZGlnZXN0U2VxOiBkaWdlc3QgKyAnOjonICsgc2VxXG4gICAgICB9KTtcblxuICAgICAgcmVxLm9uc3VjY2VzcyA9IGNoZWNrRG9uZTtcbiAgICAgIHJlcS5vbmVycm9yID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgLy8gdGhpcyBjYWxsYmFjayBpcyBmb3IgYSBjb25zdGFpbnQgZXJyb3IsIHdoaWNoIHdlIGlnbm9yZVxuICAgICAgICAvLyBiZWNhdXNlIHRoaXMgZG9jaWQvcmV2IGhhcyBhbHJlYWR5IGJlZW4gYXNzb2NpYXRlZCB3aXRoXG4gICAgICAgIC8vIHRoZSBkaWdlc3QgKGUuZy4gd2hlbiBuZXdfZWRpdHMgPT0gZmFsc2UpXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTsgLy8gYXZvaWQgdHJhbnNhY3Rpb24gYWJvcnRcbiAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTsgLy8gYXZvaWQgdHJhbnNhY3Rpb24gb25lcnJvclxuICAgICAgICBjaGVja0RvbmUoKTtcbiAgICAgIH07XG4gICAgfVxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXR0c1RvQWRkLmxlbmd0aDsgaSsrKSB7XG4gICAgICBhZGQoYXR0c1RvQWRkW2ldKTsgLy8gZG8gaW4gcGFyYWxsZWxcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBzYXZlQXR0YWNobWVudChkaWdlc3QsIGRhdGEsIGNhbGxiYWNrKSB7XG5cblxuICAgIHZhciBnZXRLZXlSZXEgPSBhdHRhY2hTdG9yZS5jb3VudChkaWdlc3QpO1xuICAgIGdldEtleVJlcS5vbnN1Y2Nlc3MgPSBmdW5jdGlvbiAoZSkge1xuICAgICAgdmFyIGNvdW50ID0gZS50YXJnZXQucmVzdWx0O1xuICAgICAgaWYgKGNvdW50KSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjaygpOyAvLyBhbHJlYWR5IGV4aXN0c1xuICAgICAgfVxuICAgICAgdmFyIG5ld0F0dCA9IHtcbiAgICAgICAgZGlnZXN0OiBkaWdlc3QsXG4gICAgICAgIGJvZHk6IGRhdGFcbiAgICAgIH07XG4gICAgICB2YXIgcHV0UmVxID0gYXR0YWNoU3RvcmUucHV0KG5ld0F0dCk7XG4gICAgICBwdXRSZXEub25zdWNjZXNzID0gY2FsbGJhY2s7XG4gICAgfTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBpZGJCdWxrRG9jcztcbiIsIi8vIEFic3RyYWN0aW9uIG92ZXIgSURCQ3Vyc29yIGFuZCBnZXRBbGwoKS9nZXRBbGxLZXlzKCkgdGhhdCBhbGxvd3MgdXMgdG8gYmF0Y2ggb3VyIG9wZXJhdGlvbnNcbi8vIHdoaWxlIGZhbGxpbmcgYmFjayB0byBhIG5vcm1hbCBJREJDdXJzb3Igb3BlcmF0aW9uIG9uIGJyb3dzZXJzIHRoYXQgZG9uJ3Qgc3VwcG9ydCBnZXRBbGwoKSBvclxuLy8gZ2V0QWxsS2V5cygpLiBUaGlzIGFsbG93cyBmb3IgYSBtdWNoIGZhc3RlciBpbXBsZW1lbnRhdGlvbiB0aGFuIGp1c3Qgc3RyYWlnaHQtdXAgY3Vyc29ycywgYmVjYXVzZVxuLy8gd2UncmUgbm90IHByb2Nlc3NpbmcgZWFjaCBkb2N1bWVudCBvbmUtYXQtYS10aW1lLlxuZnVuY3Rpb24gcnVuQmF0Y2hlZEN1cnNvcihvYmplY3RTdG9yZSwga2V5UmFuZ2UsIGRlc2NlbmRpbmcsIGJhdGNoU2l6ZSwgb25CYXRjaCkge1xuXG4gIGlmIChiYXRjaFNpemUgPT09IC0xKSB7XG4gICAgYmF0Y2hTaXplID0gMTAwMDtcbiAgfVxuXG4gIC8vIEJhaWwgb3V0IG9mIGdldEFsbCgpL2dldEFsbEtleXMoKSBpbiB0aGUgZm9sbG93aW5nIGNhc2VzOlxuICAvLyAxKSBlaXRoZXIgbWV0aG9kIGlzIHVuc3VwcG9ydGVkIC0gd2UgbmVlZCBib3RoXG4gIC8vIDIpIGJhdGNoU2l6ZSBpcyAxIChtaWdodCBhcyB3ZWxsIHVzZSBJREJDdXJzb3IpXG4gIC8vIDMpIGRlc2NlbmRpbmcg4oCTIG5vIHJlYWwgd2F5IHRvIGRvIHRoaXMgdmlhIGdldEFsbCgpL2dldEFsbEtleXMoKVxuXG4gIHZhciB1c2VHZXRBbGwgPSB0eXBlb2Ygb2JqZWN0U3RvcmUuZ2V0QWxsID09PSAnZnVuY3Rpb24nICYmXG4gICAgdHlwZW9mIG9iamVjdFN0b3JlLmdldEFsbEtleXMgPT09ICdmdW5jdGlvbicgJiZcbiAgICBiYXRjaFNpemUgPiAxICYmICFkZXNjZW5kaW5nO1xuXG4gIHZhciBrZXlzQmF0Y2g7XG4gIHZhciB2YWx1ZXNCYXRjaDtcbiAgdmFyIHBzZXVkb0N1cnNvcjtcblxuICBmdW5jdGlvbiBvbkdldEFsbChlKSB7XG4gICAgdmFsdWVzQmF0Y2ggPSBlLnRhcmdldC5yZXN1bHQ7XG4gICAgaWYgKGtleXNCYXRjaCkge1xuICAgICAgb25CYXRjaChrZXlzQmF0Y2gsIHZhbHVlc0JhdGNoLCBwc2V1ZG9DdXJzb3IpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG9uR2V0QWxsS2V5cyhlKSB7XG4gICAga2V5c0JhdGNoID0gZS50YXJnZXQucmVzdWx0O1xuICAgIGlmICh2YWx1ZXNCYXRjaCkge1xuICAgICAgb25CYXRjaChrZXlzQmF0Y2gsIHZhbHVlc0JhdGNoLCBwc2V1ZG9DdXJzb3IpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGNvbnRpbnVlUHNldWRvQ3Vyc29yKCkge1xuICAgIGlmICgha2V5c0JhdGNoLmxlbmd0aCkgeyAvLyBubyBtb3JlIHJlc3VsdHNcbiAgICAgIHJldHVybiBvbkJhdGNoKCk7XG4gICAgfVxuICAgIC8vIGZldGNoIG5leHQgYmF0Y2gsIGV4Y2x1c2l2ZSBzdGFydFxuICAgIHZhciBsYXN0S2V5ID0ga2V5c0JhdGNoW2tleXNCYXRjaC5sZW5ndGggLSAxXTtcbiAgICB2YXIgbmV3S2V5UmFuZ2U7XG4gICAgaWYgKGtleVJhbmdlICYmIGtleVJhbmdlLnVwcGVyKSB7XG4gICAgICB0cnkge1xuICAgICAgICBuZXdLZXlSYW5nZSA9IElEQktleVJhbmdlLmJvdW5kKGxhc3RLZXksIGtleVJhbmdlLnVwcGVyLFxuICAgICAgICAgIHRydWUsIGtleVJhbmdlLnVwcGVyT3Blbik7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGlmIChlLm5hbWUgPT09IFwiRGF0YUVycm9yXCIgJiYgZS5jb2RlID09PSAwKSB7XG4gICAgICAgICAgcmV0dXJuIG9uQmF0Y2goKTsgLy8gd2UncmUgZG9uZSwgc3RhcnRrZXkgYW5kIGVuZGtleSBhcmUgZXF1YWxcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBuZXdLZXlSYW5nZSA9IElEQktleVJhbmdlLmxvd2VyQm91bmQobGFzdEtleSwgdHJ1ZSk7XG4gICAgfVxuICAgIGtleVJhbmdlID0gbmV3S2V5UmFuZ2U7XG4gICAga2V5c0JhdGNoID0gbnVsbDtcbiAgICB2YWx1ZXNCYXRjaCA9IG51bGw7XG4gICAgb2JqZWN0U3RvcmUuZ2V0QWxsKGtleVJhbmdlLCBiYXRjaFNpemUpLm9uc3VjY2VzcyA9IG9uR2V0QWxsO1xuICAgIG9iamVjdFN0b3JlLmdldEFsbEtleXMoa2V5UmFuZ2UsIGJhdGNoU2l6ZSkub25zdWNjZXNzID0gb25HZXRBbGxLZXlzO1xuICB9XG5cbiAgZnVuY3Rpb24gb25DdXJzb3IoZSkge1xuICAgIHZhciBjdXJzb3IgPSBlLnRhcmdldC5yZXN1bHQ7XG4gICAgaWYgKCFjdXJzb3IpIHsgLy8gZG9uZVxuICAgICAgcmV0dXJuIG9uQmF0Y2goKTtcbiAgICB9XG4gICAgLy8gcmVndWxhciBJREJDdXJzb3IgYWN0cyBsaWtlIGEgYmF0Y2ggd2hlcmUgYmF0Y2ggc2l6ZSBpcyBhbHdheXMgMVxuICAgIG9uQmF0Y2goW2N1cnNvci5rZXldLCBbY3Vyc29yLnZhbHVlXSwgY3Vyc29yKTtcbiAgfVxuXG4gIGlmICh1c2VHZXRBbGwpIHtcbiAgICBwc2V1ZG9DdXJzb3IgPSB7XCJjb250aW51ZVwiOiBjb250aW51ZVBzZXVkb0N1cnNvcn07XG4gICAgb2JqZWN0U3RvcmUuZ2V0QWxsKGtleVJhbmdlLCBiYXRjaFNpemUpLm9uc3VjY2VzcyA9IG9uR2V0QWxsO1xuICAgIG9iamVjdFN0b3JlLmdldEFsbEtleXMoa2V5UmFuZ2UsIGJhdGNoU2l6ZSkub25zdWNjZXNzID0gb25HZXRBbGxLZXlzO1xuICB9IGVsc2UgaWYgKGRlc2NlbmRpbmcpIHtcbiAgICBvYmplY3RTdG9yZS5vcGVuQ3Vyc29yKGtleVJhbmdlLCAncHJldicpLm9uc3VjY2VzcyA9IG9uQ3Vyc29yO1xuICB9IGVsc2Uge1xuICAgIG9iamVjdFN0b3JlLm9wZW5DdXJzb3Ioa2V5UmFuZ2UpLm9uc3VjY2VzcyA9IG9uQ3Vyc29yO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IHJ1bkJhdGNoZWRDdXJzb3I7IiwiLy8gc2ltcGxlIHNoaW0gZm9yIG9iamVjdFN0b3JlLmdldEFsbCgpLCBmYWxsaW5nIGJhY2sgdG8gSURCQ3Vyc29yXG5mdW5jdGlvbiBnZXRBbGwob2JqZWN0U3RvcmUsIGtleVJhbmdlLCBvblN1Y2Nlc3MpIHtcbiAgaWYgKHR5cGVvZiBvYmplY3RTdG9yZS5nZXRBbGwgPT09ICdmdW5jdGlvbicpIHtcbiAgICAvLyB1c2UgbmF0aXZlIGdldEFsbFxuICAgIG9iamVjdFN0b3JlLmdldEFsbChrZXlSYW5nZSkub25zdWNjZXNzID0gb25TdWNjZXNzO1xuICAgIHJldHVybjtcbiAgfVxuICAvLyBmYWxsIGJhY2sgdG8gY3Vyc29yc1xuICB2YXIgdmFsdWVzID0gW107XG5cbiAgZnVuY3Rpb24gb25DdXJzb3IoZSkge1xuICAgIHZhciBjdXJzb3IgPSBlLnRhcmdldC5yZXN1bHQ7XG4gICAgaWYgKGN1cnNvcikge1xuICAgICAgdmFsdWVzLnB1c2goY3Vyc29yLnZhbHVlKTtcbiAgICAgIGN1cnNvci5jb250aW51ZSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBvblN1Y2Nlc3Moe1xuICAgICAgICB0YXJnZXQ6IHtcbiAgICAgICAgICByZXN1bHQ6IHZhbHVlc1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBvYmplY3RTdG9yZS5vcGVuQ3Vyc29yKGtleVJhbmdlKS5vbnN1Y2Nlc3MgPSBvbkN1cnNvcjtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZ2V0QWxsOyIsImltcG9ydCB7IGNyZWF0ZUVycm9yLCBJREJfRVJST1IgfSBmcm9tICdwb3VjaGRiLWVycm9ycyc7XG5pbXBvcnQgeyBjb2xsZWN0Q29uZmxpY3RzIH0gZnJvbSAncG91Y2hkYi1tZXJnZSc7XG5pbXBvcnQge1xuICBBVFRBQ0hfU1RPUkUsXG4gIEJZX1NFUV9TVE9SRSxcbiAgRE9DX1NUT1JFLFxuICBNRVRBX1NUT1JFXG59IGZyb20gJy4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7XG4gIGRlY29kZURvYyxcbiAgZGVjb2RlTWV0YWRhdGEsXG4gIGZldGNoQXR0YWNobWVudHNJZk5lY2Vzc2FyeSxcbiAgcG9zdFByb2Nlc3NBdHRhY2htZW50cyxcbiAgb3BlblRyYW5zYWN0aW9uU2FmZWx5LFxuICBpZGJFcnJvclxufSBmcm9tICcuL3V0aWxzLmpzJztcbmltcG9ydCBydW5CYXRjaGVkQ3Vyc29yIGZyb20gJy4vcnVuQmF0Y2hlZEN1cnNvci5qcyc7XG5pbXBvcnQgZ2V0QWxsIGZyb20gJy4vZ2V0QWxsLmpzJztcblxuZnVuY3Rpb24gYWxsRG9jc0tleXMoa2V5cywgZG9jU3RvcmUsIG9uQmF0Y2gpIHtcbiAgLy8gSXQncyBub3QgZ3VhcmFudGVkIHRvIGJlIHJldHVybmVkIGluIHJpZ2h0IG9yZGVyICBcbiAgdmFyIHZhbHVlc0JhdGNoID0gbmV3IEFycmF5KGtleXMubGVuZ3RoKTtcbiAgdmFyIGNvdW50ID0gMDtcbiAga2V5cy5mb3JFYWNoKGZ1bmN0aW9uIChrZXksIGluZGV4KSB7XG4gICAgZG9jU3RvcmUuZ2V0KGtleSkub25zdWNjZXNzID0gZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICBpZiAoZXZlbnQudGFyZ2V0LnJlc3VsdCkge1xuICAgICAgICB2YWx1ZXNCYXRjaFtpbmRleF0gPSBldmVudC50YXJnZXQucmVzdWx0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFsdWVzQmF0Y2hbaW5kZXhdID0ge2tleToga2V5LCBlcnJvcjogJ25vdF9mb3VuZCd9O1xuICAgICAgfVxuICAgICAgY291bnQrKztcbiAgICAgIGlmIChjb3VudCA9PT0ga2V5cy5sZW5ndGgpIHtcbiAgICAgICAgb25CYXRjaChrZXlzLCB2YWx1ZXNCYXRjaCwge30pO1xuICAgICAgfVxuICAgIH07XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVLZXlSYW5nZShzdGFydCwgZW5kLCBpbmNsdXNpdmVFbmQsIGtleSwgZGVzY2VuZGluZykge1xuICB0cnkge1xuICAgIGlmIChzdGFydCAmJiBlbmQpIHtcbiAgICAgIGlmIChkZXNjZW5kaW5nKSB7XG4gICAgICAgIHJldHVybiBJREJLZXlSYW5nZS5ib3VuZChlbmQsIHN0YXJ0LCAhaW5jbHVzaXZlRW5kLCBmYWxzZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gSURCS2V5UmFuZ2UuYm91bmQoc3RhcnQsIGVuZCwgZmFsc2UsICFpbmNsdXNpdmVFbmQpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoc3RhcnQpIHtcbiAgICAgIGlmIChkZXNjZW5kaW5nKSB7XG4gICAgICAgIHJldHVybiBJREJLZXlSYW5nZS51cHBlckJvdW5kKHN0YXJ0KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBJREJLZXlSYW5nZS5sb3dlckJvdW5kKHN0YXJ0KTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGVuZCkge1xuICAgICAgaWYgKGRlc2NlbmRpbmcpIHtcbiAgICAgICAgcmV0dXJuIElEQktleVJhbmdlLmxvd2VyQm91bmQoZW5kLCAhaW5jbHVzaXZlRW5kKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBJREJLZXlSYW5nZS51cHBlckJvdW5kKGVuZCwgIWluY2x1c2l2ZUVuZCk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChrZXkpIHtcbiAgICAgIHJldHVybiBJREJLZXlSYW5nZS5vbmx5KGtleSk7XG4gICAgfVxuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIHtlcnJvcjogZX07XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIGlkYkFsbERvY3Mob3B0cywgaWRiLCBjYWxsYmFjaykge1xuICB2YXIgc3RhcnQgPSAnc3RhcnRrZXknIGluIG9wdHMgPyBvcHRzLnN0YXJ0a2V5IDogZmFsc2U7XG4gIHZhciBlbmQgPSAnZW5ka2V5JyBpbiBvcHRzID8gb3B0cy5lbmRrZXkgOiBmYWxzZTtcbiAgdmFyIGtleSA9ICdrZXknIGluIG9wdHMgPyBvcHRzLmtleSA6IGZhbHNlO1xuICB2YXIga2V5cyA9ICdrZXlzJyBpbiBvcHRzID8gb3B0cy5rZXlzIDogZmFsc2U7IFxuICB2YXIgc2tpcCA9IG9wdHMuc2tpcCB8fCAwO1xuICB2YXIgbGltaXQgPSB0eXBlb2Ygb3B0cy5saW1pdCA9PT0gJ251bWJlcicgPyBvcHRzLmxpbWl0IDogLTE7XG4gIHZhciBpbmNsdXNpdmVFbmQgPSBvcHRzLmluY2x1c2l2ZV9lbmQgIT09IGZhbHNlO1xuXG4gIHZhciBrZXlSYW5nZSA7IFxuICB2YXIga2V5UmFuZ2VFcnJvcjtcbiAgaWYgKCFrZXlzKSB7XG4gICAga2V5UmFuZ2UgPSBjcmVhdGVLZXlSYW5nZShzdGFydCwgZW5kLCBpbmNsdXNpdmVFbmQsIGtleSwgb3B0cy5kZXNjZW5kaW5nKTtcbiAgICBrZXlSYW5nZUVycm9yID0ga2V5UmFuZ2UgJiYga2V5UmFuZ2UuZXJyb3I7XG4gICAgaWYgKGtleVJhbmdlRXJyb3IgJiYgXG4gICAgICAhKGtleVJhbmdlRXJyb3IubmFtZSA9PT0gXCJEYXRhRXJyb3JcIiAmJiBrZXlSYW5nZUVycm9yLmNvZGUgPT09IDApKSB7XG4gICAgICAvLyBEYXRhRXJyb3Igd2l0aCBlcnJvciBjb2RlIDAgaW5kaWNhdGVzIHN0YXJ0IGlzIGxlc3MgdGhhbiBlbmQsIHNvXG4gICAgICAvLyBjYW4ganVzdCBkbyBhbiBlbXB0eSBxdWVyeS4gRWxzZSBuZWVkIHRvIHRocm93XG4gICAgICByZXR1cm4gY2FsbGJhY2soY3JlYXRlRXJyb3IoSURCX0VSUk9SLFxuICAgICAgICBrZXlSYW5nZUVycm9yLm5hbWUsIGtleVJhbmdlRXJyb3IubWVzc2FnZSkpO1xuICAgIH1cbiAgfVxuXG4gIHZhciBzdG9yZXMgPSBbRE9DX1NUT1JFLCBCWV9TRVFfU1RPUkUsIE1FVEFfU1RPUkVdO1xuXG4gIGlmIChvcHRzLmF0dGFjaG1lbnRzKSB7XG4gICAgc3RvcmVzLnB1c2goQVRUQUNIX1NUT1JFKTtcbiAgfVxuICB2YXIgdHhuUmVzdWx0ID0gb3BlblRyYW5zYWN0aW9uU2FmZWx5KGlkYiwgc3RvcmVzLCAncmVhZG9ubHknKTtcbiAgaWYgKHR4blJlc3VsdC5lcnJvcikge1xuICAgIHJldHVybiBjYWxsYmFjayh0eG5SZXN1bHQuZXJyb3IpO1xuICB9XG4gIHZhciB0eG4gPSB0eG5SZXN1bHQudHhuO1xuICB0eG4ub25jb21wbGV0ZSA9IG9uVHhuQ29tcGxldGU7XG4gIHR4bi5vbmFib3J0ID0gaWRiRXJyb3IoY2FsbGJhY2spO1xuICB2YXIgZG9jU3RvcmUgPSB0eG4ub2JqZWN0U3RvcmUoRE9DX1NUT1JFKTtcbiAgdmFyIHNlcVN0b3JlID0gdHhuLm9iamVjdFN0b3JlKEJZX1NFUV9TVE9SRSk7XG4gIHZhciBtZXRhU3RvcmUgPSB0eG4ub2JqZWN0U3RvcmUoTUVUQV9TVE9SRSk7XG4gIHZhciBkb2NJZFJldkluZGV4ID0gc2VxU3RvcmUuaW5kZXgoJ19kb2NfaWRfcmV2Jyk7XG4gIHZhciByZXN1bHRzID0gW107XG4gIHZhciBkb2NDb3VudDtcbiAgdmFyIHVwZGF0ZVNlcTtcblxuICBtZXRhU3RvcmUuZ2V0KE1FVEFfU1RPUkUpLm9uc3VjY2VzcyA9IGZ1bmN0aW9uIChlKSB7XG4gICAgZG9jQ291bnQgPSBlLnRhcmdldC5yZXN1bHQuZG9jQ291bnQ7XG4gIH07XG5cbiAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gIGlmIChvcHRzLnVwZGF0ZV9zZXEpIHtcbiAgICBnZXRNYXhVcGRhdGVTZXEoc2VxU3RvcmUsIGZ1bmN0aW9uIChlKSB7IFxuICAgICAgaWYgKGUudGFyZ2V0LnJlc3VsdCAmJiBlLnRhcmdldC5yZXN1bHQubGVuZ3RoID4gMCkge1xuICAgICAgICB1cGRhdGVTZXEgPSBlLnRhcmdldC5yZXN1bHRbMF07XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBnZXRNYXhVcGRhdGVTZXEob2JqZWN0U3RvcmUsIG9uU3VjY2Vzcykge1xuICAgIGZ1bmN0aW9uIG9uQ3Vyc29yKGUpIHtcbiAgICAgIHZhciBjdXJzb3IgPSBlLnRhcmdldC5yZXN1bHQ7XG4gICAgICB2YXIgbWF4S2V5ID0gdW5kZWZpbmVkO1xuICAgICAgaWYgKGN1cnNvciAmJiBjdXJzb3Iua2V5KSB7XG4gICAgICAgIG1heEtleSA9IGN1cnNvci5rZXk7XG4gICAgICB9IFxuICAgICAgcmV0dXJuIG9uU3VjY2Vzcyh7XG4gICAgICAgIHRhcmdldDoge1xuICAgICAgICAgIHJlc3VsdDogW21heEtleV1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICAgIG9iamVjdFN0b3JlLm9wZW5DdXJzb3IobnVsbCwgJ3ByZXYnKS5vbnN1Y2Nlc3MgPSBvbkN1cnNvcjtcbiAgfVxuXG4gIC8vIGlmIHRoZSB1c2VyIHNwZWNpZmllcyBpbmNsdWRlX2RvY3M9dHJ1ZSwgdGhlbiB3ZSBkb24ndFxuICAvLyB3YW50IHRvIGJsb2NrIHRoZSBtYWluIGN1cnNvciB3aGlsZSB3ZSdyZSBmZXRjaGluZyB0aGUgZG9jXG4gIGZ1bmN0aW9uIGZldGNoRG9jQXN5bmNocm9ub3VzbHkobWV0YWRhdGEsIHJvdywgd2lubmluZ1Jldikge1xuICAgIHZhciBrZXkgPSBtZXRhZGF0YS5pZCArIFwiOjpcIiArIHdpbm5pbmdSZXY7XG4gICAgZG9jSWRSZXZJbmRleC5nZXQoa2V5KS5vbnN1Y2Nlc3MgPSAgZnVuY3Rpb24gb25HZXREb2MoZSkge1xuICAgICAgcm93LmRvYyA9IGRlY29kZURvYyhlLnRhcmdldC5yZXN1bHQpIHx8IHt9O1xuICAgICAgaWYgKG9wdHMuY29uZmxpY3RzKSB7XG4gICAgICAgIHZhciBjb25mbGljdHMgPSBjb2xsZWN0Q29uZmxpY3RzKG1ldGFkYXRhKTtcbiAgICAgICAgaWYgKGNvbmZsaWN0cy5sZW5ndGgpIHtcbiAgICAgICAgICByb3cuZG9jLl9jb25mbGljdHMgPSBjb25mbGljdHM7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGZldGNoQXR0YWNobWVudHNJZk5lY2Vzc2FyeShyb3cuZG9jLCBvcHRzLCB0eG4pO1xuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiBhbGxEb2NzSW5uZXIod2lubmluZ1JldiwgbWV0YWRhdGEpIHtcbiAgICB2YXIgcm93ID0ge1xuICAgICAgaWQ6IG1ldGFkYXRhLmlkLFxuICAgICAga2V5OiBtZXRhZGF0YS5pZCxcbiAgICAgIHZhbHVlOiB7XG4gICAgICAgIHJldjogd2lubmluZ1JldlxuICAgICAgfVxuICAgIH07XG4gICAgdmFyIGRlbGV0ZWQgPSBtZXRhZGF0YS5kZWxldGVkO1xuICAgIGlmIChkZWxldGVkKSB7XG4gICAgICBpZiAoa2V5cykge1xuICAgICAgICByZXN1bHRzLnB1c2gocm93KTtcbiAgICAgICAgLy8gZGVsZXRlZCBkb2NzIGFyZSBva2F5IHdpdGggXCJrZXlzXCIgcmVxdWVzdHNcbiAgICAgICAgcm93LnZhbHVlLmRlbGV0ZWQgPSB0cnVlO1xuICAgICAgICByb3cuZG9jID0gbnVsbDtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHNraXAtLSA8PSAwKSB7XG4gICAgICByZXN1bHRzLnB1c2gocm93KTtcbiAgICAgIGlmIChvcHRzLmluY2x1ZGVfZG9jcykge1xuICAgICAgICBmZXRjaERvY0FzeW5jaHJvbm91c2x5KG1ldGFkYXRhLCByb3csIHdpbm5pbmdSZXYpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHByb2Nlc3NCYXRjaChiYXRjaFZhbHVlcykge1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBiYXRjaFZhbHVlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgaWYgKHJlc3VsdHMubGVuZ3RoID09PSBsaW1pdCkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIHZhciBiYXRjaFZhbHVlID0gYmF0Y2hWYWx1ZXNbaV07XG4gICAgICBpZiAoYmF0Y2hWYWx1ZS5lcnJvciAmJiBrZXlzKSB7XG4gICAgICAgIC8vIGtleSB3YXMgbm90IGZvdW5kIHdpdGggXCJrZXlzXCIgcmVxdWVzdHNcbiAgICAgICAgcmVzdWx0cy5wdXNoKGJhdGNoVmFsdWUpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIHZhciBtZXRhZGF0YSA9IGRlY29kZU1ldGFkYXRhKGJhdGNoVmFsdWUpO1xuICAgICAgdmFyIHdpbm5pbmdSZXYgPSBtZXRhZGF0YS53aW5uaW5nUmV2O1xuICAgICAgYWxsRG9jc0lubmVyKHdpbm5pbmdSZXYsIG1ldGFkYXRhKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBvbkJhdGNoKGJhdGNoS2V5cywgYmF0Y2hWYWx1ZXMsIGN1cnNvcikge1xuICAgIGlmICghY3Vyc29yKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHByb2Nlc3NCYXRjaChiYXRjaFZhbHVlcyk7XG4gICAgaWYgKHJlc3VsdHMubGVuZ3RoIDwgbGltaXQpIHtcbiAgICAgIGN1cnNvci5jb250aW51ZSgpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG9uR2V0QWxsKGUpIHtcbiAgICB2YXIgdmFsdWVzID0gZS50YXJnZXQucmVzdWx0O1xuICAgIGlmIChvcHRzLmRlc2NlbmRpbmcpIHtcbiAgICAgIHZhbHVlcyA9IHZhbHVlcy5yZXZlcnNlKCk7XG4gICAgfVxuICAgIHByb2Nlc3NCYXRjaCh2YWx1ZXMpO1xuICB9XG5cbiAgZnVuY3Rpb24gb25SZXN1bHRzUmVhZHkoKSB7XG4gICAgdmFyIHJldHVyblZhbCA9IHtcbiAgICAgIHRvdGFsX3Jvd3M6IGRvY0NvdW50LFxuICAgICAgb2Zmc2V0OiBvcHRzLnNraXAsXG4gICAgICByb3dzOiByZXN1bHRzXG4gICAgfTtcbiAgICBcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICBpZiAob3B0cy51cGRhdGVfc2VxICYmIHVwZGF0ZVNlcSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm5WYWwudXBkYXRlX3NlcSA9IHVwZGF0ZVNlcTtcbiAgICB9XG4gICAgY2FsbGJhY2sobnVsbCwgcmV0dXJuVmFsKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG9uVHhuQ29tcGxldGUoKSB7XG4gICAgaWYgKG9wdHMuYXR0YWNobWVudHMpIHtcbiAgICAgIHBvc3RQcm9jZXNzQXR0YWNobWVudHMocmVzdWx0cywgb3B0cy5iaW5hcnkpLnRoZW4ob25SZXN1bHRzUmVhZHkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBvblJlc3VsdHNSZWFkeSgpO1xuICAgIH1cbiAgfVxuXG4gIC8vIGRvbid0IGJvdGhlciBkb2luZyBhbnkgcmVxdWVzdHMgaWYgc3RhcnQgPiBlbmQgb3IgbGltaXQgPT09IDBcbiAgaWYgKGtleVJhbmdlRXJyb3IgfHwgbGltaXQgPT09IDApIHtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKGtleXMpIHtcbiAgICByZXR1cm4gYWxsRG9jc0tleXMoa2V5cywgZG9jU3RvcmUsIG9uQmF0Y2gpO1xuICB9XG4gIGlmIChsaW1pdCA9PT0gLTEpIHsgLy8ganVzdCBmZXRjaCBldmVyeXRoaW5nXG4gICAgcmV0dXJuIGdldEFsbChkb2NTdG9yZSwga2V5UmFuZ2UsIG9uR2V0QWxsKTtcbiAgfVxuICAvLyBlbHNlIGRvIGEgY3Vyc29yXG4gIC8vIGNob29zZSBhIGJhdGNoIHNpemUgYmFzZWQgb24gdGhlIHNraXAsIHNpbmNlIHdlJ2xsIG5lZWQgdG8gc2tpcCB0aGF0IG1hbnlcbiAgcnVuQmF0Y2hlZEN1cnNvcihkb2NTdG9yZSwga2V5UmFuZ2UsIG9wdHMuZGVzY2VuZGluZywgbGltaXQgKyBza2lwLCBvbkJhdGNoKTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgaWRiQWxsRG9jczsiLCJpbXBvcnQgeyBERVRFQ1RfQkxPQl9TVVBQT1JUX1NUT1JFIH0gZnJvbSAnLi9jb25zdGFudHMnO1xuXG4vL1xuLy8gQmxvYnMgYXJlIG5vdCBzdXBwb3J0ZWQgaW4gYWxsIHZlcnNpb25zIG9mIEluZGV4ZWREQiwgbm90YWJseVxuLy8gQ2hyb21lIDwzNyBhbmQgQW5kcm9pZCA8NS4gSW4gdGhvc2UgdmVyc2lvbnMsIHN0b3JpbmcgYSBibG9iIHdpbGwgdGhyb3cuXG4vL1xuLy8gVmFyaW91cyBvdGhlciBibG9iIGJ1Z3MgZXhpc3QgaW4gQ2hyb21lIHYzNy00MiAoaW5jbHVzaXZlKS5cbi8vIERldGVjdGluZyB0aGVtIGlzIGV4cGVuc2l2ZSBhbmQgY29uZnVzaW5nIHRvIHVzZXJzLCBhbmQgQ2hyb21lIDM3LTQyXG4vLyBpcyBhdCB2ZXJ5IGxvdyB1c2FnZSB3b3JsZHdpZGUsIHNvIHdlIGRvIGEgaGFja3kgdXNlckFnZW50IGNoZWNrIGluc3RlYWQuXG4vL1xuLy8gY29udGVudC10eXBlIGJ1ZzogaHR0cHM6Ly9jb2RlLmdvb2dsZS5jb20vcC9jaHJvbWl1bS9pc3N1ZXMvZGV0YWlsP2lkPTQwODEyMFxuLy8gNDA0IGJ1ZzogaHR0cHM6Ly9jb2RlLmdvb2dsZS5jb20vcC9jaHJvbWl1bS9pc3N1ZXMvZGV0YWlsP2lkPTQ0NzkxNlxuLy8gRmlsZVJlYWRlciBidWc6IGh0dHBzOi8vY29kZS5nb29nbGUuY29tL3AvY2hyb21pdW0vaXNzdWVzL2RldGFpbD9pZD00NDc4MzZcbi8vXG5mdW5jdGlvbiBjaGVja0Jsb2JTdXBwb3J0KHR4bikge1xuICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUpIHtcbiAgICB2YXIgYmxvYiA9IG5ldyBCbG9iKFsnJ10pO1xuICAgIHZhciByZXEgPSB0eG4ub2JqZWN0U3RvcmUoREVURUNUX0JMT0JfU1VQUE9SVF9TVE9SRSkucHV0KGJsb2IsICdrZXknKTtcblxuICAgIHJlcS5vbnN1Y2Nlc3MgPSBmdW5jdGlvbiAoKSB7XG4gICAgICB2YXIgbWF0Y2hlZENocm9tZSA9IG5hdmlnYXRvci51c2VyQWdlbnQubWF0Y2goL0Nocm9tZVxcLyhcXGQrKS8pO1xuICAgICAgdmFyIG1hdGNoZWRFZGdlID0gbmF2aWdhdG9yLnVzZXJBZ2VudC5tYXRjaCgvRWRnZVxcLy8pO1xuICAgICAgLy8gTVMgRWRnZSBwcmV0ZW5kcyB0byBiZSBDaHJvbWUgNDI6XG4gICAgICAvLyBodHRwczovL21zZG4ubWljcm9zb2Z0LmNvbS9lbi11cy9saWJyYXJ5L2hoODY5MzAxJTI4dj12cy44NSUyOS5hc3B4XG4gICAgICByZXNvbHZlKG1hdGNoZWRFZGdlIHx8ICFtYXRjaGVkQ2hyb21lIHx8XG4gICAgICAgIHBhcnNlSW50KG1hdGNoZWRDaHJvbWVbMV0sIDEwKSA+PSA0Myk7XG4gICAgfTtcblxuICAgIHJlcS5vbmVycm9yID0gdHhuLm9uYWJvcnQgPSBmdW5jdGlvbiAoZSkge1xuICAgICAgLy8gSWYgdGhlIHRyYW5zYWN0aW9uIGFib3J0cyBub3cgaXRzIGR1ZSB0byBub3QgYmVpbmcgYWJsZSB0b1xuICAgICAgLy8gd3JpdGUgdG8gdGhlIGRhdGFiYXNlLCBsaWtlbHkgZHVlIHRvIHRoZSBkaXNrIGJlaW5nIGZ1bGxcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICByZXNvbHZlKGZhbHNlKTtcbiAgICB9O1xuICB9KS5jYXRjaChmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIGZhbHNlOyAvLyBlcnJvciwgc28gYXNzdW1lIHVuc3VwcG9ydGVkXG4gIH0pO1xufVxuXG5leHBvcnQgZGVmYXVsdCBjaGVja0Jsb2JTdXBwb3J0O1xuIiwiaW1wb3J0IHsgRE9DX1NUT1JFIH0gZnJvbSAnLi9jb25zdGFudHMnO1xuXG5mdW5jdGlvbiBjb3VudERvY3ModHhuLCBjYikge1xuICB2YXIgaW5kZXggPSB0eG4ub2JqZWN0U3RvcmUoRE9DX1NUT1JFKS5pbmRleCgnZGVsZXRlZE9yTG9jYWwnKTtcbiAgaW5kZXguY291bnQoSURCS2V5UmFuZ2Uub25seSgnMCcpKS5vbnN1Y2Nlc3MgPSBmdW5jdGlvbiAoZSkge1xuICAgIGNiKGUudGFyZ2V0LnJlc3VsdCk7XG4gIH07XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNvdW50RG9jcztcbiIsIi8vIFRoaXMgdGFzayBxdWV1ZSBlbnN1cmVzIHRoYXQgSURCIG9wZW4gY2FsbHMgYXJlIGRvbmUgaW4gdGhlaXIgb3duIHRpY2tcbi8vIGFuZCBzZXF1ZW50aWFsbHkgLSBpLmUuIHdlIHdhaXQgZm9yIHRoZSBhc3luYyBJREIgb3BlbiB0byAqZnVsbHkqIGNvbXBsZXRlXG4vLyBiZWZvcmUgY2FsbGluZyB0aGUgbmV4dCBvbmUuIFRoaXMgd29ya3MgYXJvdW5kIElFL0VkZ2UgcmFjZSBjb25kaXRpb25zIGluIElEQi5cblxuaW1wb3J0IHsgbmV4dFRpY2sgfSBmcm9tICdwb3VjaGRiLXV0aWxzJztcblxudmFyIHJ1bm5pbmcgPSBmYWxzZTtcbnZhciBxdWV1ZSA9IFtdO1xuXG5mdW5jdGlvbiB0cnlDb2RlKGZ1biwgZXJyLCByZXMsIFBvdWNoREIpIHtcbiAgdHJ5IHtcbiAgICBmdW4oZXJyLCByZXMpO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICAvLyBTaG91bGRuJ3QgaGFwcGVuLCBidXQgaW4gc29tZSBvZGQgY2FzZXNcbiAgICAvLyBJbmRleGVkREIgaW1wbGVtZW50YXRpb25zIG1pZ2h0IHRocm93IGEgc3luY1xuICAgIC8vIGVycm9yLCBpbiB3aGljaCBjYXNlIHRoaXMgd2lsbCBhdCBsZWFzdCBsb2cgaXQuXG4gICAgUG91Y2hEQi5lbWl0KCdlcnJvcicsIGVycik7XG4gIH1cbn1cblxuZnVuY3Rpb24gYXBwbHlOZXh0KCkge1xuICBpZiAocnVubmluZyB8fCAhcXVldWUubGVuZ3RoKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIHJ1bm5pbmcgPSB0cnVlO1xuICBxdWV1ZS5zaGlmdCgpKCk7XG59XG5cbmZ1bmN0aW9uIGVucXVldWVUYXNrKGFjdGlvbiwgY2FsbGJhY2ssIFBvdWNoREIpIHtcbiAgcXVldWUucHVzaChmdW5jdGlvbiBydW5BY3Rpb24oKSB7XG4gICAgYWN0aW9uKGZ1bmN0aW9uIHJ1bkNhbGxiYWNrKGVyciwgcmVzKSB7XG4gICAgICB0cnlDb2RlKGNhbGxiYWNrLCBlcnIsIHJlcywgUG91Y2hEQik7XG4gICAgICBydW5uaW5nID0gZmFsc2U7XG4gICAgICBuZXh0VGljayhmdW5jdGlvbiBydW5OZXh0KCkge1xuICAgICAgICBhcHBseU5leHQoUG91Y2hEQik7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSk7XG4gIGFwcGx5TmV4dCgpO1xufVxuXG5leHBvcnQge1xuICBlbnF1ZXVlVGFzayxcbn07IiwiaW1wb3J0IGNoYW5nZXNIYW5kbGVyIGZyb20gJy4vY2hhbmdlc0hhbmRsZXInO1xuaW1wb3J0IHtcbiAgY2xvbmUsXG4gIGZpbHRlckNoYW5nZSxcbiAgdXVpZFxufSBmcm9tICdwb3VjaGRiLXV0aWxzJztcbmltcG9ydCB7XG4gIEFUVEFDSF9TVE9SRSxcbiAgQllfU0VRX1NUT1JFLFxuICBET0NfU1RPUkVcbn0gZnJvbSAnLi9jb25zdGFudHMnO1xuaW1wb3J0IHtcbiAgZGVjb2RlRG9jLFxuICBkZWNvZGVNZXRhZGF0YSxcbiAgZmV0Y2hBdHRhY2htZW50c0lmTmVjZXNzYXJ5LFxuICBpZGJFcnJvcixcbiAgcG9zdFByb2Nlc3NBdHRhY2htZW50cyxcbiAgb3BlblRyYW5zYWN0aW9uU2FmZWx5XG59IGZyb20gJy4vdXRpbHMnO1xuaW1wb3J0IHJ1bkJhdGNoZWRDdXJzb3IgZnJvbSAnLi9ydW5CYXRjaGVkQ3Vyc29yJztcblxuZnVuY3Rpb24gY2hhbmdlcyhvcHRzLCBhcGksIGRiTmFtZSwgaWRiKSB7XG4gIG9wdHMgPSBjbG9uZShvcHRzKTtcblxuICBpZiAob3B0cy5jb250aW51b3VzKSB7XG4gICAgdmFyIGlkID0gZGJOYW1lICsgJzonICsgdXVpZCgpO1xuICAgIGNoYW5nZXNIYW5kbGVyLmFkZExpc3RlbmVyKGRiTmFtZSwgaWQsIGFwaSwgb3B0cyk7XG4gICAgY2hhbmdlc0hhbmRsZXIubm90aWZ5KGRiTmFtZSk7XG4gICAgcmV0dXJuIHtcbiAgICAgIGNhbmNlbDogZnVuY3Rpb24gKCkge1xuICAgICAgICBjaGFuZ2VzSGFuZGxlci5yZW1vdmVMaXN0ZW5lcihkYk5hbWUsIGlkKTtcbiAgICAgIH1cbiAgICB9O1xuICB9XG5cbiAgdmFyIGRvY0lkcyA9IG9wdHMuZG9jX2lkcyAmJiBuZXcgU2V0KG9wdHMuZG9jX2lkcyk7XG5cbiAgb3B0cy5zaW5jZSA9IG9wdHMuc2luY2UgfHwgMDtcbiAgdmFyIGxhc3RTZXEgPSBvcHRzLnNpbmNlO1xuXG4gIHZhciBsaW1pdCA9ICdsaW1pdCcgaW4gb3B0cyA/IG9wdHMubGltaXQgOiAtMTtcbiAgaWYgKGxpbWl0ID09PSAwKSB7XG4gICAgbGltaXQgPSAxOyAvLyBwZXIgQ291Y2hEQiBfY2hhbmdlcyBzcGVjXG4gIH1cblxuICB2YXIgcmVzdWx0cyA9IFtdO1xuICB2YXIgbnVtUmVzdWx0cyA9IDA7XG4gIHZhciBmaWx0ZXIgPSBmaWx0ZXJDaGFuZ2Uob3B0cyk7XG4gIHZhciBkb2NJZHNUb01ldGFkYXRhID0gbmV3IE1hcCgpO1xuXG4gIHZhciB0eG47XG4gIHZhciBieVNlcVN0b3JlO1xuICB2YXIgZG9jU3RvcmU7XG4gIHZhciBkb2NJZFJldkluZGV4O1xuXG4gIGZ1bmN0aW9uIG9uQmF0Y2goYmF0Y2hLZXlzLCBiYXRjaFZhbHVlcywgY3Vyc29yKSB7XG4gICAgaWYgKCFjdXJzb3IgfHwgIWJhdGNoS2V5cy5sZW5ndGgpIHsgLy8gZG9uZVxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciB3aW5uaW5nRG9jcyA9IG5ldyBBcnJheShiYXRjaEtleXMubGVuZ3RoKTtcbiAgICB2YXIgbWV0YWRhdGFzID0gbmV3IEFycmF5KGJhdGNoS2V5cy5sZW5ndGgpO1xuXG4gICAgZnVuY3Rpb24gcHJvY2Vzc01ldGFkYXRhQW5kV2lubmluZ0RvYyhtZXRhZGF0YSwgd2lubmluZ0RvYykge1xuICAgICAgdmFyIGNoYW5nZSA9IG9wdHMucHJvY2Vzc0NoYW5nZSh3aW5uaW5nRG9jLCBtZXRhZGF0YSwgb3B0cyk7XG4gICAgICBsYXN0U2VxID0gY2hhbmdlLnNlcSA9IG1ldGFkYXRhLnNlcTtcblxuICAgICAgdmFyIGZpbHRlcmVkID0gZmlsdGVyKGNoYW5nZSk7XG4gICAgICBpZiAodHlwZW9mIGZpbHRlcmVkID09PSAnb2JqZWN0JykgeyAvLyBhbnl0aGluZyBidXQgdHJ1ZS9mYWxzZSBpbmRpY2F0ZXMgZXJyb3JcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGZpbHRlcmVkKTtcbiAgICAgIH1cblxuICAgICAgaWYgKCFmaWx0ZXJlZCkge1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgICB9XG4gICAgICBudW1SZXN1bHRzKys7XG4gICAgICBpZiAob3B0cy5yZXR1cm5fZG9jcykge1xuICAgICAgICByZXN1bHRzLnB1c2goY2hhbmdlKTtcbiAgICAgIH1cbiAgICAgIC8vIHByb2Nlc3MgdGhlIGF0dGFjaG1lbnQgaW1tZWRpYXRlbHlcbiAgICAgIC8vIGZvciB0aGUgYmVuZWZpdCBvZiBsaXZlIGxpc3RlbmVyc1xuICAgICAgaWYgKG9wdHMuYXR0YWNobWVudHMgJiYgb3B0cy5pbmNsdWRlX2RvY3MpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlKSB7XG4gICAgICAgICAgZmV0Y2hBdHRhY2htZW50c0lmTmVjZXNzYXJ5KHdpbm5pbmdEb2MsIG9wdHMsIHR4biwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcG9zdFByb2Nlc3NBdHRhY2htZW50cyhbY2hhbmdlXSwgb3B0cy5iaW5hcnkpLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICByZXNvbHZlKGNoYW5nZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGNoYW5nZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb25CYXRjaERvbmUoKSB7XG4gICAgICB2YXIgcHJvbWlzZXMgPSBbXTtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSB3aW5uaW5nRG9jcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICBpZiAobnVtUmVzdWx0cyA9PT0gbGltaXQpIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICB2YXIgd2lubmluZ0RvYyA9IHdpbm5pbmdEb2NzW2ldO1xuICAgICAgICBpZiAoIXdpbm5pbmdEb2MpIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgbWV0YWRhdGEgPSBtZXRhZGF0YXNbaV07XG4gICAgICAgIHByb21pc2VzLnB1c2gocHJvY2Vzc01ldGFkYXRhQW5kV2lubmluZ0RvYyhtZXRhZGF0YSwgd2lubmluZ0RvYykpO1xuICAgICAgfVxuXG4gICAgICBQcm9taXNlLmFsbChwcm9taXNlcykudGhlbihmdW5jdGlvbiAoY2hhbmdlcykge1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gY2hhbmdlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgIGlmIChjaGFuZ2VzW2ldKSB7XG4gICAgICAgICAgICBvcHRzLm9uQ2hhbmdlKGNoYW5nZXNbaV0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSkuY2F0Y2gob3B0cy5jb21wbGV0ZSk7XG5cbiAgICAgIGlmIChudW1SZXN1bHRzICE9PSBsaW1pdCkge1xuICAgICAgICBjdXJzb3IuY29udGludWUoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBGZXRjaCBhbGwgbWV0YWRhdGFzL3dpbm5pbmdkb2NzIGZyb20gdGhpcyBiYXRjaCBpbiBwYXJhbGxlbCwgdGhlbiBwcm9jZXNzXG4gICAgLy8gdGhlbSBhbGwgb25seSBvbmNlIGFsbCBkYXRhIGhhcyBiZWVuIGNvbGxlY3RlZC4gVGhpcyBpcyBkb25lIGluIHBhcmFsbGVsXG4gICAgLy8gYmVjYXVzZSBpdCdzIGZhc3RlciB0aGFuIGRvaW5nIGl0IG9uZS1hdC1hLXRpbWUuXG4gICAgdmFyIG51bURvbmUgPSAwO1xuICAgIGJhdGNoVmFsdWVzLmZvckVhY2goZnVuY3Rpb24gKHZhbHVlLCBpKSB7XG4gICAgICB2YXIgZG9jID0gZGVjb2RlRG9jKHZhbHVlKTtcbiAgICAgIHZhciBzZXEgPSBiYXRjaEtleXNbaV07XG4gICAgICBmZXRjaFdpbm5pbmdEb2NBbmRNZXRhZGF0YShkb2MsIHNlcSwgZnVuY3Rpb24gKG1ldGFkYXRhLCB3aW5uaW5nRG9jKSB7XG4gICAgICAgIG1ldGFkYXRhc1tpXSA9IG1ldGFkYXRhO1xuICAgICAgICB3aW5uaW5nRG9jc1tpXSA9IHdpbm5pbmdEb2M7XG4gICAgICAgIGlmICgrK251bURvbmUgPT09IGJhdGNoS2V5cy5sZW5ndGgpIHtcbiAgICAgICAgICBvbkJhdGNoRG9uZSgpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG9uR2V0TWV0YWRhdGEoZG9jLCBzZXEsIG1ldGFkYXRhLCBjYikge1xuICAgIGlmIChtZXRhZGF0YS5zZXEgIT09IHNlcSkge1xuICAgICAgLy8gc29tZSBvdGhlciBzZXEgaXMgbGF0ZXJcbiAgICAgIHJldHVybiBjYigpO1xuICAgIH1cblxuICAgIGlmIChtZXRhZGF0YS53aW5uaW5nUmV2ID09PSBkb2MuX3Jldikge1xuICAgICAgLy8gdGhpcyBpcyB0aGUgd2lubmluZyBkb2NcbiAgICAgIHJldHVybiBjYihtZXRhZGF0YSwgZG9jKTtcbiAgICB9XG5cbiAgICAvLyBmZXRjaCB3aW5uaW5nIGRvYyBpbiBzZXBhcmF0ZSByZXF1ZXN0XG4gICAgdmFyIGRvY0lkUmV2ID0gZG9jLl9pZCArICc6OicgKyBtZXRhZGF0YS53aW5uaW5nUmV2O1xuICAgIHZhciByZXEgPSBkb2NJZFJldkluZGV4LmdldChkb2NJZFJldik7XG4gICAgcmVxLm9uc3VjY2VzcyA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICBjYihtZXRhZGF0YSwgZGVjb2RlRG9jKGUudGFyZ2V0LnJlc3VsdCkpO1xuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiBmZXRjaFdpbm5pbmdEb2NBbmRNZXRhZGF0YShkb2MsIHNlcSwgY2IpIHtcbiAgICBpZiAoZG9jSWRzICYmICFkb2NJZHMuaGFzKGRvYy5faWQpKSB7XG4gICAgICByZXR1cm4gY2IoKTtcbiAgICB9XG5cbiAgICB2YXIgbWV0YWRhdGEgPSBkb2NJZHNUb01ldGFkYXRhLmdldChkb2MuX2lkKTtcbiAgICBpZiAobWV0YWRhdGEpIHsgLy8gY2FjaGVkXG4gICAgICByZXR1cm4gb25HZXRNZXRhZGF0YShkb2MsIHNlcSwgbWV0YWRhdGEsIGNiKTtcbiAgICB9XG4gICAgLy8gbWV0YWRhdGEgbm90IGNhY2hlZCwgaGF2ZSB0byBnbyBmZXRjaCBpdFxuICAgIGRvY1N0b3JlLmdldChkb2MuX2lkKS5vbnN1Y2Nlc3MgPSBmdW5jdGlvbiAoZSkge1xuICAgICAgbWV0YWRhdGEgPSBkZWNvZGVNZXRhZGF0YShlLnRhcmdldC5yZXN1bHQpO1xuICAgICAgZG9jSWRzVG9NZXRhZGF0YS5zZXQoZG9jLl9pZCwgbWV0YWRhdGEpO1xuICAgICAgb25HZXRNZXRhZGF0YShkb2MsIHNlcSwgbWV0YWRhdGEsIGNiKTtcbiAgICB9O1xuICB9XG5cbiAgZnVuY3Rpb24gZmluaXNoKCkge1xuICAgIG9wdHMuY29tcGxldGUobnVsbCwge1xuICAgICAgcmVzdWx0czogcmVzdWx0cyxcbiAgICAgIGxhc3Rfc2VxOiBsYXN0U2VxXG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBvblR4bkNvbXBsZXRlKCkge1xuICAgIGlmICghb3B0cy5jb250aW51b3VzICYmIG9wdHMuYXR0YWNobWVudHMpIHtcbiAgICAgIC8vIGNhbm5vdCBndWFyYW50ZWUgdGhhdCBwb3N0UHJvY2Vzc2luZyB3YXMgYWxyZWFkeSBkb25lLFxuICAgICAgLy8gc28gZG8gaXQgYWdhaW5cbiAgICAgIHBvc3RQcm9jZXNzQXR0YWNobWVudHMocmVzdWx0cykudGhlbihmaW5pc2gpO1xuICAgIH0gZWxzZSB7XG4gICAgICBmaW5pc2goKTtcbiAgICB9XG4gIH1cblxuICB2YXIgb2JqZWN0U3RvcmVzID0gW0RPQ19TVE9SRSwgQllfU0VRX1NUT1JFXTtcbiAgaWYgKG9wdHMuYXR0YWNobWVudHMpIHtcbiAgICBvYmplY3RTdG9yZXMucHVzaChBVFRBQ0hfU1RPUkUpO1xuICB9XG4gIHZhciB0eG5SZXN1bHQgPSBvcGVuVHJhbnNhY3Rpb25TYWZlbHkoaWRiLCBvYmplY3RTdG9yZXMsICdyZWFkb25seScpO1xuICBpZiAodHhuUmVzdWx0LmVycm9yKSB7XG4gICAgcmV0dXJuIG9wdHMuY29tcGxldGUodHhuUmVzdWx0LmVycm9yKTtcbiAgfVxuICB0eG4gPSB0eG5SZXN1bHQudHhuO1xuICB0eG4ub25hYm9ydCA9IGlkYkVycm9yKG9wdHMuY29tcGxldGUpO1xuICB0eG4ub25jb21wbGV0ZSA9IG9uVHhuQ29tcGxldGU7XG5cbiAgYnlTZXFTdG9yZSA9IHR4bi5vYmplY3RTdG9yZShCWV9TRVFfU1RPUkUpO1xuICBkb2NTdG9yZSA9IHR4bi5vYmplY3RTdG9yZShET0NfU1RPUkUpO1xuICBkb2NJZFJldkluZGV4ID0gYnlTZXFTdG9yZS5pbmRleCgnX2RvY19pZF9yZXYnKTtcblxuICB2YXIga2V5UmFuZ2UgPSAob3B0cy5zaW5jZSAmJiAhb3B0cy5kZXNjZW5kaW5nKSA/XG4gICAgSURCS2V5UmFuZ2UubG93ZXJCb3VuZChvcHRzLnNpbmNlLCB0cnVlKSA6IG51bGw7XG5cbiAgcnVuQmF0Y2hlZEN1cnNvcihieVNlcVN0b3JlLCBrZXlSYW5nZSwgb3B0cy5kZXNjZW5kaW5nLCBsaW1pdCwgb25CYXRjaCk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNoYW5nZXM7XG4iLCJpbXBvcnQge1xuICBndWFyZGVkQ29uc29sZSxcbiAgdG9Qcm9taXNlLFxuICBoYXNMb2NhbFN0b3JhZ2UsXG4gIHV1aWQsXG4gIG5leHRUaWNrXG59IGZyb20gJ3BvdWNoZGItdXRpbHMnO1xuaW1wb3J0IHtcbiAgaXNEZWxldGVkLFxuICBpc0xvY2FsSWQsXG4gIHRyYXZlcnNlUmV2VHJlZSxcbiAgd2lubmluZ1JldiBhcyBjYWxjdWxhdGVXaW5uaW5nUmV2LFxuICBsYXRlc3QgYXMgZ2V0TGF0ZXN0XG59IGZyb20gJ3BvdWNoZGItbWVyZ2UnO1xuXG5pbXBvcnQgaWRiQnVsa0RvY3MgZnJvbSAnLi9idWxrRG9jcyc7XG5pbXBvcnQgaWRiQWxsRG9jcyBmcm9tICcuL2FsbERvY3MnO1xuaW1wb3J0IGNoZWNrQmxvYlN1cHBvcnQgZnJvbSAnLi9ibG9iU3VwcG9ydCc7XG5pbXBvcnQgY291bnREb2NzIGZyb20gJy4vY291bnREb2NzJztcbmltcG9ydCB7XG4gIE1JU1NJTkdfRE9DLFxuICBSRVZfQ09ORkxJQ1QsXG4gIElEQl9FUlJPUixcbiAgY3JlYXRlRXJyb3Jcbn0gZnJvbSAncG91Y2hkYi1lcnJvcnMnO1xuXG5pbXBvcnQge1xuICBBREFQVEVSX1ZFUlNJT04sXG4gIEFUVEFDSF9BTkRfU0VRX1NUT1JFLFxuICBBVFRBQ0hfU1RPUkUsXG4gIEJZX1NFUV9TVE9SRSxcbiAgREVURUNUX0JMT0JfU1VQUE9SVF9TVE9SRSxcbiAgRE9DX1NUT1JFLFxuICBMT0NBTF9TVE9SRSxcbiAgTUVUQV9TVE9SRVxufSBmcm9tICcuL2NvbnN0YW50cyc7XG5cbmltcG9ydCB7XG4gIGNvbXBhY3RSZXZzLFxuICBkZWNvZGVEb2MsXG4gIGRlY29kZU1ldGFkYXRhLFxuICBlbmNvZGVNZXRhZGF0YSxcbiAgaWRiRXJyb3IsXG4gIHJlYWRCbG9iRGF0YSxcbiAgb3BlblRyYW5zYWN0aW9uU2FmZWx5XG59IGZyb20gJy4vdXRpbHMnO1xuXG5pbXBvcnQgeyBlbnF1ZXVlVGFzayB9IGZyb20gJy4vdGFza1F1ZXVlJztcblxuaW1wb3J0IGNoYW5nZXNIYW5kbGVyIGZyb20gJy4vY2hhbmdlc0hhbmRsZXInO1xuaW1wb3J0IGNoYW5nZXMgZnJvbSAnLi9jaGFuZ2VzJztcblxudmFyIGNhY2hlZERCcyA9IG5ldyBNYXAoKTtcbnZhciBibG9iU3VwcG9ydFByb21pc2U7XG52YXIgb3BlblJlcUxpc3QgPSBuZXcgTWFwKCk7XG5cbmZ1bmN0aW9uIElkYlBvdWNoKG9wdHMsIGNhbGxiYWNrKSB7XG4gIHZhciBhcGkgPSB0aGlzO1xuXG4gIGVucXVldWVUYXNrKGZ1bmN0aW9uICh0aGlzQ2FsbGJhY2spIHtcbiAgICBpbml0KGFwaSwgb3B0cywgdGhpc0NhbGxiYWNrKTtcbiAgfSwgY2FsbGJhY2ssIGFwaS5jb25zdHJ1Y3Rvcik7XG59XG5cbmZ1bmN0aW9uIGluaXQoYXBpLCBvcHRzLCBjYWxsYmFjaykge1xuXG4gIHZhciBkYk5hbWUgPSBvcHRzLm5hbWU7XG5cbiAgdmFyIGlkYiA9IG51bGw7XG4gIHZhciBpZGJHbG9iYWxGYWlsdXJlRXJyb3IgPSBudWxsO1xuICBhcGkuX21ldGEgPSBudWxsO1xuXG4gIGZ1bmN0aW9uIGVucmljaENhbGxiYWNrRXJyb3IoY2FsbGJhY2spIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKGVycm9yLCByZXN1bHQpIHtcbiAgICAgIGlmIChlcnJvciAmJiBlcnJvciBpbnN0YW5jZW9mIEVycm9yICYmICFlcnJvci5yZWFzb24pIHtcbiAgICAgICAgaWYgKGlkYkdsb2JhbEZhaWx1cmVFcnJvcikge1xuICAgICAgICAgIGVycm9yLnJlYXNvbiA9IGlkYkdsb2JhbEZhaWx1cmVFcnJvcjtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBjYWxsYmFjayhlcnJvciwgcmVzdWx0KTtcbiAgICB9O1xuICB9XG5cbiAgLy8gY2FsbGVkIHdoZW4gY3JlYXRpbmcgYSBmcmVzaCBuZXcgZGF0YWJhc2VcbiAgZnVuY3Rpb24gY3JlYXRlU2NoZW1hKGRiKSB7XG4gICAgdmFyIGRvY1N0b3JlID0gZGIuY3JlYXRlT2JqZWN0U3RvcmUoRE9DX1NUT1JFLCB7a2V5UGF0aCA6ICdpZCd9KTtcbiAgICBkYi5jcmVhdGVPYmplY3RTdG9yZShCWV9TRVFfU1RPUkUsIHthdXRvSW5jcmVtZW50OiB0cnVlfSlcbiAgICAgIC5jcmVhdGVJbmRleCgnX2RvY19pZF9yZXYnLCAnX2RvY19pZF9yZXYnLCB7dW5pcXVlOiB0cnVlfSk7XG4gICAgZGIuY3JlYXRlT2JqZWN0U3RvcmUoQVRUQUNIX1NUT1JFLCB7a2V5UGF0aDogJ2RpZ2VzdCd9KTtcbiAgICBkYi5jcmVhdGVPYmplY3RTdG9yZShNRVRBX1NUT1JFLCB7a2V5UGF0aDogJ2lkJywgYXV0b0luY3JlbWVudDogZmFsc2V9KTtcbiAgICBkYi5jcmVhdGVPYmplY3RTdG9yZShERVRFQ1RfQkxPQl9TVVBQT1JUX1NUT1JFKTtcblxuICAgIC8vIGFkZGVkIGluIHYyXG4gICAgZG9jU3RvcmUuY3JlYXRlSW5kZXgoJ2RlbGV0ZWRPckxvY2FsJywgJ2RlbGV0ZWRPckxvY2FsJywge3VuaXF1ZSA6IGZhbHNlfSk7XG5cbiAgICAvLyBhZGRlZCBpbiB2M1xuICAgIGRiLmNyZWF0ZU9iamVjdFN0b3JlKExPQ0FMX1NUT1JFLCB7a2V5UGF0aDogJ19pZCd9KTtcblxuICAgIC8vIGFkZGVkIGluIHY0XG4gICAgdmFyIGF0dEFuZFNlcVN0b3JlID0gZGIuY3JlYXRlT2JqZWN0U3RvcmUoQVRUQUNIX0FORF9TRVFfU1RPUkUsXG4gICAgICB7YXV0b0luY3JlbWVudDogdHJ1ZX0pO1xuICAgIGF0dEFuZFNlcVN0b3JlLmNyZWF0ZUluZGV4KCdzZXEnLCAnc2VxJyk7XG4gICAgYXR0QW5kU2VxU3RvcmUuY3JlYXRlSW5kZXgoJ2RpZ2VzdFNlcScsICdkaWdlc3RTZXEnLCB7dW5pcXVlOiB0cnVlfSk7XG4gIH1cblxuICAvLyBtaWdyYXRpb24gdG8gdmVyc2lvbiAyXG4gIC8vIHVuZm9ydHVuYXRlbHkgXCJkZWxldGVkT3JMb2NhbFwiIGlzIGEgbWlzbm9tZXIgbm93IHRoYXQgd2Ugbm8gbG9uZ2VyXG4gIC8vIHN0b3JlIGxvY2FsIGRvY3MgaW4gdGhlIG1haW4gZG9jLXN0b3JlLCBidXQgd2hhZGR5YWdvbm5hZG9cbiAgZnVuY3Rpb24gYWRkRGVsZXRlZE9yTG9jYWxJbmRleCh0eG4sIGNhbGxiYWNrKSB7XG4gICAgdmFyIGRvY1N0b3JlID0gdHhuLm9iamVjdFN0b3JlKERPQ19TVE9SRSk7XG4gICAgZG9jU3RvcmUuY3JlYXRlSW5kZXgoJ2RlbGV0ZWRPckxvY2FsJywgJ2RlbGV0ZWRPckxvY2FsJywge3VuaXF1ZSA6IGZhbHNlfSk7XG5cbiAgICBkb2NTdG9yZS5vcGVuQ3Vyc29yKCkub25zdWNjZXNzID0gZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICB2YXIgY3Vyc29yID0gZXZlbnQudGFyZ2V0LnJlc3VsdDtcbiAgICAgIGlmIChjdXJzb3IpIHtcbiAgICAgICAgdmFyIG1ldGFkYXRhID0gY3Vyc29yLnZhbHVlO1xuICAgICAgICB2YXIgZGVsZXRlZCA9IGlzRGVsZXRlZChtZXRhZGF0YSk7XG4gICAgICAgIG1ldGFkYXRhLmRlbGV0ZWRPckxvY2FsID0gZGVsZXRlZCA/IFwiMVwiIDogXCIwXCI7XG4gICAgICAgIGRvY1N0b3JlLnB1dChtZXRhZGF0YSk7XG4gICAgICAgIGN1cnNvci5jb250aW51ZSgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgIH1cbiAgICB9O1xuICB9XG5cbiAgLy8gbWlncmF0aW9uIHRvIHZlcnNpb24gMyAocGFydCAxKVxuICBmdW5jdGlvbiBjcmVhdGVMb2NhbFN0b3JlU2NoZW1hKGRiKSB7XG4gICAgZGIuY3JlYXRlT2JqZWN0U3RvcmUoTE9DQUxfU1RPUkUsIHtrZXlQYXRoOiAnX2lkJ30pXG4gICAgICAuY3JlYXRlSW5kZXgoJ19kb2NfaWRfcmV2JywgJ19kb2NfaWRfcmV2Jywge3VuaXF1ZTogdHJ1ZX0pO1xuICB9XG5cbiAgLy8gbWlncmF0aW9uIHRvIHZlcnNpb24gMyAocGFydCAyKVxuICBmdW5jdGlvbiBtaWdyYXRlTG9jYWxTdG9yZSh0eG4sIGNiKSB7XG4gICAgdmFyIGxvY2FsU3RvcmUgPSB0eG4ub2JqZWN0U3RvcmUoTE9DQUxfU1RPUkUpO1xuICAgIHZhciBkb2NTdG9yZSA9IHR4bi5vYmplY3RTdG9yZShET0NfU1RPUkUpO1xuICAgIHZhciBzZXFTdG9yZSA9IHR4bi5vYmplY3RTdG9yZShCWV9TRVFfU1RPUkUpO1xuXG4gICAgdmFyIGN1cnNvciA9IGRvY1N0b3JlLm9wZW5DdXJzb3IoKTtcbiAgICBjdXJzb3Iub25zdWNjZXNzID0gZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICB2YXIgY3Vyc29yID0gZXZlbnQudGFyZ2V0LnJlc3VsdDtcbiAgICAgIGlmIChjdXJzb3IpIHtcbiAgICAgICAgdmFyIG1ldGFkYXRhID0gY3Vyc29yLnZhbHVlO1xuICAgICAgICB2YXIgZG9jSWQgPSBtZXRhZGF0YS5pZDtcbiAgICAgICAgdmFyIGxvY2FsID0gaXNMb2NhbElkKGRvY0lkKTtcbiAgICAgICAgdmFyIHJldiA9IGNhbGN1bGF0ZVdpbm5pbmdSZXYobWV0YWRhdGEpO1xuICAgICAgICBpZiAobG9jYWwpIHtcbiAgICAgICAgICB2YXIgZG9jSWRSZXYgPSBkb2NJZCArIFwiOjpcIiArIHJldjtcbiAgICAgICAgICAvLyByZW1vdmUgYWxsIHNlcSBlbnRyaWVzXG4gICAgICAgICAgLy8gYXNzb2NpYXRlZCB3aXRoIHRoaXMgZG9jSWRcbiAgICAgICAgICB2YXIgc3RhcnQgPSBkb2NJZCArIFwiOjpcIjtcbiAgICAgICAgICB2YXIgZW5kID0gZG9jSWQgKyBcIjo6flwiO1xuICAgICAgICAgIHZhciBpbmRleCA9IHNlcVN0b3JlLmluZGV4KCdfZG9jX2lkX3JldicpO1xuICAgICAgICAgIHZhciByYW5nZSA9IElEQktleVJhbmdlLmJvdW5kKHN0YXJ0LCBlbmQsIGZhbHNlLCBmYWxzZSk7XG4gICAgICAgICAgdmFyIHNlcUN1cnNvciA9IGluZGV4Lm9wZW5DdXJzb3IocmFuZ2UpO1xuICAgICAgICAgIHNlcUN1cnNvci5vbnN1Y2Nlc3MgPSBmdW5jdGlvbiAoZSkge1xuICAgICAgICAgICAgc2VxQ3Vyc29yID0gZS50YXJnZXQucmVzdWx0O1xuICAgICAgICAgICAgaWYgKCFzZXFDdXJzb3IpIHtcbiAgICAgICAgICAgICAgLy8gZG9uZVxuICAgICAgICAgICAgICBkb2NTdG9yZS5kZWxldGUoY3Vyc29yLnByaW1hcnlLZXkpO1xuICAgICAgICAgICAgICBjdXJzb3IuY29udGludWUoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHZhciBkYXRhID0gc2VxQ3Vyc29yLnZhbHVlO1xuICAgICAgICAgICAgICBpZiAoZGF0YS5fZG9jX2lkX3JldiA9PT0gZG9jSWRSZXYpIHtcbiAgICAgICAgICAgICAgICBsb2NhbFN0b3JlLnB1dChkYXRhKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBzZXFTdG9yZS5kZWxldGUoc2VxQ3Vyc29yLnByaW1hcnlLZXkpO1xuICAgICAgICAgICAgICBzZXFDdXJzb3IuY29udGludWUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGN1cnNvci5jb250aW51ZSgpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGNiKSB7XG4gICAgICAgIGNiKCk7XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIC8vIG1pZ3JhdGlvbiB0byB2ZXJzaW9uIDQgKHBhcnQgMSlcbiAgZnVuY3Rpb24gYWRkQXR0YWNoQW5kU2VxU3RvcmUoZGIpIHtcbiAgICB2YXIgYXR0QW5kU2VxU3RvcmUgPSBkYi5jcmVhdGVPYmplY3RTdG9yZShBVFRBQ0hfQU5EX1NFUV9TVE9SRSxcbiAgICAgIHthdXRvSW5jcmVtZW50OiB0cnVlfSk7XG4gICAgYXR0QW5kU2VxU3RvcmUuY3JlYXRlSW5kZXgoJ3NlcScsICdzZXEnKTtcbiAgICBhdHRBbmRTZXFTdG9yZS5jcmVhdGVJbmRleCgnZGlnZXN0U2VxJywgJ2RpZ2VzdFNlcScsIHt1bmlxdWU6IHRydWV9KTtcbiAgfVxuXG4gIC8vIG1pZ3JhdGlvbiB0byB2ZXJzaW9uIDQgKHBhcnQgMilcbiAgZnVuY3Rpb24gbWlncmF0ZUF0dHNBbmRTZXFzKHR4biwgY2FsbGJhY2spIHtcbiAgICB2YXIgc2VxU3RvcmUgPSB0eG4ub2JqZWN0U3RvcmUoQllfU0VRX1NUT1JFKTtcbiAgICB2YXIgYXR0U3RvcmUgPSB0eG4ub2JqZWN0U3RvcmUoQVRUQUNIX1NUT1JFKTtcbiAgICB2YXIgYXR0QW5kU2VxU3RvcmUgPSB0eG4ub2JqZWN0U3RvcmUoQVRUQUNIX0FORF9TRVFfU1RPUkUpO1xuXG4gICAgLy8gbmVlZCB0byBhY3R1YWxseSBwb3B1bGF0ZSB0aGUgdGFibGUuIHRoaXMgaXMgdGhlIGV4cGVuc2l2ZSBwYXJ0LFxuICAgIC8vIHNvIGFzIGFuIG9wdGltaXphdGlvbiwgY2hlY2sgZmlyc3QgdGhhdCB0aGlzIGRhdGFiYXNlIGV2ZW5cbiAgICAvLyBjb250YWlucyBhdHRhY2htZW50c1xuICAgIHZhciByZXEgPSBhdHRTdG9yZS5jb3VudCgpO1xuICAgIHJlcS5vbnN1Y2Nlc3MgPSBmdW5jdGlvbiAoZSkge1xuICAgICAgdmFyIGNvdW50ID0gZS50YXJnZXQucmVzdWx0O1xuICAgICAgaWYgKCFjb3VudCkge1xuICAgICAgICByZXR1cm4gY2FsbGJhY2soKTsgLy8gZG9uZVxuICAgICAgfVxuXG4gICAgICBzZXFTdG9yZS5vcGVuQ3Vyc29yKCkub25zdWNjZXNzID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgdmFyIGN1cnNvciA9IGUudGFyZ2V0LnJlc3VsdDtcbiAgICAgICAgaWYgKCFjdXJzb3IpIHtcbiAgICAgICAgICByZXR1cm4gY2FsbGJhY2soKTsgLy8gZG9uZVxuICAgICAgICB9XG4gICAgICAgIHZhciBkb2MgPSBjdXJzb3IudmFsdWU7XG4gICAgICAgIHZhciBzZXEgPSBjdXJzb3IucHJpbWFyeUtleTtcbiAgICAgICAgdmFyIGF0dHMgPSBPYmplY3Qua2V5cyhkb2MuX2F0dGFjaG1lbnRzIHx8IHt9KTtcbiAgICAgICAgdmFyIGRpZ2VzdE1hcCA9IHt9O1xuICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IGF0dHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICB2YXIgYXR0ID0gZG9jLl9hdHRhY2htZW50c1thdHRzW2pdXTtcbiAgICAgICAgICBkaWdlc3RNYXBbYXR0LmRpZ2VzdF0gPSB0cnVlOyAvLyB1bmlxIGRpZ2VzdHMsIGp1c3QgaW4gY2FzZVxuICAgICAgICB9XG4gICAgICAgIHZhciBkaWdlc3RzID0gT2JqZWN0LmtleXMoZGlnZXN0TWFwKTtcbiAgICAgICAgZm9yIChqID0gMDsgaiA8IGRpZ2VzdHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICB2YXIgZGlnZXN0ID0gZGlnZXN0c1tqXTtcbiAgICAgICAgICBhdHRBbmRTZXFTdG9yZS5wdXQoe1xuICAgICAgICAgICAgc2VxOiBzZXEsXG4gICAgICAgICAgICBkaWdlc3RTZXE6IGRpZ2VzdCArICc6OicgKyBzZXFcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBjdXJzb3IuY29udGludWUoKTtcbiAgICAgIH07XG4gICAgfTtcbiAgfVxuXG4gIC8vIG1pZ3JhdGlvbiB0byB2ZXJzaW9uIDVcbiAgLy8gSW5zdGVhZCBvZiByZWx5aW5nIG9uIG9uLXRoZS1mbHkgbWlncmF0aW9uIG9mIG1ldGFkYXRhLFxuICAvLyB0aGlzIGJyaW5ncyB0aGUgZG9jLXN0b3JlIHRvIGl0cyBtb2Rlcm4gZm9ybTpcbiAgLy8gLSBtZXRhZGF0YS53aW5uaW5ncmV2XG4gIC8vIC0gbWV0YWRhdGEuc2VxXG4gIC8vIC0gc3RyaW5naWZ5IHRoZSBtZXRhZGF0YSB3aGVuIHN0b3JpbmcgaXRcbiAgZnVuY3Rpb24gbWlncmF0ZU1ldGFkYXRhKHR4bikge1xuXG4gICAgZnVuY3Rpb24gZGVjb2RlTWV0YWRhdGFDb21wYXQoc3RvcmVkT2JqZWN0KSB7XG4gICAgICBpZiAoIXN0b3JlZE9iamVjdC5kYXRhKSB7XG4gICAgICAgIC8vIG9sZCBmb3JtYXQsIHdoZW4gd2UgZGlkbid0IHN0b3JlIGl0IHN0cmluZ2lmaWVkXG4gICAgICAgIHN0b3JlZE9iamVjdC5kZWxldGVkID0gc3RvcmVkT2JqZWN0LmRlbGV0ZWRPckxvY2FsID09PSAnMSc7XG4gICAgICAgIHJldHVybiBzdG9yZWRPYmplY3Q7XG4gICAgICB9XG4gICAgICByZXR1cm4gZGVjb2RlTWV0YWRhdGEoc3RvcmVkT2JqZWN0KTtcbiAgICB9XG5cbiAgICAvLyBlbnN1cmUgdGhhdCBldmVyeSBtZXRhZGF0YSBoYXMgYSB3aW5uaW5nUmV2IGFuZCBzZXEsXG4gICAgLy8gd2hpY2ggd2FzIHByZXZpb3VzbHkgY3JlYXRlZCBvbi10aGUtZmx5IGJ1dCBiZXR0ZXIgdG8gbWlncmF0ZVxuICAgIHZhciBieVNlcVN0b3JlID0gdHhuLm9iamVjdFN0b3JlKEJZX1NFUV9TVE9SRSk7XG4gICAgdmFyIGRvY1N0b3JlID0gdHhuLm9iamVjdFN0b3JlKERPQ19TVE9SRSk7XG4gICAgdmFyIGN1cnNvciA9IGRvY1N0b3JlLm9wZW5DdXJzb3IoKTtcbiAgICBjdXJzb3Iub25zdWNjZXNzID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgIHZhciBjdXJzb3IgPSBlLnRhcmdldC5yZXN1bHQ7XG4gICAgICBpZiAoIWN1cnNvcikge1xuICAgICAgICByZXR1cm47IC8vIGRvbmVcbiAgICAgIH1cbiAgICAgIHZhciBtZXRhZGF0YSA9IGRlY29kZU1ldGFkYXRhQ29tcGF0KGN1cnNvci52YWx1ZSk7XG5cbiAgICAgIG1ldGFkYXRhLndpbm5pbmdSZXYgPSBtZXRhZGF0YS53aW5uaW5nUmV2IHx8XG4gICAgICAgIGNhbGN1bGF0ZVdpbm5pbmdSZXYobWV0YWRhdGEpO1xuXG4gICAgICBmdW5jdGlvbiBmZXRjaE1ldGFkYXRhU2VxKCkge1xuICAgICAgICAvLyBtZXRhZGF0YS5zZXEgd2FzIGFkZGVkIHBvc3QtMy4yLjAsIHNvIGlmIGl0J3MgbWlzc2luZyxcbiAgICAgICAgLy8gd2UgbmVlZCB0byBmZXRjaCBpdCBtYW51YWxseVxuICAgICAgICB2YXIgc3RhcnQgPSBtZXRhZGF0YS5pZCArICc6Oic7XG4gICAgICAgIHZhciBlbmQgPSBtZXRhZGF0YS5pZCArICc6OlxcdWZmZmYnO1xuICAgICAgICB2YXIgcmVxID0gYnlTZXFTdG9yZS5pbmRleCgnX2RvY19pZF9yZXYnKS5vcGVuQ3Vyc29yKFxuICAgICAgICAgIElEQktleVJhbmdlLmJvdW5kKHN0YXJ0LCBlbmQpKTtcblxuICAgICAgICB2YXIgbWV0YWRhdGFTZXEgPSAwO1xuICAgICAgICByZXEub25zdWNjZXNzID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICB2YXIgY3Vyc29yID0gZS50YXJnZXQucmVzdWx0O1xuICAgICAgICAgIGlmICghY3Vyc29yKSB7XG4gICAgICAgICAgICBtZXRhZGF0YS5zZXEgPSBtZXRhZGF0YVNlcTtcbiAgICAgICAgICAgIHJldHVybiBvbkdldE1ldGFkYXRhU2VxKCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHZhciBzZXEgPSBjdXJzb3IucHJpbWFyeUtleTtcbiAgICAgICAgICBpZiAoc2VxID4gbWV0YWRhdGFTZXEpIHtcbiAgICAgICAgICAgIG1ldGFkYXRhU2VxID0gc2VxO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjdXJzb3IuY29udGludWUoKTtcbiAgICAgICAgfTtcbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gb25HZXRNZXRhZGF0YVNlcSgpIHtcbiAgICAgICAgdmFyIG1ldGFkYXRhVG9TdG9yZSA9IGVuY29kZU1ldGFkYXRhKG1ldGFkYXRhLFxuICAgICAgICAgIG1ldGFkYXRhLndpbm5pbmdSZXYsIG1ldGFkYXRhLmRlbGV0ZWQpO1xuXG4gICAgICAgIHZhciByZXEgPSBkb2NTdG9yZS5wdXQobWV0YWRhdGFUb1N0b3JlKTtcbiAgICAgICAgcmVxLm9uc3VjY2VzcyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICBjdXJzb3IuY29udGludWUoKTtcbiAgICAgICAgfTtcbiAgICAgIH1cblxuICAgICAgaWYgKG1ldGFkYXRhLnNlcSkge1xuICAgICAgICByZXR1cm4gb25HZXRNZXRhZGF0YVNlcSgpO1xuICAgICAgfVxuXG4gICAgICBmZXRjaE1ldGFkYXRhU2VxKCk7XG4gICAgfTtcblxuICB9XG5cbiAgYXBpLl9yZW1vdGUgPSBmYWxzZTtcbiAgYXBpLnR5cGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuICdpZGInO1xuICB9O1xuXG4gIGFwaS5faWQgPSB0b1Byb21pc2UoZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgY2FsbGJhY2sobnVsbCwgYXBpLl9tZXRhLmluc3RhbmNlSWQpO1xuICB9KTtcblxuICBhcGkuX2J1bGtEb2NzID0gZnVuY3Rpb24gaWRiX2J1bGtEb2NzKHJlcSwgcmVxT3B0cywgY2FsbGJhY2spIHtcbiAgICBpZGJCdWxrRG9jcyhvcHRzLCByZXEsIHJlcU9wdHMsIGFwaSwgaWRiLCBlbnJpY2hDYWxsYmFja0Vycm9yKGNhbGxiYWNrKSk7XG4gIH07XG5cbiAgLy8gRmlyc3Qgd2UgbG9vayB1cCB0aGUgbWV0YWRhdGEgaW4gdGhlIGlkcyBkYXRhYmFzZSwgdGhlbiB3ZSBmZXRjaCB0aGVcbiAgLy8gY3VycmVudCByZXZpc2lvbihzKSBmcm9tIHRoZSBieSBzZXF1ZW5jZSBzdG9yZVxuICBhcGkuX2dldCA9IGZ1bmN0aW9uIGlkYl9nZXQoaWQsIG9wdHMsIGNhbGxiYWNrKSB7XG4gICAgdmFyIGRvYztcbiAgICB2YXIgbWV0YWRhdGE7XG4gICAgdmFyIGVycjtcbiAgICB2YXIgdHhuID0gb3B0cy5jdHg7XG4gICAgaWYgKCF0eG4pIHtcbiAgICAgIHZhciB0eG5SZXN1bHQgPSBvcGVuVHJhbnNhY3Rpb25TYWZlbHkoaWRiLFxuICAgICAgICBbRE9DX1NUT1JFLCBCWV9TRVFfU1RPUkUsIEFUVEFDSF9TVE9SRV0sICdyZWFkb25seScpO1xuICAgICAgaWYgKHR4blJlc3VsdC5lcnJvcikge1xuICAgICAgICByZXR1cm4gY2FsbGJhY2sodHhuUmVzdWx0LmVycm9yKTtcbiAgICAgIH1cbiAgICAgIHR4biA9IHR4blJlc3VsdC50eG47XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZmluaXNoKCkge1xuICAgICAgY2FsbGJhY2soZXJyLCB7ZG9jOiBkb2MsIG1ldGFkYXRhOiBtZXRhZGF0YSwgY3R4OiB0eG59KTtcbiAgICB9XG5cbiAgICB0eG4ub2JqZWN0U3RvcmUoRE9DX1NUT1JFKS5nZXQoaWQpLm9uc3VjY2VzcyA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICBtZXRhZGF0YSA9IGRlY29kZU1ldGFkYXRhKGUudGFyZ2V0LnJlc3VsdCk7XG4gICAgICAvLyB3ZSBjYW4gZGV0ZXJtaW5lIHRoZSByZXN1bHQgaGVyZSBpZjpcbiAgICAgIC8vIDEuIHRoZXJlIGlzIG5vIHN1Y2ggZG9jdW1lbnRcbiAgICAgIC8vIDIuIHRoZSBkb2N1bWVudCBpcyBkZWxldGVkIGFuZCB3ZSBkb24ndCBhc2sgYWJvdXQgc3BlY2lmaWMgcmV2XG4gICAgICAvLyBXaGVuIHdlIGFzayB3aXRoIG9wdHMucmV2IHdlIGV4cGVjdCB0aGUgYW5zd2VyIHRvIGJlIGVpdGhlclxuICAgICAgLy8gZG9jIChwb3NzaWJseSB3aXRoIF9kZWxldGVkPXRydWUpIG9yIG1pc3NpbmcgZXJyb3JcbiAgICAgIGlmICghbWV0YWRhdGEpIHtcbiAgICAgICAgZXJyID0gY3JlYXRlRXJyb3IoTUlTU0lOR19ET0MsICdtaXNzaW5nJyk7XG4gICAgICAgIHJldHVybiBmaW5pc2goKTtcbiAgICAgIH1cblxuICAgICAgdmFyIHJldjtcbiAgICAgIGlmICghb3B0cy5yZXYpIHtcbiAgICAgICAgcmV2ID0gbWV0YWRhdGEud2lubmluZ1JldjtcbiAgICAgICAgdmFyIGRlbGV0ZWQgPSBpc0RlbGV0ZWQobWV0YWRhdGEpO1xuICAgICAgICBpZiAoZGVsZXRlZCkge1xuICAgICAgICAgIGVyciA9IGNyZWF0ZUVycm9yKE1JU1NJTkdfRE9DLCBcImRlbGV0ZWRcIik7XG4gICAgICAgICAgcmV0dXJuIGZpbmlzaCgpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXYgPSBvcHRzLmxhdGVzdCA/IGdldExhdGVzdChvcHRzLnJldiwgbWV0YWRhdGEpIDogb3B0cy5yZXY7XG4gICAgICB9XG5cbiAgICAgIHZhciBvYmplY3RTdG9yZSA9IHR4bi5vYmplY3RTdG9yZShCWV9TRVFfU1RPUkUpO1xuICAgICAgdmFyIGtleSA9IG1ldGFkYXRhLmlkICsgJzo6JyArIHJldjtcblxuICAgICAgb2JqZWN0U3RvcmUuaW5kZXgoJ19kb2NfaWRfcmV2JykuZ2V0KGtleSkub25zdWNjZXNzID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgZG9jID0gZS50YXJnZXQucmVzdWx0O1xuICAgICAgICBpZiAoZG9jKSB7XG4gICAgICAgICAgZG9jID0gZGVjb2RlRG9jKGRvYyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFkb2MpIHtcbiAgICAgICAgICBlcnIgPSBjcmVhdGVFcnJvcihNSVNTSU5HX0RPQywgJ21pc3NpbmcnKTtcbiAgICAgICAgICByZXR1cm4gZmluaXNoKCk7XG4gICAgICAgIH1cbiAgICAgICAgZmluaXNoKCk7XG4gICAgICB9O1xuICAgIH07XG4gIH07XG5cbiAgYXBpLl9nZXRBdHRhY2htZW50ID0gZnVuY3Rpb24gKGRvY0lkLCBhdHRhY2hJZCwgYXR0YWNobWVudCwgb3B0cywgY2FsbGJhY2spIHtcbiAgICB2YXIgdHhuO1xuICAgIGlmIChvcHRzLmN0eCkge1xuICAgICAgdHhuID0gb3B0cy5jdHg7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciB0eG5SZXN1bHQgPSBvcGVuVHJhbnNhY3Rpb25TYWZlbHkoaWRiLFxuICAgICAgICBbRE9DX1NUT1JFLCBCWV9TRVFfU1RPUkUsIEFUVEFDSF9TVE9SRV0sICdyZWFkb25seScpO1xuICAgICAgaWYgKHR4blJlc3VsdC5lcnJvcikge1xuICAgICAgICByZXR1cm4gY2FsbGJhY2sodHhuUmVzdWx0LmVycm9yKTtcbiAgICAgIH1cbiAgICAgIHR4biA9IHR4blJlc3VsdC50eG47XG4gICAgfVxuICAgIHZhciBkaWdlc3QgPSBhdHRhY2htZW50LmRpZ2VzdDtcbiAgICB2YXIgdHlwZSA9IGF0dGFjaG1lbnQuY29udGVudF90eXBlO1xuXG4gICAgdHhuLm9iamVjdFN0b3JlKEFUVEFDSF9TVE9SRSkuZ2V0KGRpZ2VzdCkub25zdWNjZXNzID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgIHZhciBib2R5ID0gZS50YXJnZXQucmVzdWx0LmJvZHk7XG4gICAgICByZWFkQmxvYkRhdGEoYm9keSwgdHlwZSwgb3B0cy5iaW5hcnksIGZ1bmN0aW9uIChibG9iRGF0YSkge1xuICAgICAgICBjYWxsYmFjayhudWxsLCBibG9iRGF0YSk7XG4gICAgICB9KTtcbiAgICB9O1xuICB9O1xuXG4gIGFwaS5faW5mbyA9IGZ1bmN0aW9uIGlkYl9pbmZvKGNhbGxiYWNrKSB7XG4gICAgdmFyIHVwZGF0ZVNlcTtcbiAgICB2YXIgZG9jQ291bnQ7XG5cbiAgICB2YXIgdHhuUmVzdWx0ID0gb3BlblRyYW5zYWN0aW9uU2FmZWx5KGlkYiwgW01FVEFfU1RPUkUsIEJZX1NFUV9TVE9SRV0sICdyZWFkb25seScpO1xuICAgIGlmICh0eG5SZXN1bHQuZXJyb3IpIHtcbiAgICAgIHJldHVybiBjYWxsYmFjayh0eG5SZXN1bHQuZXJyb3IpO1xuICAgIH1cbiAgICB2YXIgdHhuID0gdHhuUmVzdWx0LnR4bjtcbiAgICB0eG4ub2JqZWN0U3RvcmUoTUVUQV9TVE9SRSkuZ2V0KE1FVEFfU1RPUkUpLm9uc3VjY2VzcyA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICBkb2NDb3VudCA9IGUudGFyZ2V0LnJlc3VsdC5kb2NDb3VudDtcbiAgICB9O1xuICAgIHR4bi5vYmplY3RTdG9yZShCWV9TRVFfU1RPUkUpLm9wZW5DdXJzb3IobnVsbCwgJ3ByZXYnKS5vbnN1Y2Nlc3MgPSBmdW5jdGlvbiAoZSkge1xuICAgICAgdmFyIGN1cnNvciA9IGUudGFyZ2V0LnJlc3VsdDtcbiAgICAgIHVwZGF0ZVNlcSA9IGN1cnNvciA/IGN1cnNvci5rZXkgOiAwO1xuICAgIH07XG5cbiAgICB0eG4ub25jb21wbGV0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIGNhbGxiYWNrKG51bGwsIHtcbiAgICAgICAgZG9jX2NvdW50OiBkb2NDb3VudCxcbiAgICAgICAgdXBkYXRlX3NlcTogdXBkYXRlU2VxLFxuICAgICAgICAvLyBmb3IgZGVidWdnaW5nXG4gICAgICAgIGlkYl9hdHRhY2htZW50X2Zvcm1hdDogKGFwaS5fbWV0YS5ibG9iU3VwcG9ydCA/ICdiaW5hcnknIDogJ2Jhc2U2NCcpXG4gICAgICB9KTtcbiAgICB9O1xuICB9O1xuXG4gIGFwaS5fYWxsRG9jcyA9IGZ1bmN0aW9uIGlkYl9hbGxEb2NzKG9wdHMsIGNhbGxiYWNrKSB7XG4gICAgaWRiQWxsRG9jcyhvcHRzLCBpZGIsIGVucmljaENhbGxiYWNrRXJyb3IoY2FsbGJhY2spKTtcbiAgfTtcblxuICBhcGkuX2NoYW5nZXMgPSBmdW5jdGlvbiBpZGJDaGFuZ2VzKG9wdHMpIHtcbiAgICByZXR1cm4gY2hhbmdlcyhvcHRzLCBhcGksIGRiTmFtZSwgaWRiKTtcbiAgfTtcblxuICBhcGkuX2Nsb3NlID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgLy8gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9JbmRleGVkREIvSURCRGF0YWJhc2UjY2xvc2VcbiAgICAvLyBcIlJldHVybnMgaW1tZWRpYXRlbHkgYW5kIGNsb3NlcyB0aGUgY29ubmVjdGlvbiBpbiBhIHNlcGFyYXRlIHRocmVhZC4uLlwiXG4gICAgaWRiLmNsb3NlKCk7XG4gICAgY2FjaGVkREJzLmRlbGV0ZShkYk5hbWUpO1xuICAgIGNhbGxiYWNrKCk7XG4gIH07XG5cbiAgYXBpLl9nZXRSZXZpc2lvblRyZWUgPSBmdW5jdGlvbiAoZG9jSWQsIGNhbGxiYWNrKSB7XG4gICAgdmFyIHR4blJlc3VsdCA9IG9wZW5UcmFuc2FjdGlvblNhZmVseShpZGIsIFtET0NfU1RPUkVdLCAncmVhZG9ubHknKTtcbiAgICBpZiAodHhuUmVzdWx0LmVycm9yKSB7XG4gICAgICByZXR1cm4gY2FsbGJhY2sodHhuUmVzdWx0LmVycm9yKTtcbiAgICB9XG4gICAgdmFyIHR4biA9IHR4blJlc3VsdC50eG47XG4gICAgdmFyIHJlcSA9IHR4bi5vYmplY3RTdG9yZShET0NfU1RPUkUpLmdldChkb2NJZCk7XG4gICAgcmVxLm9uc3VjY2VzcyA9IGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgdmFyIGRvYyA9IGRlY29kZU1ldGFkYXRhKGV2ZW50LnRhcmdldC5yZXN1bHQpO1xuICAgICAgaWYgKCFkb2MpIHtcbiAgICAgICAgY2FsbGJhY2soY3JlYXRlRXJyb3IoTUlTU0lOR19ET0MpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIGRvYy5yZXZfdHJlZSk7XG4gICAgICB9XG4gICAgfTtcbiAgfTtcblxuICAvLyBUaGlzIGZ1bmN0aW9uIHJlbW92ZXMgcmV2aXNpb25zIG9mIGRvY3VtZW50IGRvY0lkXG4gIC8vIHdoaWNoIGFyZSBsaXN0ZWQgaW4gcmV2cyBhbmQgc2V0cyB0aGlzIGRvY3VtZW50XG4gIC8vIHJldmlzaW9uIHRvIHRvIHJldl90cmVlXG4gIGFwaS5fZG9Db21wYWN0aW9uID0gZnVuY3Rpb24gKGRvY0lkLCByZXZzLCBjYWxsYmFjaykge1xuICAgIHZhciBzdG9yZXMgPSBbXG4gICAgICBET0NfU1RPUkUsXG4gICAgICBCWV9TRVFfU1RPUkUsXG4gICAgICBBVFRBQ0hfU1RPUkUsXG4gICAgICBBVFRBQ0hfQU5EX1NFUV9TVE9SRVxuICAgIF07XG4gICAgdmFyIHR4blJlc3VsdCA9IG9wZW5UcmFuc2FjdGlvblNhZmVseShpZGIsIHN0b3JlcywgJ3JlYWR3cml0ZScpO1xuICAgIGlmICh0eG5SZXN1bHQuZXJyb3IpIHtcbiAgICAgIHJldHVybiBjYWxsYmFjayh0eG5SZXN1bHQuZXJyb3IpO1xuICAgIH1cbiAgICB2YXIgdHhuID0gdHhuUmVzdWx0LnR4bjtcblxuICAgIHZhciBkb2NTdG9yZSA9IHR4bi5vYmplY3RTdG9yZShET0NfU1RPUkUpO1xuXG4gICAgZG9jU3RvcmUuZ2V0KGRvY0lkKS5vbnN1Y2Nlc3MgPSBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICAgIHZhciBtZXRhZGF0YSA9IGRlY29kZU1ldGFkYXRhKGV2ZW50LnRhcmdldC5yZXN1bHQpO1xuICAgICAgdHJhdmVyc2VSZXZUcmVlKG1ldGFkYXRhLnJldl90cmVlLCBmdW5jdGlvbiAoaXNMZWFmLCBwb3MsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXZIYXNoLCBjdHgsIG9wdHMpIHtcbiAgICAgICAgdmFyIHJldiA9IHBvcyArICctJyArIHJldkhhc2g7XG4gICAgICAgIGlmIChyZXZzLmluZGV4T2YocmV2KSAhPT0gLTEpIHtcbiAgICAgICAgICBvcHRzLnN0YXR1cyA9ICdtaXNzaW5nJztcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBjb21wYWN0UmV2cyhyZXZzLCBkb2NJZCwgdHhuKTtcbiAgICAgIHZhciB3aW5uaW5nUmV2ID0gbWV0YWRhdGEud2lubmluZ1JldjtcbiAgICAgIHZhciBkZWxldGVkID0gbWV0YWRhdGEuZGVsZXRlZDtcbiAgICAgIHR4bi5vYmplY3RTdG9yZShET0NfU1RPUkUpLnB1dChcbiAgICAgICAgZW5jb2RlTWV0YWRhdGEobWV0YWRhdGEsIHdpbm5pbmdSZXYsIGRlbGV0ZWQpKTtcbiAgICB9O1xuICAgIHR4bi5vbmFib3J0ID0gaWRiRXJyb3IoY2FsbGJhY2spO1xuICAgIHR4bi5vbmNvbXBsZXRlID0gZnVuY3Rpb24gKCkge1xuICAgICAgY2FsbGJhY2soKTtcbiAgICB9O1xuICB9O1xuXG5cbiAgYXBpLl9nZXRMb2NhbCA9IGZ1bmN0aW9uIChpZCwgY2FsbGJhY2spIHtcbiAgICB2YXIgdHhuUmVzdWx0ID0gb3BlblRyYW5zYWN0aW9uU2FmZWx5KGlkYiwgW0xPQ0FMX1NUT1JFXSwgJ3JlYWRvbmx5Jyk7XG4gICAgaWYgKHR4blJlc3VsdC5lcnJvcikge1xuICAgICAgcmV0dXJuIGNhbGxiYWNrKHR4blJlc3VsdC5lcnJvcik7XG4gICAgfVxuICAgIHZhciB0eCA9IHR4blJlc3VsdC50eG47XG4gICAgdmFyIHJlcSA9IHR4Lm9iamVjdFN0b3JlKExPQ0FMX1NUT1JFKS5nZXQoaWQpO1xuXG4gICAgcmVxLm9uZXJyb3IgPSBpZGJFcnJvcihjYWxsYmFjayk7XG4gICAgcmVxLm9uc3VjY2VzcyA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICB2YXIgZG9jID0gZS50YXJnZXQucmVzdWx0O1xuICAgICAgaWYgKCFkb2MpIHtcbiAgICAgICAgY2FsbGJhY2soY3JlYXRlRXJyb3IoTUlTU0lOR19ET0MpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRlbGV0ZSBkb2NbJ19kb2NfaWRfcmV2J107IC8vIGZvciBiYWNrd2FyZHMgY29tcGF0XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIGRvYyk7XG4gICAgICB9XG4gICAgfTtcbiAgfTtcblxuICBhcGkuX3B1dExvY2FsID0gZnVuY3Rpb24gKGRvYywgb3B0cywgY2FsbGJhY2spIHtcbiAgICBpZiAodHlwZW9mIG9wdHMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNhbGxiYWNrID0gb3B0cztcbiAgICAgIG9wdHMgPSB7fTtcbiAgICB9XG4gICAgZGVsZXRlIGRvYy5fcmV2aXNpb25zOyAvLyBpZ25vcmUgdGhpcywgdHJ1c3QgdGhlIHJldlxuICAgIHZhciBvbGRSZXYgPSBkb2MuX3JldjtcbiAgICB2YXIgaWQgPSBkb2MuX2lkO1xuICAgIGlmICghb2xkUmV2KSB7XG4gICAgICBkb2MuX3JldiA9ICcwLTEnO1xuICAgIH0gZWxzZSB7XG4gICAgICBkb2MuX3JldiA9ICcwLScgKyAocGFyc2VJbnQob2xkUmV2LnNwbGl0KCctJylbMV0sIDEwKSArIDEpO1xuICAgIH1cblxuICAgIHZhciB0eCA9IG9wdHMuY3R4O1xuICAgIHZhciByZXQ7XG4gICAgaWYgKCF0eCkge1xuICAgICAgdmFyIHR4blJlc3VsdCA9IG9wZW5UcmFuc2FjdGlvblNhZmVseShpZGIsIFtMT0NBTF9TVE9SRV0sICdyZWFkd3JpdGUnKTtcbiAgICAgIGlmICh0eG5SZXN1bHQuZXJyb3IpIHtcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKHR4blJlc3VsdC5lcnJvcik7XG4gICAgICB9XG4gICAgICB0eCA9IHR4blJlc3VsdC50eG47XG4gICAgICB0eC5vbmVycm9yID0gaWRiRXJyb3IoY2FsbGJhY2spO1xuICAgICAgdHgub25jb21wbGV0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKHJldCkge1xuICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHJldCk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfVxuXG4gICAgdmFyIG9TdG9yZSA9IHR4Lm9iamVjdFN0b3JlKExPQ0FMX1NUT1JFKTtcbiAgICB2YXIgcmVxO1xuICAgIGlmIChvbGRSZXYpIHtcbiAgICAgIHJlcSA9IG9TdG9yZS5nZXQoaWQpO1xuICAgICAgcmVxLm9uc3VjY2VzcyA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICAgIHZhciBvbGREb2MgPSBlLnRhcmdldC5yZXN1bHQ7XG4gICAgICAgIGlmICghb2xkRG9jIHx8IG9sZERvYy5fcmV2ICE9PSBvbGRSZXYpIHtcbiAgICAgICAgICBjYWxsYmFjayhjcmVhdGVFcnJvcihSRVZfQ09ORkxJQ1QpKTtcbiAgICAgICAgfSBlbHNlIHsgLy8gdXBkYXRlXG4gICAgICAgICAgdmFyIHJlcSA9IG9TdG9yZS5wdXQoZG9jKTtcbiAgICAgICAgICByZXEub25zdWNjZXNzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0ID0ge29rOiB0cnVlLCBpZDogZG9jLl9pZCwgcmV2OiBkb2MuX3Jldn07XG4gICAgICAgICAgICBpZiAob3B0cy5jdHgpIHsgLy8gcmV0dXJuIGltbWVkaWF0ZWx5XG4gICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHJldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9IGVsc2UgeyAvLyBuZXcgZG9jXG4gICAgICByZXEgPSBvU3RvcmUuYWRkKGRvYyk7XG4gICAgICByZXEub25lcnJvciA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICAgIC8vIGNvbnN0cmFpbnQgZXJyb3IsIGFscmVhZHkgZXhpc3RzXG4gICAgICAgIGNhbGxiYWNrKGNyZWF0ZUVycm9yKFJFVl9DT05GTElDVCkpO1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7IC8vIGF2b2lkIHRyYW5zYWN0aW9uIGFib3J0XG4gICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7IC8vIGF2b2lkIHRyYW5zYWN0aW9uIG9uZXJyb3JcbiAgICAgIH07XG4gICAgICByZXEub25zdWNjZXNzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXQgPSB7b2s6IHRydWUsIGlkOiBkb2MuX2lkLCByZXY6IGRvYy5fcmV2fTtcbiAgICAgICAgaWYgKG9wdHMuY3R4KSB7IC8vIHJldHVybiBpbW1lZGlhdGVseVxuICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHJldCk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfVxuICB9O1xuXG4gIGFwaS5fcmVtb3ZlTG9jYWwgPSBmdW5jdGlvbiAoZG9jLCBvcHRzLCBjYWxsYmFjaykge1xuICAgIGlmICh0eXBlb2Ygb3B0cyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY2FsbGJhY2sgPSBvcHRzO1xuICAgICAgb3B0cyA9IHt9O1xuICAgIH1cbiAgICB2YXIgdHggPSBvcHRzLmN0eDtcbiAgICBpZiAoIXR4KSB7XG4gICAgICB2YXIgdHhuUmVzdWx0ID0gb3BlblRyYW5zYWN0aW9uU2FmZWx5KGlkYiwgW0xPQ0FMX1NUT1JFXSwgJ3JlYWR3cml0ZScpO1xuICAgICAgaWYgKHR4blJlc3VsdC5lcnJvcikge1xuICAgICAgICByZXR1cm4gY2FsbGJhY2sodHhuUmVzdWx0LmVycm9yKTtcbiAgICAgIH1cbiAgICAgIHR4ID0gdHhuUmVzdWx0LnR4bjtcbiAgICAgIHR4Lm9uY29tcGxldGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmIChyZXQpIHtcbiAgICAgICAgICBjYWxsYmFjayhudWxsLCByZXQpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH1cbiAgICB2YXIgcmV0O1xuICAgIHZhciBpZCA9IGRvYy5faWQ7XG4gICAgdmFyIG9TdG9yZSA9IHR4Lm9iamVjdFN0b3JlKExPQ0FMX1NUT1JFKTtcbiAgICB2YXIgcmVxID0gb1N0b3JlLmdldChpZCk7XG5cbiAgICByZXEub25lcnJvciA9IGlkYkVycm9yKGNhbGxiYWNrKTtcbiAgICByZXEub25zdWNjZXNzID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgIHZhciBvbGREb2MgPSBlLnRhcmdldC5yZXN1bHQ7XG4gICAgICBpZiAoIW9sZERvYyB8fCBvbGREb2MuX3JldiAhPT0gZG9jLl9yZXYpIHtcbiAgICAgICAgY2FsbGJhY2soY3JlYXRlRXJyb3IoTUlTU0lOR19ET0MpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9TdG9yZS5kZWxldGUoaWQpO1xuICAgICAgICByZXQgPSB7b2s6IHRydWUsIGlkOiBpZCwgcmV2OiAnMC0wJ307XG4gICAgICAgIGlmIChvcHRzLmN0eCkgeyAvLyByZXR1cm4gaW1tZWRpYXRlbHlcbiAgICAgICAgICBjYWxsYmFjayhudWxsLCByZXQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcbiAgfTtcblxuICBhcGkuX2Rlc3Ryb3kgPSBmdW5jdGlvbiAob3B0cywgY2FsbGJhY2spIHtcbiAgICBjaGFuZ2VzSGFuZGxlci5yZW1vdmVBbGxMaXN0ZW5lcnMoZGJOYW1lKTtcblxuICAgIC8vQ2xvc2Ugb3BlbiByZXF1ZXN0IGZvciBcImRiTmFtZVwiIGRhdGFiYXNlIHRvIGZpeCBpZSBkZWxheS5cbiAgICB2YXIgb3BlblJlcSA9IG9wZW5SZXFMaXN0LmdldChkYk5hbWUpO1xuICAgIGlmIChvcGVuUmVxICYmIG9wZW5SZXEucmVzdWx0KSB7XG4gICAgICBvcGVuUmVxLnJlc3VsdC5jbG9zZSgpO1xuICAgICAgY2FjaGVkREJzLmRlbGV0ZShkYk5hbWUpO1xuICAgIH1cbiAgICB2YXIgcmVxID0gaW5kZXhlZERCLmRlbGV0ZURhdGFiYXNlKGRiTmFtZSk7XG5cbiAgICByZXEub25zdWNjZXNzID0gZnVuY3Rpb24gKCkge1xuICAgICAgLy9SZW1vdmUgb3BlbiByZXF1ZXN0IGZyb20gdGhlIGxpc3QuXG4gICAgICBvcGVuUmVxTGlzdC5kZWxldGUoZGJOYW1lKTtcbiAgICAgIGlmIChoYXNMb2NhbFN0b3JhZ2UoKSAmJiAoZGJOYW1lIGluIGxvY2FsU3RvcmFnZSkpIHtcbiAgICAgICAgZGVsZXRlIGxvY2FsU3RvcmFnZVtkYk5hbWVdO1xuICAgICAgfVxuICAgICAgY2FsbGJhY2sobnVsbCwgeyAnb2snOiB0cnVlIH0pO1xuICAgIH07XG5cbiAgICByZXEub25lcnJvciA9IGlkYkVycm9yKGNhbGxiYWNrKTtcbiAgfTtcblxuICB2YXIgY2FjaGVkID0gY2FjaGVkREJzLmdldChkYk5hbWUpO1xuXG4gIGlmIChjYWNoZWQpIHtcbiAgICBpZGIgPSBjYWNoZWQuaWRiO1xuICAgIGFwaS5fbWV0YSA9IGNhY2hlZC5nbG9iYWw7XG4gICAgcmV0dXJuIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgIGNhbGxiYWNrKG51bGwsIGFwaSk7XG4gICAgfSk7XG4gIH1cblxuICB2YXIgcmVxID0gaW5kZXhlZERCLm9wZW4oZGJOYW1lLCBBREFQVEVSX1ZFUlNJT04pO1xuICBvcGVuUmVxTGlzdC5zZXQoZGJOYW1lLCByZXEpO1xuXG4gIHJlcS5vbnVwZ3JhZGVuZWVkZWQgPSBmdW5jdGlvbiAoZSkge1xuICAgIHZhciBkYiA9IGUudGFyZ2V0LnJlc3VsdDtcbiAgICBpZiAoZS5vbGRWZXJzaW9uIDwgMSkge1xuICAgICAgcmV0dXJuIGNyZWF0ZVNjaGVtYShkYik7IC8vIG5ldyBkYiwgaW5pdGlhbCBzY2hlbWFcbiAgICB9XG4gICAgLy8gZG8gbWlncmF0aW9uc1xuXG4gICAgdmFyIHR4biA9IGUuY3VycmVudFRhcmdldC50cmFuc2FjdGlvbjtcbiAgICAvLyB0aGVzZSBtaWdyYXRpb25zIGhhdmUgdG8gYmUgZG9uZSBpbiB0aGlzIGZ1bmN0aW9uLCBiZWZvcmVcbiAgICAvLyBjb250cm9sIGlzIHJldHVybmVkIHRvIHRoZSBldmVudCBsb29wLCBiZWNhdXNlIEluZGV4ZWREQlxuXG4gICAgaWYgKGUub2xkVmVyc2lvbiA8IDMpIHtcbiAgICAgIGNyZWF0ZUxvY2FsU3RvcmVTY2hlbWEoZGIpOyAvLyB2MiAtPiB2M1xuICAgIH1cbiAgICBpZiAoZS5vbGRWZXJzaW9uIDwgNCkge1xuICAgICAgYWRkQXR0YWNoQW5kU2VxU3RvcmUoZGIpOyAvLyB2MyAtPiB2NFxuICAgIH1cblxuICAgIHZhciBtaWdyYXRpb25zID0gW1xuICAgICAgYWRkRGVsZXRlZE9yTG9jYWxJbmRleCwgLy8gdjEgLT4gdjJcbiAgICAgIG1pZ3JhdGVMb2NhbFN0b3JlLCAgICAgIC8vIHYyIC0+IHYzXG4gICAgICBtaWdyYXRlQXR0c0FuZFNlcXMsICAgICAvLyB2MyAtPiB2NFxuICAgICAgbWlncmF0ZU1ldGFkYXRhICAgICAgICAgLy8gdjQgLT4gdjVcbiAgICBdO1xuXG4gICAgdmFyIGkgPSBlLm9sZFZlcnNpb247XG5cbiAgICBmdW5jdGlvbiBuZXh0KCkge1xuICAgICAgdmFyIG1pZ3JhdGlvbiA9IG1pZ3JhdGlvbnNbaSAtIDFdO1xuICAgICAgaSsrO1xuICAgICAgaWYgKG1pZ3JhdGlvbikge1xuICAgICAgICBtaWdyYXRpb24odHhuLCBuZXh0KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBuZXh0KCk7XG4gIH07XG5cbiAgcmVxLm9uc3VjY2VzcyA9IGZ1bmN0aW9uIChlKSB7XG5cbiAgICBpZGIgPSBlLnRhcmdldC5yZXN1bHQ7XG5cbiAgICBpZGIub252ZXJzaW9uY2hhbmdlID0gZnVuY3Rpb24gKCkge1xuICAgICAgaWRiLmNsb3NlKCk7XG4gICAgICBjYWNoZWREQnMuZGVsZXRlKGRiTmFtZSk7XG4gICAgfTtcblxuICAgIGlkYi5vbmFib3J0ID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgIGd1YXJkZWRDb25zb2xlKCdlcnJvcicsICdEYXRhYmFzZSBoYXMgYSBnbG9iYWwgZmFpbHVyZScsIGUudGFyZ2V0LmVycm9yKTtcbiAgICAgIGlkYkdsb2JhbEZhaWx1cmVFcnJvciA9IGUudGFyZ2V0LmVycm9yO1xuICAgICAgaWRiLmNsb3NlKCk7XG4gICAgICBjYWNoZWREQnMuZGVsZXRlKGRiTmFtZSk7XG4gICAgfTtcblxuICAgIC8vIERvIGEgZmV3IHNldHVwIG9wZXJhdGlvbnMgKGluIHBhcmFsbGVsIGFzIG11Y2ggYXMgcG9zc2libGUpOlxuICAgIC8vIDEuIEZldGNoIG1ldGEgZG9jXG4gICAgLy8gMi4gQ2hlY2sgYmxvYiBzdXBwb3J0XG4gICAgLy8gMy4gQ2FsY3VsYXRlIGRvY0NvdW50XG4gICAgLy8gNC4gR2VuZXJhdGUgYW4gaW5zdGFuY2VJZCBpZiBuZWNlc3NhcnlcbiAgICAvLyA1LiBTdG9yZSBkb2NDb3VudCBhbmQgaW5zdGFuY2VJZCBvbiBtZXRhIGRvY1xuXG4gICAgdmFyIHR4biA9IGlkYi50cmFuc2FjdGlvbihbXG4gICAgICBNRVRBX1NUT1JFLFxuICAgICAgREVURUNUX0JMT0JfU1VQUE9SVF9TVE9SRSxcbiAgICAgIERPQ19TVE9SRVxuICAgIF0sICdyZWFkd3JpdGUnKTtcblxuICAgIHZhciBzdG9yZWRNZXRhRG9jID0gZmFsc2U7XG4gICAgdmFyIG1ldGFEb2M7XG4gICAgdmFyIGRvY0NvdW50O1xuICAgIHZhciBibG9iU3VwcG9ydDtcbiAgICB2YXIgaW5zdGFuY2VJZDtcblxuICAgIGZ1bmN0aW9uIGNvbXBsZXRlU2V0dXAoKSB7XG4gICAgICBpZiAodHlwZW9mIGJsb2JTdXBwb3J0ID09PSAndW5kZWZpbmVkJyB8fCAhc3RvcmVkTWV0YURvYykge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBhcGkuX21ldGEgPSB7XG4gICAgICAgIG5hbWU6IGRiTmFtZSxcbiAgICAgICAgaW5zdGFuY2VJZDogaW5zdGFuY2VJZCxcbiAgICAgICAgYmxvYlN1cHBvcnQ6IGJsb2JTdXBwb3J0XG4gICAgICB9O1xuXG4gICAgICBjYWNoZWREQnMuc2V0KGRiTmFtZSwge1xuICAgICAgICBpZGI6IGlkYixcbiAgICAgICAgZ2xvYmFsOiBhcGkuX21ldGFcbiAgICAgIH0pO1xuICAgICAgY2FsbGJhY2sobnVsbCwgYXBpKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzdG9yZU1ldGFEb2NJZlJlYWR5KCkge1xuICAgICAgaWYgKHR5cGVvZiBkb2NDb3VudCA9PT0gJ3VuZGVmaW5lZCcgfHwgdHlwZW9mIG1ldGFEb2MgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHZhciBpbnN0YW5jZUtleSA9IGRiTmFtZSArICdfaWQnO1xuICAgICAgaWYgKGluc3RhbmNlS2V5IGluIG1ldGFEb2MpIHtcbiAgICAgICAgaW5zdGFuY2VJZCA9IG1ldGFEb2NbaW5zdGFuY2VLZXldO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbWV0YURvY1tpbnN0YW5jZUtleV0gPSBpbnN0YW5jZUlkID0gdXVpZCgpO1xuICAgICAgfVxuICAgICAgbWV0YURvYy5kb2NDb3VudCA9IGRvY0NvdW50O1xuICAgICAgdHhuLm9iamVjdFN0b3JlKE1FVEFfU1RPUkUpLnB1dChtZXRhRG9jKTtcbiAgICB9XG5cbiAgICAvL1xuICAgIC8vIGZldGNoIG9yIGdlbmVyYXRlIHRoZSBpbnN0YW5jZUlkXG4gICAgLy9cbiAgICB0eG4ub2JqZWN0U3RvcmUoTUVUQV9TVE9SRSkuZ2V0KE1FVEFfU1RPUkUpLm9uc3VjY2VzcyA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICBtZXRhRG9jID0gZS50YXJnZXQucmVzdWx0IHx8IHsgaWQ6IE1FVEFfU1RPUkUgfTtcbiAgICAgIHN0b3JlTWV0YURvY0lmUmVhZHkoKTtcbiAgICB9O1xuXG4gICAgLy9cbiAgICAvLyBjb3VudERvY3NcbiAgICAvL1xuICAgIGNvdW50RG9jcyh0eG4sIGZ1bmN0aW9uIChjb3VudCkge1xuICAgICAgZG9jQ291bnQgPSBjb3VudDtcbiAgICAgIHN0b3JlTWV0YURvY0lmUmVhZHkoKTtcbiAgICB9KTtcblxuICAgIC8vXG4gICAgLy8gY2hlY2sgYmxvYiBzdXBwb3J0XG4gICAgLy9cbiAgICBpZiAoIWJsb2JTdXBwb3J0UHJvbWlzZSkge1xuICAgICAgLy8gbWFrZSBzdXJlIGJsb2Igc3VwcG9ydCBpcyBvbmx5IGNoZWNrZWQgb25jZVxuICAgICAgYmxvYlN1cHBvcnRQcm9taXNlID0gY2hlY2tCbG9iU3VwcG9ydCh0eG4pO1xuICAgIH1cblxuICAgIGJsb2JTdXBwb3J0UHJvbWlzZS50aGVuKGZ1bmN0aW9uICh2YWwpIHtcbiAgICAgIGJsb2JTdXBwb3J0ID0gdmFsO1xuICAgICAgY29tcGxldGVTZXR1cCgpO1xuICAgIH0pO1xuXG4gICAgLy8gb25seSB3aGVuIHRoZSBtZXRhZGF0YSBwdXQgdHJhbnNhY3Rpb24gaGFzIGNvbXBsZXRlZCxcbiAgICAvLyBjb25zaWRlciB0aGUgc2V0dXAgZG9uZVxuICAgIHR4bi5vbmNvbXBsZXRlID0gZnVuY3Rpb24gKCkge1xuICAgICAgc3RvcmVkTWV0YURvYyA9IHRydWU7XG4gICAgICBjb21wbGV0ZVNldHVwKCk7XG4gICAgfTtcbiAgICB0eG4ub25hYm9ydCA9IGlkYkVycm9yKGNhbGxiYWNrKTtcbiAgfTtcblxuICByZXEub25lcnJvciA9IGZ1bmN0aW9uIChlKSB7XG4gICAgdmFyIG1zZyA9IGUudGFyZ2V0LmVycm9yICYmIGUudGFyZ2V0LmVycm9yLm1lc3NhZ2U7XG5cbiAgICBpZiAoIW1zZykge1xuICAgICAgbXNnID0gJ0ZhaWxlZCB0byBvcGVuIGluZGV4ZWREQiwgYXJlIHlvdSBpbiBwcml2YXRlIGJyb3dzaW5nIG1vZGU/JztcbiAgICB9IGVsc2UgaWYgKG1zZy5pbmRleE9mKFwic3RvcmVkIGRhdGFiYXNlIGlzIGEgaGlnaGVyIHZlcnNpb25cIikgIT09IC0xKSB7XG4gICAgICBtc2cgPSBuZXcgRXJyb3IoJ1RoaXMgREIgd2FzIGNyZWF0ZWQgd2l0aCB0aGUgbmV3ZXIgXCJpbmRleGVkZGJcIiBhZGFwdGVyLCBidXQgeW91IGFyZSB0cnlpbmcgdG8gb3BlbiBpdCB3aXRoIHRoZSBvbGRlciBcImlkYlwiIGFkYXB0ZXInKTtcbiAgICB9XG5cbiAgICBndWFyZGVkQ29uc29sZSgnZXJyb3InLCBtc2cpO1xuICAgIGNhbGxiYWNrKGNyZWF0ZUVycm9yKElEQl9FUlJPUiwgbXNnKSk7XG4gIH07XG59XG5cbklkYlBvdWNoLnZhbGlkID0gZnVuY3Rpb24gKCkge1xuICAvLyBGb2xsb3dpbmcgIzcwODUgYnVnZ3kgaWRiIHZlcnNpb25zICh0eXBpY2FsbHkgU2FmYXJpIDwgMTAuMSkgYXJlXG4gIC8vIGNvbnNpZGVyZWQgdmFsaWQuXG5cbiAgLy8gT24gRmlyZWZveCBTZWN1cml0eUVycm9yIGlzIHRocm93biB3aGlsZSByZWZlcmVuY2luZyBpbmRleGVkREIgaWYgY29va2llc1xuICAvLyBhcmUgbm90IGFsbG93ZWQuIGB0eXBlb2YgaW5kZXhlZERCYCBhbHNvIHRyaWdnZXJzIHRoZSBlcnJvci5cbiAgdHJ5IHtcbiAgICAvLyBzb21lIG91dGRhdGVkIGltcGxlbWVudGF0aW9ucyBvZiBJREIgdGhhdCBhcHBlYXIgb24gU2Ftc3VuZ1xuICAgIC8vIGFuZCBIVEMgQW5kcm9pZCBkZXZpY2VzIDw0LjQgYXJlIG1pc3NpbmcgSURCS2V5UmFuZ2VcbiAgICByZXR1cm4gdHlwZW9mIGluZGV4ZWREQiAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIElEQktleVJhbmdlICE9PSAndW5kZWZpbmVkJztcbiAgfSBjYXRjaCAoZSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxufTtcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKFBvdWNoREIpIHtcbiAgUG91Y2hEQi5hZGFwdGVyKCdpZGInLCBJZGJQb3VjaCwgdHJ1ZSk7XG59XG4iXSwibmFtZXMiOlsiYjY0U3RyaW5nVG9CbG9iIiwibmV4dFRpY2siLCJjYWxjdWxhdGVXaW5uaW5nUmV2IiwiZ2V0TGF0ZXN0Il0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFDQTtBQUNBLElBQUksZUFBZSxHQUFHLENBQUMsQ0FBQztBQUN4QjtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUksU0FBUyxHQUFHLGdCQUFnQixDQUFDO0FBQ2pDO0FBQ0E7QUFDQSxJQUFJLFlBQVksR0FBRyxhQUFhLENBQUM7QUFDakM7QUFDQSxJQUFJLFlBQVksR0FBRyxjQUFjLENBQUM7QUFDbEM7QUFDQTtBQUNBLElBQUksb0JBQW9CLEdBQUcsa0JBQWtCLENBQUM7QUFDOUM7QUFDQTtBQUNBO0FBQ0EsSUFBSSxVQUFVLEdBQUcsWUFBWSxDQUFDO0FBQzlCO0FBQ0EsSUFBSSxXQUFXLEdBQUcsYUFBYSxDQUFDO0FBQ2hDO0FBQ0EsSUFBSSx5QkFBeUIsR0FBRyxxQkFBcUI7O0FDUHJELFNBQVMsUUFBUSxDQUFDLFFBQVEsRUFBRTtBQUM1QixFQUFFLE9BQU8sVUFBVSxHQUFHLEVBQUU7QUFDeEIsSUFBSSxJQUFJLE9BQU8sR0FBRyxlQUFlLENBQUM7QUFDbEMsSUFBSSxJQUFJLEdBQUcsQ0FBQyxNQUFNLElBQUksR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUU7QUFDeEMsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxJQUFJ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
