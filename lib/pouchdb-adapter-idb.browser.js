import { changesHandler as Changes, uuid } from './pouchdb-utils.browser.js';
import { t as traverseRevTree, w as winningRev } from './rootToLeaf-f8d0e78a.js';
import { a as isLocalId, i as isDeleted } from './isLocalId-d067de54.js';
import { c as compactTree, l as latest } from './latest-0521537f.js';
import { createError, IDB_ERROR, MISSING_STUB, MISSING_DOC, REV_CONFLICT } from './pouchdb-errors.browser.js';
import { p as parseDoc } from './parseDoc-5d2a34bd.js';
import { i as immediate, h as hasLocalStorage } from './functionName-9335a350.js';
import './__node-resolve_empty-5ffda92e.js';
import './spark-md5-2c57e5fc.js';
import { p as preprocessAttachments } from './preprocessAttachments-1767f4bd.js';
import { p as processDocs } from './processDocs-7ad6f99c.js';
import { p as pick } from './bulkGetShim-d4877145.js';
import { a as thisBtoa } from './base64-browser-5f7b6479.js';
import { b as b64ToBluffer } from './base64StringToBlobOrBuffer-browser-ac90e85f.js';
import { c as createBlob } from './binaryStringToBlobOrBuffer-browser-7dc25c1d.js';
import { r as readAsBinaryString } from './readAsBinaryString-06e911ba.js';
import { safeJsonStringify, safeJsonParse } from './pouchdb-json.browser.js';
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
import './blobOrBufferToBase64-browser-cd22f32f.js';
import './binaryMd5-browser-ad85bb67.js';
import './readAsArrayBuffer-625b2d33.js';
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
      callback(createBlob([''], {type: type}));
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
        callback(thisBtoa(binary));
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
    var blob = createBlob(['']);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG91Y2hkYi1hZGFwdGVyLWlkYi5icm93c2VyLmpzIiwic291cmNlcyI6WyIuLi9wYWNrYWdlcy9wb3VjaGRiLWFkYXB0ZXItaWRiL3NyYy9jb25zdGFudHMuanMiLCIuLi9wYWNrYWdlcy9wb3VjaGRiLWFkYXB0ZXItaWRiL3NyYy91dGlscy5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItYWRhcHRlci1pZGIvc3JjL2NoYW5nZXNIYW5kbGVyLmpzIiwiLi4vcGFja2FnZXMvcG91Y2hkYi1hZGFwdGVyLWlkYi9zcmMvYnVsa0RvY3MuanMiLCIuLi9wYWNrYWdlcy9wb3VjaGRiLWFkYXB0ZXItaWRiL3NyYy9ydW5CYXRjaGVkQ3Vyc29yLmpzIiwiLi4vcGFja2FnZXMvcG91Y2hkYi1hZGFwdGVyLWlkYi9zcmMvZ2V0QWxsLmpzIiwiLi4vcGFja2FnZXMvcG91Y2hkYi1hZGFwdGVyLWlkYi9zcmMvYWxsRG9jcy5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItYWRhcHRlci1pZGIvc3JjL2Jsb2JTdXBwb3J0LmpzIiwiLi4vcGFja2FnZXMvcG91Y2hkYi1hZGFwdGVyLWlkYi9zcmMvY291bnREb2NzLmpzIiwiLi4vcGFja2FnZXMvcG91Y2hkYi1hZGFwdGVyLWlkYi9zcmMvdGFza1F1ZXVlLmpzIiwiLi4vcGFja2FnZXMvcG91Y2hkYi1hZGFwdGVyLWlkYi9zcmMvY2hhbmdlcy5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItYWRhcHRlci1pZGIvc3JjL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIEluZGV4ZWREQiByZXF1aXJlcyBhIHZlcnNpb25lZCBkYXRhYmFzZSBzdHJ1Y3R1cmUsIHNvIHdlIHVzZSB0aGVcbi8vIHZlcnNpb24gaGVyZSB0byBtYW5hZ2UgbWlncmF0aW9ucy5cbnZhciBBREFQVEVSX1ZFUlNJT04gPSA1O1xuXG4vLyBUaGUgb2JqZWN0IHN0b3JlcyBjcmVhdGVkIGZvciBlYWNoIGRhdGFiYXNlXG4vLyBET0NfU1RPUkUgc3RvcmVzIHRoZSBkb2N1bWVudCBtZXRhIGRhdGEsIGl0cyByZXZpc2lvbiBoaXN0b3J5IGFuZCBzdGF0ZVxuLy8gS2V5ZWQgYnkgZG9jdW1lbnQgaWRcbnZhciBET0NfU1RPUkUgPSAnZG9jdW1lbnQtc3RvcmUnO1xuLy8gQllfU0VRX1NUT1JFIHN0b3JlcyBhIHBhcnRpY3VsYXIgdmVyc2lvbiBvZiBhIGRvY3VtZW50LCBrZXllZCBieSBpdHNcbi8vIHNlcXVlbmNlIGlkXG52YXIgQllfU0VRX1NUT1JFID0gJ2J5LXNlcXVlbmNlJztcbi8vIFdoZXJlIHdlIHN0b3JlIGF0dGFjaG1lbnRzXG52YXIgQVRUQUNIX1NUT1JFID0gJ2F0dGFjaC1zdG9yZSc7XG4vLyBXaGVyZSB3ZSBzdG9yZSBtYW55LXRvLW1hbnkgcmVsYXRpb25zXG4vLyBiZXR3ZWVuIGF0dGFjaG1lbnQgZGlnZXN0cyBhbmQgc2Vxc1xudmFyIEFUVEFDSF9BTkRfU0VRX1NUT1JFID0gJ2F0dGFjaC1zZXEtc3RvcmUnO1xuXG4vLyBXaGVyZSB3ZSBzdG9yZSBkYXRhYmFzZS13aWRlIG1ldGEgZGF0YSBpbiBhIHNpbmdsZSByZWNvcmRcbi8vIGtleWVkIGJ5IGlkOiBNRVRBX1NUT1JFXG52YXIgTUVUQV9TVE9SRSA9ICdtZXRhLXN0b3JlJztcbi8vIFdoZXJlIHdlIHN0b3JlIGxvY2FsIGRvY3VtZW50c1xudmFyIExPQ0FMX1NUT1JFID0gJ2xvY2FsLXN0b3JlJztcbi8vIFdoZXJlIHdlIGRldGVjdCBibG9iIHN1cHBvcnRcbnZhciBERVRFQ1RfQkxPQl9TVVBQT1JUX1NUT1JFID0gJ2RldGVjdC1ibG9iLXN1cHBvcnQnO1xuXG5leHBvcnQge1xuICBBREFQVEVSX1ZFUlNJT04gYXMgQURBUFRFUl9WRVJTSU9OLFxuICBET0NfU1RPUkUgYXMgRE9DX1NUT1JFLFxuICBCWV9TRVFfU1RPUkUgYXMgQllfU0VRX1NUT1JFLFxuICBBVFRBQ0hfU1RPUkUgYXMgQVRUQUNIX1NUT1JFLFxuICBBVFRBQ0hfQU5EX1NFUV9TVE9SRSBhcyBBVFRBQ0hfQU5EX1NFUV9TVE9SRSxcbiAgTUVUQV9TVE9SRSBhcyBNRVRBX1NUT1JFLFxuICBMT0NBTF9TVE9SRSBhcyBMT0NBTF9TVE9SRSxcbiAgREVURUNUX0JMT0JfU1VQUE9SVF9TVE9SRSBhcyBERVRFQ1RfQkxPQl9TVVBQT1JUX1NUT1JFXG59OyIsIlxuaW1wb3J0IHsgY3JlYXRlRXJyb3IsIElEQl9FUlJPUiB9IGZyb20gJ3BvdWNoZGItZXJyb3JzJztcbmltcG9ydCB7XG4gIHBpY2tcbn0gZnJvbSAncG91Y2hkYi11dGlscyc7XG5pbXBvcnQge1xuICBzYWZlSnNvblBhcnNlLFxuICBzYWZlSnNvblN0cmluZ2lmeVxufSBmcm9tICdwb3VjaGRiLWpzb24nO1xuaW1wb3J0IHtcbiAgYnRvYSxcbiAgcmVhZEFzQmluYXJ5U3RyaW5nLFxuICBiYXNlNjRTdHJpbmdUb0Jsb2JPckJ1ZmZlciBhcyBiNjRTdHJpbmdUb0Jsb2IsXG4gIGJsb2IgYXMgY3JlYXRlQmxvYlxufSBmcm9tICdwb3VjaGRiLWJpbmFyeS11dGlscyc7XG5pbXBvcnQgeyBBVFRBQ0hfQU5EX1NFUV9TVE9SRSwgQVRUQUNIX1NUT1JFLCBCWV9TRVFfU1RPUkUgfSBmcm9tICcuL2NvbnN0YW50cyc7XG5cbmZ1bmN0aW9uIGlkYkVycm9yKGNhbGxiYWNrKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoZXZ0KSB7XG4gICAgdmFyIG1lc3NhZ2UgPSAndW5rbm93bl9lcnJvcic7XG4gICAgaWYgKGV2dC50YXJnZXQgJiYgZXZ0LnRhcmdldC5lcnJvcikge1xuICAgICAgbWVzc2FnZSA9IGV2dC50YXJnZXQuZXJyb3IubmFtZSB8fCBldnQudGFyZ2V0LmVycm9yLm1lc3NhZ2U7XG4gICAgfVxuICAgIGNhbGxiYWNrKGNyZWF0ZUVycm9yKElEQl9FUlJPUiwgbWVzc2FnZSwgZXZ0LnR5cGUpKTtcbiAgfTtcbn1cblxuLy8gVW5mb3J0dW5hdGVseSwgdGhlIG1ldGFkYXRhIGhhcyB0byBiZSBzdHJpbmdpZmllZFxuLy8gd2hlbiBpdCBpcyBwdXQgaW50byB0aGUgZGF0YWJhc2UsIGJlY2F1c2Ugb3RoZXJ3aXNlXG4vLyBJbmRleGVkREIgY2FuIHRocm93IGVycm9ycyBmb3IgZGVlcGx5LW5lc3RlZCBvYmplY3RzLlxuLy8gT3JpZ2luYWxseSB3ZSBqdXN0IHVzZWQgSlNPTi5wYXJzZS9KU09OLnN0cmluZ2lmeTsgbm93XG4vLyB3ZSB1c2UgdGhpcyBjdXN0b20gdnV2dXplbGEgbGlicmFyeSB0aGF0IGF2b2lkcyByZWN1cnNpb24uXG4vLyBJZiB3ZSBjb3VsZCBkbyBpdCBhbGwgb3ZlciBhZ2Fpbiwgd2UnZCBwcm9iYWJseSB1c2UgYVxuLy8gZm9ybWF0IGZvciB0aGUgcmV2aXNpb24gdHJlZXMgb3RoZXIgdGhhbiBKU09OLlxuZnVuY3Rpb24gZW5jb2RlTWV0YWRhdGEobWV0YWRhdGEsIHdpbm5pbmdSZXYsIGRlbGV0ZWQpIHtcbiAgcmV0dXJuIHtcbiAgICBkYXRhOiBzYWZlSnNvblN0cmluZ2lmeShtZXRhZGF0YSksXG4gICAgd2lubmluZ1Jldjogd2lubmluZ1JldixcbiAgICBkZWxldGVkT3JMb2NhbDogZGVsZXRlZCA/ICcxJyA6ICcwJyxcbiAgICBzZXE6IG1ldGFkYXRhLnNlcSwgLy8gaGlnaGVzdCBzZXEgZm9yIHRoaXMgZG9jXG4gICAgaWQ6IG1ldGFkYXRhLmlkXG4gIH07XG59XG5cbmZ1bmN0aW9uIGRlY29kZU1ldGFkYXRhKHN0b3JlZE9iamVjdCkge1xuICBpZiAoIXN0b3JlZE9iamVjdCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHZhciBtZXRhZGF0YSA9IHNhZmVKc29uUGFyc2Uoc3RvcmVkT2JqZWN0LmRhdGEpO1xuICBtZXRhZGF0YS53aW5uaW5nUmV2ID0gc3RvcmVkT2JqZWN0Lndpbm5pbmdSZXY7XG4gIG1ldGFkYXRhLmRlbGV0ZWQgPSBzdG9yZWRPYmplY3QuZGVsZXRlZE9yTG9jYWwgPT09ICcxJztcbiAgbWV0YWRhdGEuc2VxID0gc3RvcmVkT2JqZWN0LnNlcTtcbiAgcmV0dXJuIG1ldGFkYXRhO1xufVxuXG4vLyByZWFkIHRoZSBkb2MgYmFjayBvdXQgZnJvbSB0aGUgZGF0YWJhc2UuIHdlIGRvbid0IHN0b3JlIHRoZVxuLy8gX2lkIG9yIF9yZXYgYmVjYXVzZSB3ZSBhbHJlYWR5IGhhdmUgX2RvY19pZF9yZXYuXG5mdW5jdGlvbiBkZWNvZGVEb2MoZG9jKSB7XG4gIGlmICghZG9jKSB7XG4gICAgcmV0dXJuIGRvYztcbiAgfVxuICB2YXIgaWR4ID0gZG9jLl9kb2NfaWRfcmV2Lmxhc3RJbmRleE9mKCc6Jyk7XG4gIGRvYy5faWQgPSBkb2MuX2RvY19pZF9yZXYuc3Vic3RyaW5nKDAsIGlkeCAtIDEpO1xuICBkb2MuX3JldiA9IGRvYy5fZG9jX2lkX3Jldi5zdWJzdHJpbmcoaWR4ICsgMSk7XG4gIGRlbGV0ZSBkb2MuX2RvY19pZF9yZXY7XG4gIHJldHVybiBkb2M7XG59XG5cbi8vIFJlYWQgYSBibG9iIGZyb20gdGhlIGRhdGFiYXNlLCBlbmNvZGluZyBhcyBuZWNlc3Nhcnlcbi8vIGFuZCB0cmFuc2xhdGluZyBmcm9tIGJhc2U2NCBpZiB0aGUgSURCIGRvZXNuJ3Qgc3VwcG9ydFxuLy8gbmF0aXZlIEJsb2JzXG5mdW5jdGlvbiByZWFkQmxvYkRhdGEoYm9keSwgdHlwZSwgYXNCbG9iLCBjYWxsYmFjaykge1xuICBpZiAoYXNCbG9iKSB7XG4gICAgaWYgKCFib2R5KSB7XG4gICAgICBjYWxsYmFjayhjcmVhdGVCbG9iKFsnJ10sIHt0eXBlOiB0eXBlfSkpO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIGJvZHkgIT09ICdzdHJpbmcnKSB7IC8vIHdlIGhhdmUgYmxvYiBzdXBwb3J0XG4gICAgICBjYWxsYmFjayhib2R5KTtcbiAgICB9IGVsc2UgeyAvLyBubyBibG9iIHN1cHBvcnRcbiAgICAgIGNhbGxiYWNrKGI2NFN0cmluZ1RvQmxvYihib2R5LCB0eXBlKSk7XG4gICAgfVxuICB9IGVsc2UgeyAvLyBhcyBiYXNlNjQgc3RyaW5nXG4gICAgaWYgKCFib2R5KSB7XG4gICAgICBjYWxsYmFjaygnJyk7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgYm9keSAhPT0gJ3N0cmluZycpIHsgLy8gd2UgaGF2ZSBibG9iIHN1cHBvcnRcbiAgICAgIHJlYWRBc0JpbmFyeVN0cmluZyhib2R5LCBmdW5jdGlvbiAoYmluYXJ5KSB7XG4gICAgICAgIGNhbGxiYWNrKGJ0b2EoYmluYXJ5KSk7XG4gICAgICB9KTtcbiAgICB9IGVsc2UgeyAvLyBubyBibG9iIHN1cHBvcnRcbiAgICAgIGNhbGxiYWNrKGJvZHkpO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBmZXRjaEF0dGFjaG1lbnRzSWZOZWNlc3NhcnkoZG9jLCBvcHRzLCB0eG4sIGNiKSB7XG4gIHZhciBhdHRhY2htZW50cyA9IE9iamVjdC5rZXlzKGRvYy5fYXR0YWNobWVudHMgfHwge30pO1xuICBpZiAoIWF0dGFjaG1lbnRzLmxlbmd0aCkge1xuICAgIHJldHVybiBjYiAmJiBjYigpO1xuICB9XG4gIHZhciBudW1Eb25lID0gMDtcblxuICBmdW5jdGlvbiBjaGVja0RvbmUoKSB7XG4gICAgaWYgKCsrbnVtRG9uZSA9PT0gYXR0YWNobWVudHMubGVuZ3RoICYmIGNiKSB7XG4gICAgICBjYigpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGZldGNoQXR0YWNobWVudChkb2MsIGF0dCkge1xuICAgIHZhciBhdHRPYmogPSBkb2MuX2F0dGFjaG1lbnRzW2F0dF07XG4gICAgdmFyIGRpZ2VzdCA9IGF0dE9iai5kaWdlc3Q7XG4gICAgdmFyIHJlcSA9IHR4bi5vYmplY3RTdG9yZShBVFRBQ0hfU1RPUkUpLmdldChkaWdlc3QpO1xuICAgIHJlcS5vbnN1Y2Nlc3MgPSBmdW5jdGlvbiAoZSkge1xuICAgICAgYXR0T2JqLmJvZHkgPSBlLnRhcmdldC5yZXN1bHQuYm9keTtcbiAgICAgIGNoZWNrRG9uZSgpO1xuICAgIH07XG4gIH1cblxuICBhdHRhY2htZW50cy5mb3JFYWNoKGZ1bmN0aW9uIChhdHQpIHtcbiAgICBpZiAob3B0cy5hdHRhY2htZW50cyAmJiBvcHRzLmluY2x1ZGVfZG9jcykge1xuICAgICAgZmV0Y2hBdHRhY2htZW50KGRvYywgYXR0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgZG9jLl9hdHRhY2htZW50c1thdHRdLnN0dWIgPSB0cnVlO1xuICAgICAgY2hlY2tEb25lKCk7XG4gICAgfVxuICB9KTtcbn1cblxuLy8gSURCLXNwZWNpZmljIHBvc3Rwcm9jZXNzaW5nIG5lY2Vzc2FyeSBiZWNhdXNlXG4vLyB3ZSBkb24ndCBrbm93IHdoZXRoZXIgd2Ugc3RvcmVkIGEgdHJ1ZSBCbG9iIG9yXG4vLyBhIGJhc2U2NC1lbmNvZGVkIHN0cmluZywgYW5kIGlmIGl0J3MgYSBCbG9iIGl0XG4vLyBuZWVkcyB0byBiZSByZWFkIG91dHNpZGUgb2YgdGhlIHRyYW5zYWN0aW9uIGNvbnRleHRcbmZ1bmN0aW9uIHBvc3RQcm9jZXNzQXR0YWNobWVudHMocmVzdWx0cywgYXNCbG9iKSB7XG4gIHJldHVybiBQcm9taXNlLmFsbChyZXN1bHRzLm1hcChmdW5jdGlvbiAocm93KSB7XG4gICAgaWYgKHJvdy5kb2MgJiYgcm93LmRvYy5fYXR0YWNobWVudHMpIHtcbiAgICAgIHZhciBhdHROYW1lcyA9IE9iamVjdC5rZXlzKHJvdy5kb2MuX2F0dGFjaG1lbnRzKTtcbiAgICAgIHJldHVybiBQcm9taXNlLmFsbChhdHROYW1lcy5tYXAoZnVuY3Rpb24gKGF0dCkge1xuICAgICAgICB2YXIgYXR0T2JqID0gcm93LmRvYy5fYXR0YWNobWVudHNbYXR0XTtcbiAgICAgICAgaWYgKCEoJ2JvZHknIGluIGF0dE9iaikpIHsgLy8gYWxyZWFkeSBwcm9jZXNzZWRcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGJvZHkgPSBhdHRPYmouYm9keTtcbiAgICAgICAgdmFyIHR5cGUgPSBhdHRPYmouY29udGVudF90eXBlO1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUpIHtcbiAgICAgICAgICByZWFkQmxvYkRhdGEoYm9keSwgdHlwZSwgYXNCbG9iLCBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICAgICAgcm93LmRvYy5fYXR0YWNobWVudHNbYXR0XSA9IE9iamVjdC5hc3NpZ24oXG4gICAgICAgICAgICAgIHBpY2soYXR0T2JqLCBbJ2RpZ2VzdCcsICdjb250ZW50X3R5cGUnXSksXG4gICAgICAgICAgICAgIHtkYXRhOiBkYXRhfVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICB9KSk7XG4gICAgfVxuICB9KSk7XG59XG5cbmZ1bmN0aW9uIGNvbXBhY3RSZXZzKHJldnMsIGRvY0lkLCB0eG4pIHtcblxuICB2YXIgcG9zc2libHlPcnBoYW5lZERpZ2VzdHMgPSBbXTtcbiAgdmFyIHNlcVN0b3JlID0gdHhuLm9iamVjdFN0b3JlKEJZX1NFUV9TVE9SRSk7XG4gIHZhciBhdHRTdG9yZSA9IHR4bi5vYmplY3RTdG9yZShBVFRBQ0hfU1RPUkUpO1xuICB2YXIgYXR0QW5kU2VxU3RvcmUgPSB0eG4ub2JqZWN0U3RvcmUoQVRUQUNIX0FORF9TRVFfU1RPUkUpO1xuICB2YXIgY291bnQgPSByZXZzLmxlbmd0aDtcblxuICBmdW5jdGlvbiBjaGVja0RvbmUoKSB7XG4gICAgY291bnQtLTtcbiAgICBpZiAoIWNvdW50KSB7IC8vIGRvbmUgcHJvY2Vzc2luZyBhbGwgcmV2c1xuICAgICAgZGVsZXRlT3JwaGFuZWRBdHRhY2htZW50cygpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGRlbGV0ZU9ycGhhbmVkQXR0YWNobWVudHMoKSB7XG4gICAgaWYgKCFwb3NzaWJseU9ycGhhbmVkRGlnZXN0cy5sZW5ndGgpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgcG9zc2libHlPcnBoYW5lZERpZ2VzdHMuZm9yRWFjaChmdW5jdGlvbiAoZGlnZXN0KSB7XG4gICAgICB2YXIgY291bnRSZXEgPSBhdHRBbmRTZXFTdG9yZS5pbmRleCgnZGlnZXN0U2VxJykuY291bnQoXG4gICAgICAgIElEQktleVJhbmdlLmJvdW5kKFxuICAgICAgICAgIGRpZ2VzdCArICc6OicsIGRpZ2VzdCArICc6OlxcdWZmZmYnLCBmYWxzZSwgZmFsc2UpKTtcbiAgICAgIGNvdW50UmVxLm9uc3VjY2VzcyA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICAgIHZhciBjb3VudCA9IGUudGFyZ2V0LnJlc3VsdDtcbiAgICAgICAgaWYgKCFjb3VudCkge1xuICAgICAgICAgIC8vIG9ycGhhbmVkXG4gICAgICAgICAgYXR0U3RvcmUuZGVsZXRlKGRpZ2VzdCk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICByZXZzLmZvckVhY2goZnVuY3Rpb24gKHJldikge1xuICAgIHZhciBpbmRleCA9IHNlcVN0b3JlLmluZGV4KCdfZG9jX2lkX3JldicpO1xuICAgIHZhciBrZXkgPSBkb2NJZCArIFwiOjpcIiArIHJldjtcbiAgICBpbmRleC5nZXRLZXkoa2V5KS5vbnN1Y2Nlc3MgPSBmdW5jdGlvbiAoZSkge1xuICAgICAgdmFyIHNlcSA9IGUudGFyZ2V0LnJlc3VsdDtcbiAgICAgIGlmICh0eXBlb2Ygc2VxICE9PSAnbnVtYmVyJykge1xuICAgICAgICByZXR1cm4gY2hlY2tEb25lKCk7XG4gICAgICB9XG4gICAgICBzZXFTdG9yZS5kZWxldGUoc2VxKTtcblxuICAgICAgdmFyIGN1cnNvciA9IGF0dEFuZFNlcVN0b3JlLmluZGV4KCdzZXEnKVxuICAgICAgICAub3BlbkN1cnNvcihJREJLZXlSYW5nZS5vbmx5KHNlcSkpO1xuXG4gICAgICBjdXJzb3Iub25zdWNjZXNzID0gZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICAgIHZhciBjdXJzb3IgPSBldmVudC50YXJnZXQucmVzdWx0O1xuICAgICAgICBpZiAoY3Vyc29yKSB7XG4gICAgICAgICAgdmFyIGRpZ2VzdCA9IGN1cnNvci52YWx1ZS5kaWdlc3RTZXEuc3BsaXQoJzo6JylbMF07XG4gICAgICAgICAgcG9zc2libHlPcnBoYW5lZERpZ2VzdHMucHVzaChkaWdlc3QpO1xuICAgICAgICAgIGF0dEFuZFNlcVN0b3JlLmRlbGV0ZShjdXJzb3IucHJpbWFyeUtleSk7XG4gICAgICAgICAgY3Vyc29yLmNvbnRpbnVlKCk7XG4gICAgICAgIH0gZWxzZSB7IC8vIGRvbmVcbiAgICAgICAgICBjaGVja0RvbmUoKTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9O1xuICB9KTtcbn1cblxuZnVuY3Rpb24gb3BlblRyYW5zYWN0aW9uU2FmZWx5KGlkYiwgc3RvcmVzLCBtb2RlKSB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHR4bjogaWRiLnRyYW5zYWN0aW9uKHN0b3JlcywgbW9kZSlcbiAgICB9O1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICByZXR1cm4ge1xuICAgICAgZXJyb3I6IGVyclxuICAgIH07XG4gIH1cbn1cblxuZXhwb3J0IHtcbiAgZmV0Y2hBdHRhY2htZW50c0lmTmVjZXNzYXJ5LFxuICBvcGVuVHJhbnNhY3Rpb25TYWZlbHksXG4gIGNvbXBhY3RSZXZzLFxuICBwb3N0UHJvY2Vzc0F0dGFjaG1lbnRzLFxuICBpZGJFcnJvcixcbiAgZW5jb2RlTWV0YWRhdGEsXG4gIGRlY29kZU1ldGFkYXRhLFxuICBkZWNvZGVEb2MsXG4gIHJlYWRCbG9iRGF0YVxufTtcbiIsImltcG9ydCB7IGNoYW5nZXNIYW5kbGVyIGFzIENoYW5nZXMgfSBmcm9tICdwb3VjaGRiLXV0aWxzJztcbmV4cG9ydCBkZWZhdWx0IG5ldyBDaGFuZ2VzKCk7IiwiaW1wb3J0IHsgY3JlYXRlRXJyb3IsIE1JU1NJTkdfU1RVQiB9IGZyb20gJ3BvdWNoZGItZXJyb3JzJztcbmltcG9ydCB7XG4gIHByZXByb2Nlc3NBdHRhY2htZW50cyxcbiAgcHJvY2Vzc0RvY3MsXG4gIGlzTG9jYWxJZCxcbiAgcGFyc2VEb2Ncbn0gZnJvbSAncG91Y2hkYi1hZGFwdGVyLXV0aWxzJztcblxuaW1wb3J0IHtcbiAgY29tcGFjdFRyZWVcbn0gZnJvbSAncG91Y2hkYi1tZXJnZSc7XG5cbmltcG9ydCB7XG4gIEFUVEFDSF9BTkRfU0VRX1NUT1JFLFxuICBBVFRBQ0hfU1RPUkUsXG4gIEJZX1NFUV9TVE9SRSxcbiAgRE9DX1NUT1JFLFxuICBMT0NBTF9TVE9SRSxcbiAgTUVUQV9TVE9SRVxufSBmcm9tICcuL2NvbnN0YW50cyc7XG5cbmltcG9ydCB7XG4gIGNvbXBhY3RSZXZzLFxuICBkZWNvZGVNZXRhZGF0YSxcbiAgZW5jb2RlTWV0YWRhdGEsXG4gIGlkYkVycm9yLFxuICBvcGVuVHJhbnNhY3Rpb25TYWZlbHlcbn0gZnJvbSAnLi91dGlscyc7XG5cbmltcG9ydCBjaGFuZ2VzSGFuZGxlciBmcm9tICcuL2NoYW5nZXNIYW5kbGVyJztcblxuZnVuY3Rpb24gaWRiQnVsa0RvY3MoZGJPcHRzLCByZXEsIG9wdHMsIGFwaSwgaWRiLCBjYWxsYmFjaykge1xuICB2YXIgZG9jSW5mb3MgPSByZXEuZG9jcztcbiAgdmFyIHR4bjtcbiAgdmFyIGRvY1N0b3JlO1xuICB2YXIgYnlTZXFTdG9yZTtcbiAgdmFyIGF0dGFjaFN0b3JlO1xuICB2YXIgYXR0YWNoQW5kU2VxU3RvcmU7XG4gIHZhciBtZXRhU3RvcmU7XG4gIHZhciBkb2NJbmZvRXJyb3I7XG4gIHZhciBtZXRhRG9jO1xuXG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSBkb2NJbmZvcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIHZhciBkb2MgPSBkb2NJbmZvc1tpXTtcbiAgICBpZiAoZG9jLl9pZCAmJiBpc0xvY2FsSWQoZG9jLl9pZCkpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBkb2MgPSBkb2NJbmZvc1tpXSA9IHBhcnNlRG9jKGRvYywgb3B0cy5uZXdfZWRpdHMsIGRiT3B0cyk7XG4gICAgaWYgKGRvYy5lcnJvciAmJiAhZG9jSW5mb0Vycm9yKSB7XG4gICAgICBkb2NJbmZvRXJyb3IgPSBkb2M7XG4gICAgfVxuICB9XG5cbiAgaWYgKGRvY0luZm9FcnJvcikge1xuICAgIHJldHVybiBjYWxsYmFjayhkb2NJbmZvRXJyb3IpO1xuICB9XG5cbiAgdmFyIGFsbERvY3NQcm9jZXNzZWQgPSBmYWxzZTtcbiAgdmFyIGRvY0NvdW50RGVsdGEgPSAwO1xuICB2YXIgcmVzdWx0cyA9IG5ldyBBcnJheShkb2NJbmZvcy5sZW5ndGgpO1xuICB2YXIgZmV0Y2hlZERvY3MgPSBuZXcgTWFwKCk7XG4gIHZhciBwcmVjb25kaXRpb25FcnJvcmVkID0gZmFsc2U7XG4gIHZhciBibG9iVHlwZSA9IGFwaS5fbWV0YS5ibG9iU3VwcG9ydCA/ICdibG9iJyA6ICdiYXNlNjQnO1xuXG4gIHByZXByb2Nlc3NBdHRhY2htZW50cyhkb2NJbmZvcywgYmxvYlR5cGUsIGZ1bmN0aW9uIChlcnIpIHtcbiAgICBpZiAoZXJyKSB7XG4gICAgICByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICB9XG4gICAgc3RhcnRUcmFuc2FjdGlvbigpO1xuICB9KTtcblxuICBmdW5jdGlvbiBzdGFydFRyYW5zYWN0aW9uKCkge1xuXG4gICAgdmFyIHN0b3JlcyA9IFtcbiAgICAgIERPQ19TVE9SRSwgQllfU0VRX1NUT1JFLFxuICAgICAgQVRUQUNIX1NUT1JFLFxuICAgICAgTE9DQUxfU1RPUkUsIEFUVEFDSF9BTkRfU0VRX1NUT1JFLFxuICAgICAgTUVUQV9TVE9SRVxuICAgIF07XG4gICAgdmFyIHR4blJlc3VsdCA9IG9wZW5UcmFuc2FjdGlvblNhZmVseShpZGIsIHN0b3JlcywgJ3JlYWR3cml0ZScpO1xuICAgIGlmICh0eG5SZXN1bHQuZXJyb3IpIHtcbiAgICAgIHJldHVybiBjYWxsYmFjayh0eG5SZXN1bHQuZXJyb3IpO1xuICAgIH1cbiAgICB0eG4gPSB0eG5SZXN1bHQudHhuO1xuICAgIHR4bi5vbmFib3J0ID0gaWRiRXJyb3IoY2FsbGJhY2spO1xuICAgIHR4bi5vbnRpbWVvdXQgPSBpZGJFcnJvcihjYWxsYmFjayk7XG4gICAgdHhuLm9uY29tcGxldGUgPSBjb21wbGV0ZTtcbiAgICBkb2NTdG9yZSA9IHR4bi5vYmplY3RTdG9yZShET0NfU1RPUkUpO1xuICAgIGJ5U2VxU3RvcmUgPSB0eG4ub2JqZWN0U3RvcmUoQllfU0VRX1NUT1JFKTtcbiAgICBhdHRhY2hTdG9yZSA9IHR4bi5vYmplY3RTdG9yZShBVFRBQ0hfU1RPUkUpO1xuICAgIGF0dGFjaEFuZFNlcVN0b3JlID0gdHhuLm9iamVjdFN0b3JlKEFUVEFDSF9BTkRfU0VRX1NUT1JFKTtcbiAgICBtZXRhU3RvcmUgPSB0eG4ub2JqZWN0U3RvcmUoTUVUQV9TVE9SRSk7XG5cbiAgICBtZXRhU3RvcmUuZ2V0KE1FVEFfU1RPUkUpLm9uc3VjY2VzcyA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICBtZXRhRG9jID0gZS50YXJnZXQucmVzdWx0O1xuICAgICAgdXBkYXRlRG9jQ291bnRJZlJlYWR5KCk7XG4gICAgfTtcblxuICAgIHZlcmlmeUF0dGFjaG1lbnRzKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgcHJlY29uZGl0aW9uRXJyb3JlZCA9IHRydWU7XG4gICAgICAgIHJldHVybiBjYWxsYmFjayhlcnIpO1xuICAgICAgfVxuICAgICAgZmV0Y2hFeGlzdGluZ0RvY3MoKTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG9uQWxsRG9jc1Byb2Nlc3NlZCgpIHtcbiAgICBhbGxEb2NzUHJvY2Vzc2VkID0gdHJ1ZTtcbiAgICB1cGRhdGVEb2NDb3VudElmUmVhZHkoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGlkYlByb2Nlc3NEb2NzKCkge1xuICAgIHByb2Nlc3NEb2NzKGRiT3B0cy5yZXZzX2xpbWl0LCBkb2NJbmZvcywgYXBpLCBmZXRjaGVkRG9jcyxcbiAgICAgICAgICAgICAgICB0eG4sIHJlc3VsdHMsIHdyaXRlRG9jLCBvcHRzLCBvbkFsbERvY3NQcm9jZXNzZWQpO1xuICB9XG5cbiAgZnVuY3Rpb24gdXBkYXRlRG9jQ291bnRJZlJlYWR5KCkge1xuICAgIGlmICghbWV0YURvYyB8fCAhYWxsRG9jc1Byb2Nlc3NlZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvLyBjYWNoaW5nIHRoZSBkb2NDb3VudCBzYXZlcyBhIGxvdCBvZiB0aW1lIGluIGFsbERvY3MoKSBhbmRcbiAgICAvLyBpbmZvKCksIHdoaWNoIGlzIHdoeSB3ZSBnbyB0byBhbGwgdGhlIHRyb3VibGUgb2YgZG9pbmcgdGhpc1xuICAgIG1ldGFEb2MuZG9jQ291bnQgKz0gZG9jQ291bnREZWx0YTtcbiAgICBtZXRhU3RvcmUucHV0KG1ldGFEb2MpO1xuICB9XG5cbiAgZnVuY3Rpb24gZmV0Y2hFeGlzdGluZ0RvY3MoKSB7XG5cbiAgICBpZiAoIWRvY0luZm9zLmxlbmd0aCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBudW1GZXRjaGVkID0gMDtcblxuICAgIGZ1bmN0aW9uIGNoZWNrRG9uZSgpIHtcbiAgICAgIGlmICgrK251bUZldGNoZWQgPT09IGRvY0luZm9zLmxlbmd0aCkge1xuICAgICAgICBpZGJQcm9jZXNzRG9jcygpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHJlYWRNZXRhZGF0YShldmVudCkge1xuICAgICAgdmFyIG1ldGFkYXRhID0gZGVjb2RlTWV0YWRhdGEoZXZlbnQudGFyZ2V0LnJlc3VsdCk7XG5cbiAgICAgIGlmIChtZXRhZGF0YSkge1xuICAgICAgICBmZXRjaGVkRG9jcy5zZXQobWV0YWRhdGEuaWQsIG1ldGFkYXRhKTtcbiAgICAgIH1cbiAgICAgIGNoZWNrRG9uZSgpO1xuICAgIH1cblxuICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBkb2NJbmZvcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgdmFyIGRvY0luZm8gPSBkb2NJbmZvc1tpXTtcbiAgICAgIGlmIChkb2NJbmZvLl9pZCAmJiBpc0xvY2FsSWQoZG9jSW5mby5faWQpKSB7XG4gICAgICAgIGNoZWNrRG9uZSgpOyAvLyBza2lwIGxvY2FsIGRvY3NcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICB2YXIgcmVxID0gZG9jU3RvcmUuZ2V0KGRvY0luZm8ubWV0YWRhdGEuaWQpO1xuICAgICAgcmVxLm9uc3VjY2VzcyA9IHJlYWRNZXRhZGF0YTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBjb21wbGV0ZSgpIHtcbiAgICBpZiAocHJlY29uZGl0aW9uRXJyb3JlZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNoYW5nZXNIYW5kbGVyLm5vdGlmeShhcGkuX21ldGEubmFtZSk7XG4gICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0cyk7XG4gIH1cblxuICBmdW5jdGlvbiB2ZXJpZnlBdHRhY2htZW50KGRpZ2VzdCwgY2FsbGJhY2spIHtcblxuICAgIHZhciByZXEgPSBhdHRhY2hTdG9yZS5nZXQoZGlnZXN0KTtcbiAgICByZXEub25zdWNjZXNzID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgIGlmICghZS50YXJnZXQucmVzdWx0KSB7XG4gICAgICAgIHZhciBlcnIgPSBjcmVhdGVFcnJvcihNSVNTSU5HX1NUVUIsXG4gICAgICAgICAgJ3Vua25vd24gc3R1YiBhdHRhY2htZW50IHdpdGggZGlnZXN0ICcgK1xuICAgICAgICAgIGRpZ2VzdCk7XG4gICAgICAgIGVyci5zdGF0dXMgPSA0MTI7XG4gICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgfVxuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiB2ZXJpZnlBdHRhY2htZW50cyhmaW5pc2gpIHtcblxuXG4gICAgdmFyIGRpZ2VzdHMgPSBbXTtcbiAgICBkb2NJbmZvcy5mb3JFYWNoKGZ1bmN0aW9uIChkb2NJbmZvKSB7XG4gICAgICBpZiAoZG9jSW5mby5kYXRhICYmIGRvY0luZm8uZGF0YS5fYXR0YWNobWVudHMpIHtcbiAgICAgICAgT2JqZWN0LmtleXMoZG9jSW5mby5kYXRhLl9hdHRhY2htZW50cykuZm9yRWFjaChmdW5jdGlvbiAoZmlsZW5hbWUpIHtcbiAgICAgICAgICB2YXIgYXR0ID0gZG9jSW5mby5kYXRhLl9hdHRhY2htZW50c1tmaWxlbmFtZV07XG4gICAgICAgICAgaWYgKGF0dC5zdHViKSB7XG4gICAgICAgICAgICBkaWdlc3RzLnB1c2goYXR0LmRpZ2VzdCk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBpZiAoIWRpZ2VzdHMubGVuZ3RoKSB7XG4gICAgICByZXR1cm4gZmluaXNoKCk7XG4gICAgfVxuICAgIHZhciBudW1Eb25lID0gMDtcbiAgICB2YXIgZXJyO1xuXG4gICAgZnVuY3Rpb24gY2hlY2tEb25lKCkge1xuICAgICAgaWYgKCsrbnVtRG9uZSA9PT0gZGlnZXN0cy5sZW5ndGgpIHtcbiAgICAgICAgZmluaXNoKGVycik7XG4gICAgICB9XG4gICAgfVxuICAgIGRpZ2VzdHMuZm9yRWFjaChmdW5jdGlvbiAoZGlnZXN0KSB7XG4gICAgICB2ZXJpZnlBdHRhY2htZW50KGRpZ2VzdCwgZnVuY3Rpb24gKGF0dEVycikge1xuICAgICAgICBpZiAoYXR0RXJyICYmICFlcnIpIHtcbiAgICAgICAgICBlcnIgPSBhdHRFcnI7XG4gICAgICAgIH1cbiAgICAgICAgY2hlY2tEb25lKCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHdyaXRlRG9jKGRvY0luZm8sIHdpbm5pbmdSZXYsIHdpbm5pbmdSZXZJc0RlbGV0ZWQsIG5ld1JldklzRGVsZXRlZCxcbiAgICAgICAgICAgICAgICAgICAgaXNVcGRhdGUsIGRlbHRhLCByZXN1bHRzSWR4LCBjYWxsYmFjaykge1xuXG4gICAgZG9jSW5mby5tZXRhZGF0YS53aW5uaW5nUmV2ID0gd2lubmluZ1JldjtcbiAgICBkb2NJbmZvLm1ldGFkYXRhLmRlbGV0ZWQgPSB3aW5uaW5nUmV2SXNEZWxldGVkO1xuXG4gICAgdmFyIGRvYyA9IGRvY0luZm8uZGF0YTtcbiAgICBkb2MuX2lkID0gZG9jSW5mby5tZXRhZGF0YS5pZDtcbiAgICBkb2MuX3JldiA9IGRvY0luZm8ubWV0YWRhdGEucmV2O1xuXG4gICAgaWYgKG5ld1JldklzRGVsZXRlZCkge1xuICAgICAgZG9jLl9kZWxldGVkID0gdHJ1ZTtcbiAgICB9XG5cbiAgICB2YXIgaGFzQXR0YWNobWVudHMgPSBkb2MuX2F0dGFjaG1lbnRzICYmXG4gICAgICBPYmplY3Qua2V5cyhkb2MuX2F0dGFjaG1lbnRzKS5sZW5ndGg7XG4gICAgaWYgKGhhc0F0dGFjaG1lbnRzKSB7XG4gICAgICByZXR1cm4gd3JpdGVBdHRhY2htZW50cyhkb2NJbmZvLCB3aW5uaW5nUmV2LCB3aW5uaW5nUmV2SXNEZWxldGVkLFxuICAgICAgICBpc1VwZGF0ZSwgcmVzdWx0c0lkeCwgY2FsbGJhY2spO1xuICAgIH1cblxuICAgIGRvY0NvdW50RGVsdGEgKz0gZGVsdGE7XG4gICAgdXBkYXRlRG9jQ291bnRJZlJlYWR5KCk7XG5cbiAgICBmaW5pc2hEb2MoZG9jSW5mbywgd2lubmluZ1Jldiwgd2lubmluZ1JldklzRGVsZXRlZCxcbiAgICAgIGlzVXBkYXRlLCByZXN1bHRzSWR4LCBjYWxsYmFjayk7XG4gIH1cblxuICBmdW5jdGlvbiBmaW5pc2hEb2MoZG9jSW5mbywgd2lubmluZ1Jldiwgd2lubmluZ1JldklzRGVsZXRlZCxcbiAgICAgICAgICAgICAgICAgICAgIGlzVXBkYXRlLCByZXN1bHRzSWR4LCBjYWxsYmFjaykge1xuXG4gICAgdmFyIGRvYyA9IGRvY0luZm8uZGF0YTtcbiAgICB2YXIgbWV0YWRhdGEgPSBkb2NJbmZvLm1ldGFkYXRhO1xuXG4gICAgZG9jLl9kb2NfaWRfcmV2ID0gbWV0YWRhdGEuaWQgKyAnOjonICsgbWV0YWRhdGEucmV2O1xuICAgIGRlbGV0ZSBkb2MuX2lkO1xuICAgIGRlbGV0ZSBkb2MuX3JldjtcblxuICAgIGZ1bmN0aW9uIGFmdGVyUHV0RG9jKGUpIHtcbiAgICAgIHZhciByZXZzVG9EZWxldGUgPSBkb2NJbmZvLnN0ZW1tZWRSZXZzIHx8IFtdO1xuXG4gICAgICBpZiAoaXNVcGRhdGUgJiYgYXBpLmF1dG9fY29tcGFjdGlvbikge1xuICAgICAgICByZXZzVG9EZWxldGUgPSByZXZzVG9EZWxldGUuY29uY2F0KGNvbXBhY3RUcmVlKGRvY0luZm8ubWV0YWRhdGEpKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHJldnNUb0RlbGV0ZSAmJiByZXZzVG9EZWxldGUubGVuZ3RoKSB7XG4gICAgICAgIGNvbXBhY3RSZXZzKHJldnNUb0RlbGV0ZSwgZG9jSW5mby5tZXRhZGF0YS5pZCwgdHhuKTtcbiAgICAgIH1cblxuICAgICAgbWV0YWRhdGEuc2VxID0gZS50YXJnZXQucmVzdWx0O1xuICAgICAgLy8gQ3VycmVudCBfcmV2IGlzIGNhbGN1bGF0ZWQgZnJvbSBfcmV2X3RyZWUgb24gcmVhZFxuICAgICAgLy8gZGVsZXRlIG1ldGFkYXRhLnJldjtcbiAgICAgIHZhciBtZXRhZGF0YVRvU3RvcmUgPSBlbmNvZGVNZXRhZGF0YShtZXRhZGF0YSwgd2lubmluZ1JldixcbiAgICAgICAgd2lubmluZ1JldklzRGVsZXRlZCk7XG4gICAgICB2YXIgbWV0YURhdGFSZXEgPSBkb2NTdG9yZS5wdXQobWV0YWRhdGFUb1N0b3JlKTtcbiAgICAgIG1ldGFEYXRhUmVxLm9uc3VjY2VzcyA9IGFmdGVyUHV0TWV0YWRhdGE7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWZ0ZXJQdXREb2NFcnJvcihlKSB7XG4gICAgICAvLyBDb25zdHJhaW50RXJyb3IsIG5lZWQgdG8gdXBkYXRlLCBub3QgcHV0IChzZWUgIzE2MzggZm9yIGRldGFpbHMpXG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7IC8vIGF2b2lkIHRyYW5zYWN0aW9uIGFib3J0XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpOyAvLyBhdm9pZCB0cmFuc2FjdGlvbiBvbmVycm9yXG4gICAgICB2YXIgaW5kZXggPSBieVNlcVN0b3JlLmluZGV4KCdfZG9jX2lkX3JldicpO1xuICAgICAgdmFyIGdldEtleVJlcSA9IGluZGV4LmdldEtleShkb2MuX2RvY19pZF9yZXYpO1xuICAgICAgZ2V0S2V5UmVxLm9uc3VjY2VzcyA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICAgIHZhciBwdXRSZXEgPSBieVNlcVN0b3JlLnB1dChkb2MsIGUudGFyZ2V0LnJlc3VsdCk7XG4gICAgICAgIHB1dFJlcS5vbnN1Y2Nlc3MgPSBhZnRlclB1dERvYztcbiAgICAgIH07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWZ0ZXJQdXRNZXRhZGF0YSgpIHtcbiAgICAgIHJlc3VsdHNbcmVzdWx0c0lkeF0gPSB7XG4gICAgICAgIG9rOiB0cnVlLFxuICAgICAgICBpZDogbWV0YWRhdGEuaWQsXG4gICAgICAgIHJldjogbWV0YWRhdGEucmV2XG4gICAgICB9O1xuICAgICAgZmV0Y2hlZERvY3Muc2V0KGRvY0luZm8ubWV0YWRhdGEuaWQsIGRvY0luZm8ubWV0YWRhdGEpO1xuICAgICAgaW5zZXJ0QXR0YWNobWVudE1hcHBpbmdzKGRvY0luZm8sIG1ldGFkYXRhLnNlcSwgY2FsbGJhY2spO1xuICAgIH1cblxuICAgIHZhciBwdXRSZXEgPSBieVNlcVN0b3JlLnB1dChkb2MpO1xuXG4gICAgcHV0UmVxLm9uc3VjY2VzcyA9IGFmdGVyUHV0RG9jO1xuICAgIHB1dFJlcS5vbmVycm9yID0gYWZ0ZXJQdXREb2NFcnJvcjtcbiAgfVxuXG4gIGZ1bmN0aW9uIHdyaXRlQXR0YWNobWVudHMoZG9jSW5mbywgd2lubmluZ1Jldiwgd2lubmluZ1JldklzRGVsZXRlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpc1VwZGF0ZSwgcmVzdWx0c0lkeCwgY2FsbGJhY2spIHtcblxuXG4gICAgdmFyIGRvYyA9IGRvY0luZm8uZGF0YTtcblxuICAgIHZhciBudW1Eb25lID0gMDtcbiAgICB2YXIgYXR0YWNobWVudHMgPSBPYmplY3Qua2V5cyhkb2MuX2F0dGFjaG1lbnRzKTtcblxuICAgIGZ1bmN0aW9uIGNvbGxlY3RSZXN1bHRzKCkge1xuICAgICAgaWYgKG51bURvbmUgPT09IGF0dGFjaG1lbnRzLmxlbmd0aCkge1xuICAgICAgICBmaW5pc2hEb2MoZG9jSW5mbywgd2lubmluZ1Jldiwgd2lubmluZ1JldklzRGVsZXRlZCxcbiAgICAgICAgICBpc1VwZGF0ZSwgcmVzdWx0c0lkeCwgY2FsbGJhY2spO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGF0dGFjaG1lbnRTYXZlZCgpIHtcbiAgICAgIG51bURvbmUrKztcbiAgICAgIGNvbGxlY3RSZXN1bHRzKCk7XG4gICAgfVxuXG4gICAgYXR0YWNobWVudHMuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgICB2YXIgYXR0ID0gZG9jSW5mby5kYXRhLl9hdHRhY2htZW50c1trZXldO1xuICAgICAgaWYgKCFhdHQuc3R1Yikge1xuICAgICAgICB2YXIgZGF0YSA9IGF0dC5kYXRhO1xuICAgICAgICBkZWxldGUgYXR0LmRhdGE7XG4gICAgICAgIGF0dC5yZXZwb3MgPSBwYXJzZUludCh3aW5uaW5nUmV2LCAxMCk7XG4gICAgICAgIHZhciBkaWdlc3QgPSBhdHQuZGlnZXN0O1xuICAgICAgICBzYXZlQXR0YWNobWVudChkaWdlc3QsIGRhdGEsIGF0dGFjaG1lbnRTYXZlZCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBudW1Eb25lKys7XG4gICAgICAgIGNvbGxlY3RSZXN1bHRzKCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvLyBtYXAgc2VxcyB0byBhdHRhY2htZW50IGRpZ2VzdHMsIHdoaWNoXG4gIC8vIHdlIHdpbGwgbmVlZCBsYXRlciBkdXJpbmcgY29tcGFjdGlvblxuICBmdW5jdGlvbiBpbnNlcnRBdHRhY2htZW50TWFwcGluZ3MoZG9jSW5mbywgc2VxLCBjYWxsYmFjaykge1xuXG4gICAgdmFyIGF0dHNBZGRlZCA9IDA7XG4gICAgdmFyIGF0dHNUb0FkZCA9IE9iamVjdC5rZXlzKGRvY0luZm8uZGF0YS5fYXR0YWNobWVudHMgfHwge30pO1xuXG4gICAgaWYgKCFhdHRzVG9BZGQubGVuZ3RoKSB7XG4gICAgICByZXR1cm4gY2FsbGJhY2soKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjaGVja0RvbmUoKSB7XG4gICAgICBpZiAoKythdHRzQWRkZWQgPT09IGF0dHNUb0FkZC5sZW5ndGgpIHtcbiAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhZGQoYXR0KSB7XG4gICAgICB2YXIgZGlnZXN0ID0gZG9jSW5mby5kYXRhLl9hdHRhY2htZW50c1thdHRdLmRpZ2VzdDtcbiAgICAgIHZhciByZXEgPSBhdHRhY2hBbmRTZXFTdG9yZS5wdXQoe1xuICAgICAgICBzZXE6IHNlcSxcbiAgICAgICAgZGlnZXN0U2VxOiBkaWdlc3QgKyAnOjonICsgc2VxXG4gICAgICB9KTtcblxuICAgICAgcmVxLm9uc3VjY2VzcyA9IGNoZWNrRG9uZTtcbiAgICAgIHJlcS5vbmVycm9yID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgLy8gdGhpcyBjYWxsYmFjayBpcyBmb3IgYSBjb25zdGFpbnQgZXJyb3IsIHdoaWNoIHdlIGlnbm9yZVxuICAgICAgICAvLyBiZWNhdXNlIHRoaXMgZG9jaWQvcmV2IGhhcyBhbHJlYWR5IGJlZW4gYXNzb2NpYXRlZCB3aXRoXG4gICAgICAgIC8vIHRoZSBkaWdlc3QgKGUuZy4gd2hlbiBuZXdfZWRpdHMgPT0gZmFsc2UpXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTsgLy8gYXZvaWQgdHJhbnNhY3Rpb24gYWJvcnRcbiAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTsgLy8gYXZvaWQgdHJhbnNhY3Rpb24gb25lcnJvclxuICAgICAgICBjaGVja0RvbmUoKTtcbiAgICAgIH07XG4gICAgfVxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXR0c1RvQWRkLmxlbmd0aDsgaSsrKSB7XG4gICAgICBhZGQoYXR0c1RvQWRkW2ldKTsgLy8gZG8gaW4gcGFyYWxsZWxcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBzYXZlQXR0YWNobWVudChkaWdlc3QsIGRhdGEsIGNhbGxiYWNrKSB7XG5cblxuICAgIHZhciBnZXRLZXlSZXEgPSBhdHRhY2hTdG9yZS5jb3VudChkaWdlc3QpO1xuICAgIGdldEtleVJlcS5vbnN1Y2Nlc3MgPSBmdW5jdGlvbiAoZSkge1xuICAgICAgdmFyIGNvdW50ID0gZS50YXJnZXQucmVzdWx0O1xuICAgICAgaWYgKGNvdW50KSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjaygpOyAvLyBhbHJlYWR5IGV4aXN0c1xuICAgICAgfVxuICAgICAgdmFyIG5ld0F0dCA9IHtcbiAgICAgICAgZGlnZXN0OiBkaWdlc3QsXG4gICAgICAgIGJvZHk6IGRhdGFcbiAgICAgIH07XG4gICAgICB2YXIgcHV0UmVxID0gYXR0YWNoU3RvcmUucHV0KG5ld0F0dCk7XG4gICAgICBwdXRSZXEub25zdWNjZXNzID0gY2FsbGJhY2s7XG4gICAgfTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBpZGJCdWxrRG9jcztcbiIsIi8vIEFic3RyYWN0aW9uIG92ZXIgSURCQ3Vyc29yIGFuZCBnZXRBbGwoKS9nZXRBbGxLZXlzKCkgdGhhdCBhbGxvd3MgdXMgdG8gYmF0Y2ggb3VyIG9wZXJhdGlvbnNcbi8vIHdoaWxlIGZhbGxpbmcgYmFjayB0byBhIG5vcm1hbCBJREJDdXJzb3Igb3BlcmF0aW9uIG9uIGJyb3dzZXJzIHRoYXQgZG9uJ3Qgc3VwcG9ydCBnZXRBbGwoKSBvclxuLy8gZ2V0QWxsS2V5cygpLiBUaGlzIGFsbG93cyBmb3IgYSBtdWNoIGZhc3RlciBpbXBsZW1lbnRhdGlvbiB0aGFuIGp1c3Qgc3RyYWlnaHQtdXAgY3Vyc29ycywgYmVjYXVzZVxuLy8gd2UncmUgbm90IHByb2Nlc3NpbmcgZWFjaCBkb2N1bWVudCBvbmUtYXQtYS10aW1lLlxuZnVuY3Rpb24gcnVuQmF0Y2hlZEN1cnNvcihvYmplY3RTdG9yZSwga2V5UmFuZ2UsIGRlc2NlbmRpbmcsIGJhdGNoU2l6ZSwgb25CYXRjaCkge1xuXG4gIGlmIChiYXRjaFNpemUgPT09IC0xKSB7XG4gICAgYmF0Y2hTaXplID0gMTAwMDtcbiAgfVxuXG4gIC8vIEJhaWwgb3V0IG9mIGdldEFsbCgpL2dldEFsbEtleXMoKSBpbiB0aGUgZm9sbG93aW5nIGNhc2VzOlxuICAvLyAxKSBlaXRoZXIgbWV0aG9kIGlzIHVuc3VwcG9ydGVkIC0gd2UgbmVlZCBib3RoXG4gIC8vIDIpIGJhdGNoU2l6ZSBpcyAxIChtaWdodCBhcyB3ZWxsIHVzZSBJREJDdXJzb3IpXG4gIC8vIDMpIGRlc2NlbmRpbmcg4oCTIG5vIHJlYWwgd2F5IHRvIGRvIHRoaXMgdmlhIGdldEFsbCgpL2dldEFsbEtleXMoKVxuXG4gIHZhciB1c2VHZXRBbGwgPSB0eXBlb2Ygb2JqZWN0U3RvcmUuZ2V0QWxsID09PSAnZnVuY3Rpb24nICYmXG4gICAgdHlwZW9mIG9iamVjdFN0b3JlLmdldEFsbEtleXMgPT09ICdmdW5jdGlvbicgJiZcbiAgICBiYXRjaFNpemUgPiAxICYmICFkZXNjZW5kaW5nO1xuXG4gIHZhciBrZXlzQmF0Y2g7XG4gIHZhciB2YWx1ZXNCYXRjaDtcbiAgdmFyIHBzZXVkb0N1cnNvcjtcblxuICBmdW5jdGlvbiBvbkdldEFsbChlKSB7XG4gICAgdmFsdWVzQmF0Y2ggPSBlLnRhcmdldC5yZXN1bHQ7XG4gICAgaWYgKGtleXNCYXRjaCkge1xuICAgICAgb25CYXRjaChrZXlzQmF0Y2gsIHZhbHVlc0JhdGNoLCBwc2V1ZG9DdXJzb3IpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG9uR2V0QWxsS2V5cyhlKSB7XG4gICAga2V5c0JhdGNoID0gZS50YXJnZXQucmVzdWx0O1xuICAgIGlmICh2YWx1ZXNCYXRjaCkge1xuICAgICAgb25CYXRjaChrZXlzQmF0Y2gsIHZhbHVlc0JhdGNoLCBwc2V1ZG9DdXJzb3IpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGNvbnRpbnVlUHNldWRvQ3Vyc29yKCkge1xuICAgIGlmICgha2V5c0JhdGNoLmxlbmd0aCkgeyAvLyBubyBtb3JlIHJlc3VsdHNcbiAgICAgIHJldHVybiBvbkJhdGNoKCk7XG4gICAgfVxuICAgIC8vIGZldGNoIG5leHQgYmF0Y2gsIGV4Y2x1c2l2ZSBzdGFydFxuICAgIHZhciBsYXN0S2V5ID0ga2V5c0JhdGNoW2tleXNCYXRjaC5sZW5ndGggLSAxXTtcbiAgICB2YXIgbmV3S2V5UmFuZ2U7XG4gICAgaWYgKGtleVJhbmdlICYmIGtleVJhbmdlLnVwcGVyKSB7XG4gICAgICB0cnkge1xuICAgICAgICBuZXdLZXlSYW5nZSA9IElEQktleVJhbmdlLmJvdW5kKGxhc3RLZXksIGtleVJhbmdlLnVwcGVyLFxuICAgICAgICAgIHRydWUsIGtleVJhbmdlLnVwcGVyT3Blbik7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGlmIChlLm5hbWUgPT09IFwiRGF0YUVycm9yXCIgJiYgZS5jb2RlID09PSAwKSB7XG4gICAgICAgICAgcmV0dXJuIG9uQmF0Y2goKTsgLy8gd2UncmUgZG9uZSwgc3RhcnRrZXkgYW5kIGVuZGtleSBhcmUgZXF1YWxcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBuZXdLZXlSYW5nZSA9IElEQktleVJhbmdlLmxvd2VyQm91bmQobGFzdEtleSwgdHJ1ZSk7XG4gICAgfVxuICAgIGtleVJhbmdlID0gbmV3S2V5UmFuZ2U7XG4gICAga2V5c0JhdGNoID0gbnVsbDtcbiAgICB2YWx1ZXNCYXRjaCA9IG51bGw7XG4gICAgb2JqZWN0U3RvcmUuZ2V0QWxsKGtleVJhbmdlLCBiYXRjaFNpemUpLm9uc3VjY2VzcyA9IG9uR2V0QWxsO1xuICAgIG9iamVjdFN0b3JlLmdldEFsbEtleXMoa2V5UmFuZ2UsIGJhdGNoU2l6ZSkub25zdWNjZXNzID0gb25HZXRBbGxLZXlzO1xuICB9XG5cbiAgZnVuY3Rpb24gb25DdXJzb3IoZSkge1xuICAgIHZhciBjdXJzb3IgPSBlLnRhcmdldC5yZXN1bHQ7XG4gICAgaWYgKCFjdXJzb3IpIHsgLy8gZG9uZVxuICAgICAgcmV0dXJuIG9uQmF0Y2goKTtcbiAgICB9XG4gICAgLy8gcmVndWxhciBJREJDdXJzb3IgYWN0cyBsaWtlIGEgYmF0Y2ggd2hlcmUgYmF0Y2ggc2l6ZSBpcyBhbHdheXMgMVxuICAgIG9uQmF0Y2goW2N1cnNvci5rZXldLCBbY3Vyc29yLnZhbHVlXSwgY3Vyc29yKTtcbiAgfVxuXG4gIGlmICh1c2VHZXRBbGwpIHtcbiAgICBwc2V1ZG9DdXJzb3IgPSB7XCJjb250aW51ZVwiOiBjb250aW51ZVBzZXVkb0N1cnNvcn07XG4gICAgb2JqZWN0U3RvcmUuZ2V0QWxsKGtleVJhbmdlLCBiYXRjaFNpemUpLm9uc3VjY2VzcyA9IG9uR2V0QWxsO1xuICAgIG9iamVjdFN0b3JlLmdldEFsbEtleXMoa2V5UmFuZ2UsIGJhdGNoU2l6ZSkub25zdWNjZXNzID0gb25HZXRBbGxLZXlzO1xuICB9IGVsc2UgaWYgKGRlc2NlbmRpbmcpIHtcbiAgICBvYmplY3RTdG9yZS5vcGVuQ3Vyc29yKGtleVJhbmdlLCAncHJldicpLm9uc3VjY2VzcyA9IG9uQ3Vyc29yO1xuICB9IGVsc2Uge1xuICAgIG9iamVjdFN0b3JlLm9wZW5DdXJzb3Ioa2V5UmFuZ2UpLm9uc3VjY2VzcyA9IG9uQ3Vyc29yO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IHJ1bkJhdGNoZWRDdXJzb3I7IiwiLy8gc2ltcGxlIHNoaW0gZm9yIG9iamVjdFN0b3JlLmdldEFsbCgpLCBmYWxsaW5nIGJhY2sgdG8gSURCQ3Vyc29yXG5mdW5jdGlvbiBnZXRBbGwob2JqZWN0U3RvcmUsIGtleVJhbmdlLCBvblN1Y2Nlc3MpIHtcbiAgaWYgKHR5cGVvZiBvYmplY3RTdG9yZS5nZXRBbGwgPT09ICdmdW5jdGlvbicpIHtcbiAgICAvLyB1c2UgbmF0aXZlIGdldEFsbFxuICAgIG9iamVjdFN0b3JlLmdldEFsbChrZXlSYW5nZSkub25zdWNjZXNzID0gb25TdWNjZXNzO1xuICAgIHJldHVybjtcbiAgfVxuICAvLyBmYWxsIGJhY2sgdG8gY3Vyc29yc1xuICB2YXIgdmFsdWVzID0gW107XG5cbiAgZnVuY3Rpb24gb25DdXJzb3IoZSkge1xuICAgIHZhciBjdXJzb3IgPSBlLnRhcmdldC5yZXN1bHQ7XG4gICAgaWYgKGN1cnNvcikge1xuICAgICAgdmFsdWVzLnB1c2goY3Vyc29yLnZhbHVlKTtcbiAgICAgIGN1cnNvci5jb250aW51ZSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBvblN1Y2Nlc3Moe1xuICAgICAgICB0YXJnZXQ6IHtcbiAgICAgICAgICByZXN1bHQ6IHZhbHVlc1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBvYmplY3RTdG9yZS5vcGVuQ3Vyc29yKGtleVJhbmdlKS5vbnN1Y2Nlc3MgPSBvbkN1cnNvcjtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZ2V0QWxsOyIsImltcG9ydCB7IGNyZWF0ZUVycm9yLCBJREJfRVJST1IgfSBmcm9tICdwb3VjaGRiLWVycm9ycyc7XG5pbXBvcnQgeyBjb2xsZWN0Q29uZmxpY3RzIH0gZnJvbSAncG91Y2hkYi1tZXJnZSc7XG5pbXBvcnQge1xuICBBVFRBQ0hfU1RPUkUsXG4gIEJZX1NFUV9TVE9SRSxcbiAgRE9DX1NUT1JFLFxuICBNRVRBX1NUT1JFXG59IGZyb20gJy4vY29uc3RhbnRzJztcbmltcG9ydCB7XG4gIGRlY29kZURvYyxcbiAgZGVjb2RlTWV0YWRhdGEsXG4gIGZldGNoQXR0YWNobWVudHNJZk5lY2Vzc2FyeSxcbiAgcG9zdFByb2Nlc3NBdHRhY2htZW50cyxcbiAgb3BlblRyYW5zYWN0aW9uU2FmZWx5LFxuICBpZGJFcnJvclxufSBmcm9tICcuL3V0aWxzJztcbmltcG9ydCBydW5CYXRjaGVkQ3Vyc29yIGZyb20gJy4vcnVuQmF0Y2hlZEN1cnNvcic7XG5pbXBvcnQgZ2V0QWxsIGZyb20gJy4vZ2V0QWxsJztcblxuZnVuY3Rpb24gYWxsRG9jc0tleXMoa2V5cywgZG9jU3RvcmUsIG9uQmF0Y2gpIHtcbiAgLy8gSXQncyBub3QgZ3VhcmFudGVkIHRvIGJlIHJldHVybmVkIGluIHJpZ2h0IG9yZGVyICBcbiAgdmFyIHZhbHVlc0JhdGNoID0gbmV3IEFycmF5KGtleXMubGVuZ3RoKTtcbiAgdmFyIGNvdW50ID0gMDtcbiAga2V5cy5mb3JFYWNoKGZ1bmN0aW9uIChrZXksIGluZGV4KSB7XG4gICAgZG9jU3RvcmUuZ2V0KGtleSkub25zdWNjZXNzID0gZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICBpZiAoZXZlbnQudGFyZ2V0LnJlc3VsdCkge1xuICAgICAgICB2YWx1ZXNCYXRjaFtpbmRleF0gPSBldmVudC50YXJnZXQucmVzdWx0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFsdWVzQmF0Y2hbaW5kZXhdID0ge2tleToga2V5LCBlcnJvcjogJ25vdF9mb3VuZCd9O1xuICAgICAgfVxuICAgICAgY291bnQrKztcbiAgICAgIGlmIChjb3VudCA9PT0ga2V5cy5sZW5ndGgpIHtcbiAgICAgICAgb25CYXRjaChrZXlzLCB2YWx1ZXNCYXRjaCwge30pO1xuICAgICAgfVxuICAgIH07XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVLZXlSYW5nZShzdGFydCwgZW5kLCBpbmNsdXNpdmVFbmQsIGtleSwgZGVzY2VuZGluZykge1xuICB0cnkge1xuICAgIGlmIChzdGFydCAmJiBlbmQpIHtcbiAgICAgIGlmIChkZXNjZW5kaW5nKSB7XG4gICAgICAgIHJldHVybiBJREJLZXlSYW5nZS5ib3VuZChlbmQsIHN0YXJ0LCAhaW5jbHVzaXZlRW5kLCBmYWxzZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gSURCS2V5UmFuZ2UuYm91bmQoc3RhcnQsIGVuZCwgZmFsc2UsICFpbmNsdXNpdmVFbmQpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoc3RhcnQpIHtcbiAgICAgIGlmIChkZXNjZW5kaW5nKSB7XG4gICAgICAgIHJldHVybiBJREJLZXlSYW5nZS51cHBlckJvdW5kKHN0YXJ0KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBJREJLZXlSYW5nZS5sb3dlckJvdW5kKHN0YXJ0KTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGVuZCkge1xuICAgICAgaWYgKGRlc2NlbmRpbmcpIHtcbiAgICAgICAgcmV0dXJuIElEQktleVJhbmdlLmxvd2VyQm91bmQoZW5kLCAhaW5jbHVzaXZlRW5kKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBJREJLZXlSYW5nZS51cHBlckJvdW5kKGVuZCwgIWluY2x1c2l2ZUVuZCk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChrZXkpIHtcbiAgICAgIHJldHVybiBJREJLZXlSYW5nZS5vbmx5KGtleSk7XG4gICAgfVxuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIHtlcnJvcjogZX07XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIGlkYkFsbERvY3Mob3B0cywgaWRiLCBjYWxsYmFjaykge1xuICB2YXIgc3RhcnQgPSAnc3RhcnRrZXknIGluIG9wdHMgPyBvcHRzLnN0YXJ0a2V5IDogZmFsc2U7XG4gIHZhciBlbmQgPSAnZW5ka2V5JyBpbiBvcHRzID8gb3B0cy5lbmRrZXkgOiBmYWxzZTtcbiAgdmFyIGtleSA9ICdrZXknIGluIG9wdHMgPyBvcHRzLmtleSA6IGZhbHNlO1xuICB2YXIga2V5cyA9ICdrZXlzJyBpbiBvcHRzID8gb3B0cy5rZXlzIDogZmFsc2U7IFxuICB2YXIgc2tpcCA9IG9wdHMuc2tpcCB8fCAwO1xuICB2YXIgbGltaXQgPSB0eXBlb2Ygb3B0cy5saW1pdCA9PT0gJ251bWJlcicgPyBvcHRzLmxpbWl0IDogLTE7XG4gIHZhciBpbmNsdXNpdmVFbmQgPSBvcHRzLmluY2x1c2l2ZV9lbmQgIT09IGZhbHNlO1xuXG4gIHZhciBrZXlSYW5nZSA7IFxuICB2YXIga2V5UmFuZ2VFcnJvcjtcbiAgaWYgKCFrZXlzKSB7XG4gICAga2V5UmFuZ2UgPSBjcmVhdGVLZXlSYW5nZShzdGFydCwgZW5kLCBpbmNsdXNpdmVFbmQsIGtleSwgb3B0cy5kZXNjZW5kaW5nKTtcbiAgICBrZXlSYW5nZUVycm9yID0ga2V5UmFuZ2UgJiYga2V5UmFuZ2UuZXJyb3I7XG4gICAgaWYgKGtleVJhbmdlRXJyb3IgJiYgXG4gICAgICAhKGtleVJhbmdlRXJyb3IubmFtZSA9PT0gXCJEYXRhRXJyb3JcIiAmJiBrZXlSYW5nZUVycm9yLmNvZGUgPT09IDApKSB7XG4gICAgICAvLyBEYXRhRXJyb3Igd2l0aCBlcnJvciBjb2RlIDAgaW5kaWNhdGVzIHN0YXJ0IGlzIGxlc3MgdGhhbiBlbmQsIHNvXG4gICAgICAvLyBjYW4ganVzdCBkbyBhbiBlbXB0eSBxdWVyeS4gRWxzZSBuZWVkIHRvIHRocm93XG4gICAgICByZXR1cm4gY2FsbGJhY2soY3JlYXRlRXJyb3IoSURCX0VSUk9SLFxuICAgICAgICBrZXlSYW5nZUVycm9yLm5hbWUsIGtleVJhbmdlRXJyb3IubWVzc2FnZSkpO1xuICAgIH1cbiAgfVxuXG4gIHZhciBzdG9yZXMgPSBbRE9DX1NUT1JFLCBCWV9TRVFfU1RPUkUsIE1FVEFfU1RPUkVdO1xuXG4gIGlmIChvcHRzLmF0dGFjaG1lbnRzKSB7XG4gICAgc3RvcmVzLnB1c2goQVRUQUNIX1NUT1JFKTtcbiAgfVxuICB2YXIgdHhuUmVzdWx0ID0gb3BlblRyYW5zYWN0aW9uU2FmZWx5KGlkYiwgc3RvcmVzLCAncmVhZG9ubHknKTtcbiAgaWYgKHR4blJlc3VsdC5lcnJvcikge1xuICAgIHJldHVybiBjYWxsYmFjayh0eG5SZXN1bHQuZXJyb3IpO1xuICB9XG4gIHZhciB0eG4gPSB0eG5SZXN1bHQudHhuO1xuICB0eG4ub25jb21wbGV0ZSA9IG9uVHhuQ29tcGxldGU7XG4gIHR4bi5vbmFib3J0ID0gaWRiRXJyb3IoY2FsbGJhY2spO1xuICB2YXIgZG9jU3RvcmUgPSB0eG4ub2JqZWN0U3RvcmUoRE9DX1NUT1JFKTtcbiAgdmFyIHNlcVN0b3JlID0gdHhuLm9iamVjdFN0b3JlKEJZX1NFUV9TVE9SRSk7XG4gIHZhciBtZXRhU3RvcmUgPSB0eG4ub2JqZWN0U3RvcmUoTUVUQV9TVE9SRSk7XG4gIHZhciBkb2NJZFJldkluZGV4ID0gc2VxU3RvcmUuaW5kZXgoJ19kb2NfaWRfcmV2Jyk7XG4gIHZhciByZXN1bHRzID0gW107XG4gIHZhciBkb2NDb3VudDtcbiAgdmFyIHVwZGF0ZVNlcTtcblxuICBtZXRhU3RvcmUuZ2V0KE1FVEFfU1RPUkUpLm9uc3VjY2VzcyA9IGZ1bmN0aW9uIChlKSB7XG4gICAgZG9jQ291bnQgPSBlLnRhcmdldC5yZXN1bHQuZG9jQ291bnQ7XG4gIH07XG5cbiAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gIGlmIChvcHRzLnVwZGF0ZV9zZXEpIHtcbiAgICBnZXRNYXhVcGRhdGVTZXEoc2VxU3RvcmUsIGZ1bmN0aW9uIChlKSB7IFxuICAgICAgaWYgKGUudGFyZ2V0LnJlc3VsdCAmJiBlLnRhcmdldC5yZXN1bHQubGVuZ3RoID4gMCkge1xuICAgICAgICB1cGRhdGVTZXEgPSBlLnRhcmdldC5yZXN1bHRbMF07XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBnZXRNYXhVcGRhdGVTZXEob2JqZWN0U3RvcmUsIG9uU3VjY2Vzcykge1xuICAgIGZ1bmN0aW9uIG9uQ3Vyc29yKGUpIHtcbiAgICAgIHZhciBjdXJzb3IgPSBlLnRhcmdldC5yZXN1bHQ7XG4gICAgICB2YXIgbWF4S2V5ID0gdW5kZWZpbmVkO1xuICAgICAgaWYgKGN1cnNvciAmJiBjdXJzb3Iua2V5KSB7XG4gICAgICAgIG1heEtleSA9IGN1cnNvci5rZXk7XG4gICAgICB9IFxuICAgICAgcmV0dXJuIG9uU3VjY2Vzcyh7XG4gICAgICAgIHRhcmdldDoge1xuICAgICAgICAgIHJlc3VsdDogW21heEtleV1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICAgIG9iamVjdFN0b3JlLm9wZW5DdXJzb3IobnVsbCwgJ3ByZXYnKS5vbnN1Y2Nlc3MgPSBvbkN1cnNvcjtcbiAgfVxuXG4gIC8vIGlmIHRoZSB1c2VyIHNwZWNpZmllcyBpbmNsdWRlX2RvY3M9dHJ1ZSwgdGhlbiB3ZSBkb24ndFxuICAvLyB3YW50IHRvIGJsb2NrIHRoZSBtYWluIGN1cnNvciB3aGlsZSB3ZSdyZSBmZXRjaGluZyB0aGUgZG9jXG4gIGZ1bmN0aW9uIGZldGNoRG9jQXN5bmNocm9ub3VzbHkobWV0YWRhdGEsIHJvdywgd2lubmluZ1Jldikge1xuICAgIHZhciBrZXkgPSBtZXRhZGF0YS5pZCArIFwiOjpcIiArIHdpbm5pbmdSZXY7XG4gICAgZG9jSWRSZXZJbmRleC5nZXQoa2V5KS5vbnN1Y2Nlc3MgPSAgZnVuY3Rpb24gb25HZXREb2MoZSkge1xuICAgICAgcm93LmRvYyA9IGRlY29kZURvYyhlLnRhcmdldC5yZXN1bHQpIHx8IHt9O1xuICAgICAgaWYgKG9wdHMuY29uZmxpY3RzKSB7XG4gICAgICAgIHZhciBjb25mbGljdHMgPSBjb2xsZWN0Q29uZmxpY3RzKG1ldGFkYXRhKTtcbiAgICAgICAgaWYgKGNvbmZsaWN0cy5sZW5ndGgpIHtcbiAgICAgICAgICByb3cuZG9jLl9jb25mbGljdHMgPSBjb25mbGljdHM7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGZldGNoQXR0YWNobWVudHNJZk5lY2Vzc2FyeShyb3cuZG9jLCBvcHRzLCB0eG4pO1xuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiBhbGxEb2NzSW5uZXIod2lubmluZ1JldiwgbWV0YWRhdGEpIHtcbiAgICB2YXIgcm93ID0ge1xuICAgICAgaWQ6IG1ldGFkYXRhLmlkLFxuICAgICAga2V5OiBtZXRhZGF0YS5pZCxcbiAgICAgIHZhbHVlOiB7XG4gICAgICAgIHJldjogd2lubmluZ1JldlxuICAgICAgfVxuICAgIH07XG4gICAgdmFyIGRlbGV0ZWQgPSBtZXRhZGF0YS5kZWxldGVkO1xuICAgIGlmIChkZWxldGVkKSB7XG4gICAgICBpZiAoa2V5cykge1xuICAgICAgICByZXN1bHRzLnB1c2gocm93KTtcbiAgICAgICAgLy8gZGVsZXRlZCBkb2NzIGFyZSBva2F5IHdpdGggXCJrZXlzXCIgcmVxdWVzdHNcbiAgICAgICAgcm93LnZhbHVlLmRlbGV0ZWQgPSB0cnVlO1xuICAgICAgICByb3cuZG9jID0gbnVsbDtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHNraXAtLSA8PSAwKSB7XG4gICAgICByZXN1bHRzLnB1c2gocm93KTtcbiAgICAgIGlmIChvcHRzLmluY2x1ZGVfZG9jcykge1xuICAgICAgICBmZXRjaERvY0FzeW5jaHJvbm91c2x5KG1ldGFkYXRhLCByb3csIHdpbm5pbmdSZXYpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHByb2Nlc3NCYXRjaChiYXRjaFZhbHVlcykge1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBiYXRjaFZhbHVlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgaWYgKHJlc3VsdHMubGVuZ3RoID09PSBsaW1pdCkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIHZhciBiYXRjaFZhbHVlID0gYmF0Y2hWYWx1ZXNbaV07XG4gICAgICBpZiAoYmF0Y2hWYWx1ZS5lcnJvciAmJiBrZXlzKSB7XG4gICAgICAgIC8vIGtleSB3YXMgbm90IGZvdW5kIHdpdGggXCJrZXlzXCIgcmVxdWVzdHNcbiAgICAgICAgcmVzdWx0cy5wdXNoKGJhdGNoVmFsdWUpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIHZhciBtZXRhZGF0YSA9IGRlY29kZU1ldGFkYXRhKGJhdGNoVmFsdWUpO1xuICAgICAgdmFyIHdpbm5pbmdSZXYgPSBtZXRhZGF0YS53aW5uaW5nUmV2O1xuICAgICAgYWxsRG9jc0lubmVyKHdpbm5pbmdSZXYsIG1ldGFkYXRhKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBvbkJhdGNoKGJhdGNoS2V5cywgYmF0Y2hWYWx1ZXMsIGN1cnNvcikge1xuICAgIGlmICghY3Vyc29yKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHByb2Nlc3NCYXRjaChiYXRjaFZhbHVlcyk7XG4gICAgaWYgKHJlc3VsdHMubGVuZ3RoIDwgbGltaXQpIHtcbiAgICAgIGN1cnNvci5jb250aW51ZSgpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG9uR2V0QWxsKGUpIHtcbiAgICB2YXIgdmFsdWVzID0gZS50YXJnZXQucmVzdWx0O1xuICAgIGlmIChvcHRzLmRlc2NlbmRpbmcpIHtcbiAgICAgIHZhbHVlcyA9IHZhbHVlcy5yZXZlcnNlKCk7XG4gICAgfVxuICAgIHByb2Nlc3NCYXRjaCh2YWx1ZXMpO1xuICB9XG5cbiAgZnVuY3Rpb24gb25SZXN1bHRzUmVhZHkoKSB7XG4gICAgdmFyIHJldHVyblZhbCA9IHtcbiAgICAgIHRvdGFsX3Jvd3M6IGRvY0NvdW50LFxuICAgICAgb2Zmc2V0OiBvcHRzLnNraXAsXG4gICAgICByb3dzOiByZXN1bHRzXG4gICAgfTtcbiAgICBcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICBpZiAob3B0cy51cGRhdGVfc2VxICYmIHVwZGF0ZVNlcSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm5WYWwudXBkYXRlX3NlcSA9IHVwZGF0ZVNlcTtcbiAgICB9XG4gICAgY2FsbGJhY2sobnVsbCwgcmV0dXJuVmFsKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG9uVHhuQ29tcGxldGUoKSB7XG4gICAgaWYgKG9wdHMuYXR0YWNobWVudHMpIHtcbiAgICAgIHBvc3RQcm9jZXNzQXR0YWNobWVudHMocmVzdWx0cywgb3B0cy5iaW5hcnkpLnRoZW4ob25SZXN1bHRzUmVhZHkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBvblJlc3VsdHNSZWFkeSgpO1xuICAgIH1cbiAgfVxuXG4gIC8vIGRvbid0IGJvdGhlciBkb2luZyBhbnkgcmVxdWVzdHMgaWYgc3RhcnQgPiBlbmQgb3IgbGltaXQgPT09IDBcbiAgaWYgKGtleVJhbmdlRXJyb3IgfHwgbGltaXQgPT09IDApIHtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKGtleXMpIHtcbiAgICByZXR1cm4gYWxsRG9jc0tleXMoa2V5cywgZG9jU3RvcmUsIG9uQmF0Y2gpO1xuICB9XG4gIGlmIChsaW1pdCA9PT0gLTEpIHsgLy8ganVzdCBmZXRjaCBldmVyeXRoaW5nXG4gICAgcmV0dXJuIGdldEFsbChkb2NTdG9yZSwga2V5UmFuZ2UsIG9uR2V0QWxsKTtcbiAgfVxuICAvLyBlbHNlIGRvIGEgY3Vyc29yXG4gIC8vIGNob29zZSBhIGJhdGNoIHNpemUgYmFzZWQgb24gdGhlIHNraXAsIHNpbmNlIHdlJ2xsIG5lZWQgdG8gc2tpcCB0aGF0IG1hbnlcbiAgcnVuQmF0Y2hlZEN1cnNvcihkb2NTdG9yZSwga2V5UmFuZ2UsIG9wdHMuZGVzY2VuZGluZywgbGltaXQgKyBza2lwLCBvbkJhdGNoKTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgaWRiQWxsRG9jczsiLCJpbXBvcnQgeyBibG9iIGFzIGNyZWF0ZUJsb2IgfSBmcm9tICdwb3VjaGRiLWJpbmFyeS11dGlscyc7XG5pbXBvcnQgeyBERVRFQ1RfQkxPQl9TVVBQT1JUX1NUT1JFIH0gZnJvbSAnLi9jb25zdGFudHMnO1xuXG4vL1xuLy8gQmxvYnMgYXJlIG5vdCBzdXBwb3J0ZWQgaW4gYWxsIHZlcnNpb25zIG9mIEluZGV4ZWREQiwgbm90YWJseVxuLy8gQ2hyb21lIDwzNyBhbmQgQW5kcm9pZCA8NS4gSW4gdGhvc2UgdmVyc2lvbnMsIHN0b3JpbmcgYSBibG9iIHdpbGwgdGhyb3cuXG4vL1xuLy8gVmFyaW91cyBvdGhlciBibG9iIGJ1Z3MgZXhpc3QgaW4gQ2hyb21lIHYzNy00MiAoaW5jbHVzaXZlKS5cbi8vIERldGVjdGluZyB0aGVtIGlzIGV4cGVuc2l2ZSBhbmQgY29uZnVzaW5nIHRvIHVzZXJzLCBhbmQgQ2hyb21lIDM3LTQyXG4vLyBpcyBhdCB2ZXJ5IGxvdyB1c2FnZSB3b3JsZHdpZGUsIHNvIHdlIGRvIGEgaGFja3kgdXNlckFnZW50IGNoZWNrIGluc3RlYWQuXG4vL1xuLy8gY29udGVudC10eXBlIGJ1ZzogaHR0cHM6Ly9jb2RlLmdvb2dsZS5jb20vcC9jaHJvbWl1bS9pc3N1ZXMvZGV0YWlsP2lkPTQwODEyMFxuLy8gNDA0IGJ1ZzogaHR0cHM6Ly9jb2RlLmdvb2dsZS5jb20vcC9jaHJvbWl1bS9pc3N1ZXMvZGV0YWlsP2lkPTQ0NzkxNlxuLy8gRmlsZVJlYWRlciBidWc6IGh0dHBzOi8vY29kZS5nb29nbGUuY29tL3AvY2hyb21pdW0vaXNzdWVzL2RldGFpbD9pZD00NDc4MzZcbi8vXG5mdW5jdGlvbiBjaGVja0Jsb2JTdXBwb3J0KHR4bikge1xuICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUpIHtcbiAgICB2YXIgYmxvYiA9IGNyZWF0ZUJsb2IoWycnXSk7XG4gICAgdmFyIHJlcSA9IHR4bi5vYmplY3RTdG9yZShERVRFQ1RfQkxPQl9TVVBQT1JUX1NUT1JFKS5wdXQoYmxvYiwgJ2tleScpO1xuXG4gICAgcmVxLm9uc3VjY2VzcyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciBtYXRjaGVkQ2hyb21lID0gbmF2aWdhdG9yLnVzZXJBZ2VudC5tYXRjaCgvQ2hyb21lXFwvKFxcZCspLyk7XG4gICAgICB2YXIgbWF0Y2hlZEVkZ2UgPSBuYXZpZ2F0b3IudXNlckFnZW50Lm1hdGNoKC9FZGdlXFwvLyk7XG4gICAgICAvLyBNUyBFZGdlIHByZXRlbmRzIHRvIGJlIENocm9tZSA0MjpcbiAgICAgIC8vIGh0dHBzOi8vbXNkbi5taWNyb3NvZnQuY29tL2VuLXVzL2xpYnJhcnkvaGg4NjkzMDElMjh2PXZzLjg1JTI5LmFzcHhcbiAgICAgIHJlc29sdmUobWF0Y2hlZEVkZ2UgfHwgIW1hdGNoZWRDaHJvbWUgfHxcbiAgICAgICAgcGFyc2VJbnQobWF0Y2hlZENocm9tZVsxXSwgMTApID49IDQzKTtcbiAgICB9O1xuXG4gICAgcmVxLm9uZXJyb3IgPSB0eG4ub25hYm9ydCA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICAvLyBJZiB0aGUgdHJhbnNhY3Rpb24gYWJvcnRzIG5vdyBpdHMgZHVlIHRvIG5vdCBiZWluZyBhYmxlIHRvXG4gICAgICAvLyB3cml0ZSB0byB0aGUgZGF0YWJhc2UsIGxpa2VseSBkdWUgdG8gdGhlIGRpc2sgYmVpbmcgZnVsbFxuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgIHJlc29sdmUoZmFsc2UpO1xuICAgIH07XG4gIH0pLmNhdGNoKGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gZmFsc2U7IC8vIGVycm9yLCBzbyBhc3N1bWUgdW5zdXBwb3J0ZWRcbiAgfSk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNoZWNrQmxvYlN1cHBvcnQ7XG4iLCJpbXBvcnQgeyBET0NfU1RPUkUgfSBmcm9tICcuL2NvbnN0YW50cyc7XG5cbmZ1bmN0aW9uIGNvdW50RG9jcyh0eG4sIGNiKSB7XG4gIHZhciBpbmRleCA9IHR4bi5vYmplY3RTdG9yZShET0NfU1RPUkUpLmluZGV4KCdkZWxldGVkT3JMb2NhbCcpO1xuICBpbmRleC5jb3VudChJREJLZXlSYW5nZS5vbmx5KCcwJykpLm9uc3VjY2VzcyA9IGZ1bmN0aW9uIChlKSB7XG4gICAgY2IoZS50YXJnZXQucmVzdWx0KTtcbiAgfTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgY291bnREb2NzO1xuIiwiLy8gVGhpcyB0YXNrIHF1ZXVlIGVuc3VyZXMgdGhhdCBJREIgb3BlbiBjYWxscyBhcmUgZG9uZSBpbiB0aGVpciBvd24gdGlja1xuLy8gYW5kIHNlcXVlbnRpYWxseSAtIGkuZS4gd2Ugd2FpdCBmb3IgdGhlIGFzeW5jIElEQiBvcGVuIHRvICpmdWxseSogY29tcGxldGVcbi8vIGJlZm9yZSBjYWxsaW5nIHRoZSBuZXh0IG9uZS4gVGhpcyB3b3JrcyBhcm91bmQgSUUvRWRnZSByYWNlIGNvbmRpdGlvbnMgaW4gSURCLlxuXG5pbXBvcnQgeyBuZXh0VGljayB9IGZyb20gJ3BvdWNoZGItdXRpbHMnO1xuXG52YXIgcnVubmluZyA9IGZhbHNlO1xudmFyIHF1ZXVlID0gW107XG5cbmZ1bmN0aW9uIHRyeUNvZGUoZnVuLCBlcnIsIHJlcywgUG91Y2hEQikge1xuICB0cnkge1xuICAgIGZ1bihlcnIsIHJlcyk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIC8vIFNob3VsZG4ndCBoYXBwZW4sIGJ1dCBpbiBzb21lIG9kZCBjYXNlc1xuICAgIC8vIEluZGV4ZWREQiBpbXBsZW1lbnRhdGlvbnMgbWlnaHQgdGhyb3cgYSBzeW5jXG4gICAgLy8gZXJyb3IsIGluIHdoaWNoIGNhc2UgdGhpcyB3aWxsIGF0IGxlYXN0IGxvZyBpdC5cbiAgICBQb3VjaERCLmVtaXQoJ2Vycm9yJywgZXJyKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBhcHBseU5leHQoKSB7XG4gIGlmIChydW5uaW5nIHx8ICFxdWV1ZS5sZW5ndGgpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgcnVubmluZyA9IHRydWU7XG4gIHF1ZXVlLnNoaWZ0KCkoKTtcbn1cblxuZnVuY3Rpb24gZW5xdWV1ZVRhc2soYWN0aW9uLCBjYWxsYmFjaywgUG91Y2hEQikge1xuICBxdWV1ZS5wdXNoKGZ1bmN0aW9uIHJ1bkFjdGlvbigpIHtcbiAgICBhY3Rpb24oZnVuY3Rpb24gcnVuQ2FsbGJhY2soZXJyLCByZXMpIHtcbiAgICAgIHRyeUNvZGUoY2FsbGJhY2ssIGVyciwgcmVzLCBQb3VjaERCKTtcbiAgICAgIHJ1bm5pbmcgPSBmYWxzZTtcbiAgICAgIG5leHRUaWNrKGZ1bmN0aW9uIHJ1bk5leHQoKSB7XG4gICAgICAgIGFwcGx5TmV4dChQb3VjaERCKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9KTtcbiAgYXBwbHlOZXh0KCk7XG59XG5cbmV4cG9ydCB7XG4gIGVucXVldWVUYXNrLFxufTsiLCJpbXBvcnQgY2hhbmdlc0hhbmRsZXIgZnJvbSAnLi9jaGFuZ2VzSGFuZGxlcic7XG5pbXBvcnQge1xuICBjbG9uZSxcbiAgZmlsdGVyQ2hhbmdlLFxuICB1dWlkXG59IGZyb20gJ3BvdWNoZGItdXRpbHMnO1xuaW1wb3J0IHtcbiAgQVRUQUNIX1NUT1JFLFxuICBCWV9TRVFfU1RPUkUsXG4gIERPQ19TVE9SRVxufSBmcm9tICcuL2NvbnN0YW50cyc7XG5pbXBvcnQge1xuICBkZWNvZGVEb2MsXG4gIGRlY29kZU1ldGFkYXRhLFxuICBmZXRjaEF0dGFjaG1lbnRzSWZOZWNlc3NhcnksXG4gIGlkYkVycm9yLFxuICBwb3N0UHJvY2Vzc0F0dGFjaG1lbnRzLFxuICBvcGVuVHJhbnNhY3Rpb25TYWZlbHlcbn0gZnJvbSAnLi91dGlscyc7XG5pbXBvcnQgcnVuQmF0Y2hlZEN1cnNvciBmcm9tICcuL3J1bkJhdGNoZWRDdXJzb3InO1xuXG5mdW5jdGlvbiBjaGFuZ2VzKG9wdHMsIGFwaSwgZGJOYW1lLCBpZGIpIHtcbiAgb3B0cyA9IGNsb25lKG9wdHMpO1xuXG4gIGlmIChvcHRzLmNvbnRpbnVvdXMpIHtcbiAgICB2YXIgaWQgPSBkYk5hbWUgKyAnOicgKyB1dWlkKCk7XG4gICAgY2hhbmdlc0hhbmRsZXIuYWRkTGlzdGVuZXIoZGJOYW1lLCBpZCwgYXBpLCBvcHRzKTtcbiAgICBjaGFuZ2VzSGFuZGxlci5ub3RpZnkoZGJOYW1lKTtcbiAgICByZXR1cm4ge1xuICAgICAgY2FuY2VsOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNoYW5nZXNIYW5kbGVyLnJlbW92ZUxpc3RlbmVyKGRiTmFtZSwgaWQpO1xuICAgICAgfVxuICAgIH07XG4gIH1cblxuICB2YXIgZG9jSWRzID0gb3B0cy5kb2NfaWRzICYmIG5ldyBTZXQob3B0cy5kb2NfaWRzKTtcblxuICBvcHRzLnNpbmNlID0gb3B0cy5zaW5jZSB8fCAwO1xuICB2YXIgbGFzdFNlcSA9IG9wdHMuc2luY2U7XG5cbiAgdmFyIGxpbWl0ID0gJ2xpbWl0JyBpbiBvcHRzID8gb3B0cy5saW1pdCA6IC0xO1xuICBpZiAobGltaXQgPT09IDApIHtcbiAgICBsaW1pdCA9IDE7IC8vIHBlciBDb3VjaERCIF9jaGFuZ2VzIHNwZWNcbiAgfVxuXG4gIHZhciByZXN1bHRzID0gW107XG4gIHZhciBudW1SZXN1bHRzID0gMDtcbiAgdmFyIGZpbHRlciA9IGZpbHRlckNoYW5nZShvcHRzKTtcbiAgdmFyIGRvY0lkc1RvTWV0YWRhdGEgPSBuZXcgTWFwKCk7XG5cbiAgdmFyIHR4bjtcbiAgdmFyIGJ5U2VxU3RvcmU7XG4gIHZhciBkb2NTdG9yZTtcbiAgdmFyIGRvY0lkUmV2SW5kZXg7XG5cbiAgZnVuY3Rpb24gb25CYXRjaChiYXRjaEtleXMsIGJhdGNoVmFsdWVzLCBjdXJzb3IpIHtcbiAgICBpZiAoIWN1cnNvciB8fCAhYmF0Y2hLZXlzLmxlbmd0aCkgeyAvLyBkb25lXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIHdpbm5pbmdEb2NzID0gbmV3IEFycmF5KGJhdGNoS2V5cy5sZW5ndGgpO1xuICAgIHZhciBtZXRhZGF0YXMgPSBuZXcgQXJyYXkoYmF0Y2hLZXlzLmxlbmd0aCk7XG5cbiAgICBmdW5jdGlvbiBwcm9jZXNzTWV0YWRhdGFBbmRXaW5uaW5nRG9jKG1ldGFkYXRhLCB3aW5uaW5nRG9jKSB7XG4gICAgICB2YXIgY2hhbmdlID0gb3B0cy5wcm9jZXNzQ2hhbmdlKHdpbm5pbmdEb2MsIG1ldGFkYXRhLCBvcHRzKTtcbiAgICAgIGxhc3RTZXEgPSBjaGFuZ2Uuc2VxID0gbWV0YWRhdGEuc2VxO1xuXG4gICAgICB2YXIgZmlsdGVyZWQgPSBmaWx0ZXIoY2hhbmdlKTtcbiAgICAgIGlmICh0eXBlb2YgZmlsdGVyZWQgPT09ICdvYmplY3QnKSB7IC8vIGFueXRoaW5nIGJ1dCB0cnVlL2ZhbHNlIGluZGljYXRlcyBlcnJvclxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZmlsdGVyZWQpO1xuICAgICAgfVxuXG4gICAgICBpZiAoIWZpbHRlcmVkKSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgICAgIH1cbiAgICAgIG51bVJlc3VsdHMrKztcbiAgICAgIGlmIChvcHRzLnJldHVybl9kb2NzKSB7XG4gICAgICAgIHJlc3VsdHMucHVzaChjaGFuZ2UpO1xuICAgICAgfVxuICAgICAgLy8gcHJvY2VzcyB0aGUgYXR0YWNobWVudCBpbW1lZGlhdGVseVxuICAgICAgLy8gZm9yIHRoZSBiZW5lZml0IG9mIGxpdmUgbGlzdGVuZXJzXG4gICAgICBpZiAob3B0cy5hdHRhY2htZW50cyAmJiBvcHRzLmluY2x1ZGVfZG9jcykge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUpIHtcbiAgICAgICAgICBmZXRjaEF0dGFjaG1lbnRzSWZOZWNlc3Nhcnkod2lubmluZ0RvYywgb3B0cywgdHhuLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBwb3N0UHJvY2Vzc0F0dGFjaG1lbnRzKFtjaGFuZ2VdLCBvcHRzLmJpbmFyeSkudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgIHJlc29sdmUoY2hhbmdlKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoY2hhbmdlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvbkJhdGNoRG9uZSgpIHtcbiAgICAgIHZhciBwcm9taXNlcyA9IFtdO1xuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHdpbm5pbmdEb2NzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIGlmIChudW1SZXN1bHRzID09PSBsaW1pdCkge1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIHZhciB3aW5uaW5nRG9jID0gd2lubmluZ0RvY3NbaV07XG4gICAgICAgIGlmICghd2lubmluZ0RvYykge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIHZhciBtZXRhZGF0YSA9IG1ldGFkYXRhc1tpXTtcbiAgICAgICAgcHJvbWlzZXMucHVzaChwcm9jZXNzTWV0YWRhdGFBbmRXaW5uaW5nRG9jKG1ldGFkYXRhLCB3aW5uaW5nRG9jKSk7XG4gICAgICB9XG5cbiAgICAgIFByb21pc2UuYWxsKHByb21pc2VzKS50aGVuKGZ1bmN0aW9uIChjaGFuZ2VzKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBjaGFuZ2VzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgaWYgKGNoYW5nZXNbaV0pIHtcbiAgICAgICAgICAgIG9wdHMub25DaGFuZ2UoY2hhbmdlc1tpXSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KS5jYXRjaChvcHRzLmNvbXBsZXRlKTtcblxuICAgICAgaWYgKG51bVJlc3VsdHMgIT09IGxpbWl0KSB7XG4gICAgICAgIGN1cnNvci5jb250aW51ZSgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEZldGNoIGFsbCBtZXRhZGF0YXMvd2lubmluZ2RvY3MgZnJvbSB0aGlzIGJhdGNoIGluIHBhcmFsbGVsLCB0aGVuIHByb2Nlc3NcbiAgICAvLyB0aGVtIGFsbCBvbmx5IG9uY2UgYWxsIGRhdGEgaGFzIGJlZW4gY29sbGVjdGVkLiBUaGlzIGlzIGRvbmUgaW4gcGFyYWxsZWxcbiAgICAvLyBiZWNhdXNlIGl0J3MgZmFzdGVyIHRoYW4gZG9pbmcgaXQgb25lLWF0LWEtdGltZS5cbiAgICB2YXIgbnVtRG9uZSA9IDA7XG4gICAgYmF0Y2hWYWx1ZXMuZm9yRWFjaChmdW5jdGlvbiAodmFsdWUsIGkpIHtcbiAgICAgIHZhciBkb2MgPSBkZWNvZGVEb2ModmFsdWUpO1xuICAgICAgdmFyIHNlcSA9IGJhdGNoS2V5c1tpXTtcbiAgICAgIGZldGNoV2lubmluZ0RvY0FuZE1ldGFkYXRhKGRvYywgc2VxLCBmdW5jdGlvbiAobWV0YWRhdGEsIHdpbm5pbmdEb2MpIHtcbiAgICAgICAgbWV0YWRhdGFzW2ldID0gbWV0YWRhdGE7XG4gICAgICAgIHdpbm5pbmdEb2NzW2ldID0gd2lubmluZ0RvYztcbiAgICAgICAgaWYgKCsrbnVtRG9uZSA9PT0gYmF0Y2hLZXlzLmxlbmd0aCkge1xuICAgICAgICAgIG9uQmF0Y2hEb25lKCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gb25HZXRNZXRhZGF0YShkb2MsIHNlcSwgbWV0YWRhdGEsIGNiKSB7XG4gICAgaWYgKG1ldGFkYXRhLnNlcSAhPT0gc2VxKSB7XG4gICAgICAvLyBzb21lIG90aGVyIHNlcSBpcyBsYXRlclxuICAgICAgcmV0dXJuIGNiKCk7XG4gICAgfVxuXG4gICAgaWYgKG1ldGFkYXRhLndpbm5pbmdSZXYgPT09IGRvYy5fcmV2KSB7XG4gICAgICAvLyB0aGlzIGlzIHRoZSB3aW5uaW5nIGRvY1xuICAgICAgcmV0dXJuIGNiKG1ldGFkYXRhLCBkb2MpO1xuICAgIH1cblxuICAgIC8vIGZldGNoIHdpbm5pbmcgZG9jIGluIHNlcGFyYXRlIHJlcXVlc3RcbiAgICB2YXIgZG9jSWRSZXYgPSBkb2MuX2lkICsgJzo6JyArIG1ldGFkYXRhLndpbm5pbmdSZXY7XG4gICAgdmFyIHJlcSA9IGRvY0lkUmV2SW5kZXguZ2V0KGRvY0lkUmV2KTtcbiAgICByZXEub25zdWNjZXNzID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgIGNiKG1ldGFkYXRhLCBkZWNvZGVEb2MoZS50YXJnZXQucmVzdWx0KSk7XG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGZldGNoV2lubmluZ0RvY0FuZE1ldGFkYXRhKGRvYywgc2VxLCBjYikge1xuICAgIGlmIChkb2NJZHMgJiYgIWRvY0lkcy5oYXMoZG9jLl9pZCkpIHtcbiAgICAgIHJldHVybiBjYigpO1xuICAgIH1cblxuICAgIHZhciBtZXRhZGF0YSA9IGRvY0lkc1RvTWV0YWRhdGEuZ2V0KGRvYy5faWQpO1xuICAgIGlmIChtZXRhZGF0YSkgeyAvLyBjYWNoZWRcbiAgICAgIHJldHVybiBvbkdldE1ldGFkYXRhKGRvYywgc2VxLCBtZXRhZGF0YSwgY2IpO1xuICAgIH1cbiAgICAvLyBtZXRhZGF0YSBub3QgY2FjaGVkLCBoYXZlIHRvIGdvIGZldGNoIGl0XG4gICAgZG9jU3RvcmUuZ2V0KGRvYy5faWQpLm9uc3VjY2VzcyA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICBtZXRhZGF0YSA9IGRlY29kZU1ldGFkYXRhKGUudGFyZ2V0LnJlc3VsdCk7XG4gICAgICBkb2NJZHNUb01ldGFkYXRhLnNldChkb2MuX2lkLCBtZXRhZGF0YSk7XG4gICAgICBvbkdldE1ldGFkYXRhKGRvYywgc2VxLCBtZXRhZGF0YSwgY2IpO1xuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiBmaW5pc2goKSB7XG4gICAgb3B0cy5jb21wbGV0ZShudWxsLCB7XG4gICAgICByZXN1bHRzOiByZXN1bHRzLFxuICAgICAgbGFzdF9zZXE6IGxhc3RTZXFcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG9uVHhuQ29tcGxldGUoKSB7XG4gICAgaWYgKCFvcHRzLmNvbnRpbnVvdXMgJiYgb3B0cy5hdHRhY2htZW50cykge1xuICAgICAgLy8gY2Fubm90IGd1YXJhbnRlZSB0aGF0IHBvc3RQcm9jZXNzaW5nIHdhcyBhbHJlYWR5IGRvbmUsXG4gICAgICAvLyBzbyBkbyBpdCBhZ2FpblxuICAgICAgcG9zdFByb2Nlc3NBdHRhY2htZW50cyhyZXN1bHRzKS50aGVuKGZpbmlzaCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGZpbmlzaCgpO1xuICAgIH1cbiAgfVxuXG4gIHZhciBvYmplY3RTdG9yZXMgPSBbRE9DX1NUT1JFLCBCWV9TRVFfU1RPUkVdO1xuICBpZiAob3B0cy5hdHRhY2htZW50cykge1xuICAgIG9iamVjdFN0b3Jlcy5wdXNoKEFUVEFDSF9TVE9SRSk7XG4gIH1cbiAgdmFyIHR4blJlc3VsdCA9IG9wZW5UcmFuc2FjdGlvblNhZmVseShpZGIsIG9iamVjdFN0b3JlcywgJ3JlYWRvbmx5Jyk7XG4gIGlmICh0eG5SZXN1bHQuZXJyb3IpIHtcbiAgICByZXR1cm4gb3B0cy5jb21wbGV0ZSh0eG5SZXN1bHQuZXJyb3IpO1xuICB9XG4gIHR4biA9IHR4blJlc3VsdC50eG47XG4gIHR4bi5vbmFib3J0ID0gaWRiRXJyb3Iob3B0cy5jb21wbGV0ZSk7XG4gIHR4bi5vbmNvbXBsZXRlID0gb25UeG5Db21wbGV0ZTtcblxuICBieVNlcVN0b3JlID0gdHhuLm9iamVjdFN0b3JlKEJZX1NFUV9TVE9SRSk7XG4gIGRvY1N0b3JlID0gdHhuLm9iamVjdFN0b3JlKERPQ19TVE9SRSk7XG4gIGRvY0lkUmV2SW5kZXggPSBieVNlcVN0b3JlLmluZGV4KCdfZG9jX2lkX3JldicpO1xuXG4gIHZhciBrZXlSYW5nZSA9IChvcHRzLnNpbmNlICYmICFvcHRzLmRlc2NlbmRpbmcpID9cbiAgICBJREJLZXlSYW5nZS5sb3dlckJvdW5kKG9wdHMuc2luY2UsIHRydWUpIDogbnVsbDtcblxuICBydW5CYXRjaGVkQ3Vyc29yKGJ5U2VxU3RvcmUsIGtleVJhbmdlLCBvcHRzLmRlc2NlbmRpbmcsIGxpbWl0LCBvbkJhdGNoKTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgY2hhbmdlcztcbiIsImltcG9ydCB7XG4gIGd1YXJkZWRDb25zb2xlLFxuICB0b1Byb21pc2UsXG4gIGhhc0xvY2FsU3RvcmFnZSxcbiAgdXVpZCxcbiAgbmV4dFRpY2tcbn0gZnJvbSAncG91Y2hkYi11dGlscyc7XG5pbXBvcnQge1xuICBpc0RlbGV0ZWQsXG4gIGlzTG9jYWxJZCxcbiAgdHJhdmVyc2VSZXZUcmVlLFxuICB3aW5uaW5nUmV2IGFzIGNhbGN1bGF0ZVdpbm5pbmdSZXYsXG4gIGxhdGVzdCBhcyBnZXRMYXRlc3Rcbn0gZnJvbSAncG91Y2hkYi1tZXJnZSc7XG5cbmltcG9ydCBpZGJCdWxrRG9jcyBmcm9tICcuL2J1bGtEb2NzJztcbmltcG9ydCBpZGJBbGxEb2NzIGZyb20gJy4vYWxsRG9jcyc7XG5pbXBvcnQgY2hlY2tCbG9iU3VwcG9ydCBmcm9tICcuL2Jsb2JTdXBwb3J0JztcbmltcG9ydCBjb3VudERvY3MgZnJvbSAnLi9jb3VudERvY3MnO1xuaW1wb3J0IHtcbiAgTUlTU0lOR19ET0MsXG4gIFJFVl9DT05GTElDVCxcbiAgSURCX0VSUk9SLFxuICBjcmVhdGVFcnJvclxufSBmcm9tICdwb3VjaGRiLWVycm9ycyc7XG5cbmltcG9ydCB7XG4gIEFEQVBURVJfVkVSU0lPTixcbiAgQVRUQUNIX0FORF9TRVFfU1RPUkUsXG4gIEFUVEFDSF9TVE9SRSxcbiAgQllfU0VRX1NUT1JFLFxuICBERVRFQ1RfQkxPQl9TVVBQT1JUX1NUT1JFLFxuICBET0NfU1RPUkUsXG4gIExPQ0FMX1NUT1JFLFxuICBNRVRBX1NUT1JFXG59IGZyb20gJy4vY29uc3RhbnRzJztcblxuaW1wb3J0IHtcbiAgY29tcGFjdFJldnMsXG4gIGRlY29kZURvYyxcbiAgZGVjb2RlTWV0YWRhdGEsXG4gIGVuY29kZU1ldGFkYXRhLFxuICBpZGJFcnJvcixcbiAgcmVhZEJsb2JEYXRhLFxuICBvcGVuVHJhbnNhY3Rpb25TYWZlbHlcbn0gZnJvbSAnLi91dGlscyc7XG5cbmltcG9ydCB7IGVucXVldWVUYXNrIH0gZnJvbSAnLi90YXNrUXVldWUnO1xuXG5pbXBvcnQgY2hhbmdlc0hhbmRsZXIgZnJvbSAnLi9jaGFuZ2VzSGFuZGxlcic7XG5pbXBvcnQgY2hhbmdlcyBmcm9tICcuL2NoYW5nZXMnO1xuXG52YXIgY2FjaGVkREJzID0gbmV3IE1hcCgpO1xudmFyIGJsb2JTdXBwb3J0UHJvbWlzZTtcbnZhciBvcGVuUmVxTGlzdCA9IG5ldyBNYXAoKTtcblxuZnVuY3Rpb24gSWRiUG91Y2gob3B0cywgY2FsbGJhY2spIHtcbiAgdmFyIGFwaSA9IHRoaXM7XG5cbiAgZW5xdWV1ZVRhc2soZnVuY3Rpb24gKHRoaXNDYWxsYmFjaykge1xuICAgIGluaXQoYXBpLCBvcHRzLCB0aGlzQ2FsbGJhY2spO1xuICB9LCBjYWxsYmFjaywgYXBpLmNvbnN0cnVjdG9yKTtcbn1cblxuZnVuY3Rpb24gaW5pdChhcGksIG9wdHMsIGNhbGxiYWNrKSB7XG5cbiAgdmFyIGRiTmFtZSA9IG9wdHMubmFtZTtcblxuICB2YXIgaWRiID0gbnVsbDtcbiAgdmFyIGlkYkdsb2JhbEZhaWx1cmVFcnJvciA9IG51bGw7XG4gIGFwaS5fbWV0YSA9IG51bGw7XG5cbiAgZnVuY3Rpb24gZW5yaWNoQ2FsbGJhY2tFcnJvcihjYWxsYmFjaykge1xuICAgIHJldHVybiBmdW5jdGlvbiAoZXJyb3IsIHJlc3VsdCkge1xuICAgICAgaWYgKGVycm9yICYmIGVycm9yIGluc3RhbmNlb2YgRXJyb3IgJiYgIWVycm9yLnJlYXNvbikge1xuICAgICAgICBpZiAoaWRiR2xvYmFsRmFpbHVyZUVycm9yKSB7XG4gICAgICAgICAgZXJyb3IucmVhc29uID0gaWRiR2xvYmFsRmFpbHVyZUVycm9yO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGNhbGxiYWNrKGVycm9yLCByZXN1bHQpO1xuICAgIH07XG4gIH1cblxuICAvLyBjYWxsZWQgd2hlbiBjcmVhdGluZyBhIGZyZXNoIG5ldyBkYXRhYmFzZVxuICBmdW5jdGlvbiBjcmVhdGVTY2hlbWEoZGIpIHtcbiAgICB2YXIgZG9jU3RvcmUgPSBkYi5jcmVhdGVPYmplY3RTdG9yZShET0NfU1RPUkUsIHtrZXlQYXRoIDogJ2lkJ30pO1xuICAgIGRiLmNyZWF0ZU9iamVjdFN0b3JlKEJZX1NFUV9TVE9SRSwge2F1dG9JbmNyZW1lbnQ6IHRydWV9KVxuICAgICAgLmNyZWF0ZUluZGV4KCdfZG9jX2lkX3JldicsICdfZG9jX2lkX3JldicsIHt1bmlxdWU6IHRydWV9KTtcbiAgICBkYi5jcmVhdGVPYmplY3RTdG9yZShBVFRBQ0hfU1RPUkUsIHtrZXlQYXRoOiAnZGlnZXN0J30pO1xuICAgIGRiLmNyZWF0ZU9iamVjdFN0b3JlKE1FVEFfU1RPUkUsIHtrZXlQYXRoOiAnaWQnLCBhdXRvSW5jcmVtZW50OiBmYWxzZX0pO1xuICAgIGRiLmNyZWF0ZU9iamVjdFN0b3JlKERFVEVDVF9CTE9CX1NVUFBPUlRfU1RPUkUpO1xuXG4gICAgLy8gYWRkZWQgaW4gdjJcbiAgICBkb2NTdG9yZS5jcmVhdGVJbmRleCgnZGVsZXRlZE9yTG9jYWwnLCAnZGVsZXRlZE9yTG9jYWwnLCB7dW5pcXVlIDogZmFsc2V9KTtcblxuICAgIC8vIGFkZGVkIGluIHYzXG4gICAgZGIuY3JlYXRlT2JqZWN0U3RvcmUoTE9DQUxfU1RPUkUsIHtrZXlQYXRoOiAnX2lkJ30pO1xuXG4gICAgLy8gYWRkZWQgaW4gdjRcbiAgICB2YXIgYXR0QW5kU2VxU3RvcmUgPSBkYi5jcmVhdGVPYmplY3RTdG9yZShBVFRBQ0hfQU5EX1NFUV9TVE9SRSxcbiAgICAgIHthdXRvSW5jcmVtZW50OiB0cnVlfSk7XG4gICAgYXR0QW5kU2VxU3RvcmUuY3JlYXRlSW5kZXgoJ3NlcScsICdzZXEnKTtcbiAgICBhdHRBbmRTZXFTdG9yZS5jcmVhdGVJbmRleCgnZGlnZXN0U2VxJywgJ2RpZ2VzdFNlcScsIHt1bmlxdWU6IHRydWV9KTtcbiAgfVxuXG4gIC8vIG1pZ3JhdGlvbiB0byB2ZXJzaW9uIDJcbiAgLy8gdW5mb3J0dW5hdGVseSBcImRlbGV0ZWRPckxvY2FsXCIgaXMgYSBtaXNub21lciBub3cgdGhhdCB3ZSBubyBsb25nZXJcbiAgLy8gc3RvcmUgbG9jYWwgZG9jcyBpbiB0aGUgbWFpbiBkb2Mtc3RvcmUsIGJ1dCB3aGFkZHlhZ29ubmFkb1xuICBmdW5jdGlvbiBhZGREZWxldGVkT3JMb2NhbEluZGV4KHR4biwgY2FsbGJhY2spIHtcbiAgICB2YXIgZG9jU3RvcmUgPSB0eG4ub2JqZWN0U3RvcmUoRE9DX1NUT1JFKTtcbiAgICBkb2NTdG9yZS5jcmVhdGVJbmRleCgnZGVsZXRlZE9yTG9jYWwnLCAnZGVsZXRlZE9yTG9jYWwnLCB7dW5pcXVlIDogZmFsc2V9KTtcblxuICAgIGRvY1N0b3JlLm9wZW5DdXJzb3IoKS5vbnN1Y2Nlc3MgPSBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICAgIHZhciBjdXJzb3IgPSBldmVudC50YXJnZXQucmVzdWx0O1xuICAgICAgaWYgKGN1cnNvcikge1xuICAgICAgICB2YXIgbWV0YWRhdGEgPSBjdXJzb3IudmFsdWU7XG4gICAgICAgIHZhciBkZWxldGVkID0gaXNEZWxldGVkKG1ldGFkYXRhKTtcbiAgICAgICAgbWV0YWRhdGEuZGVsZXRlZE9yTG9jYWwgPSBkZWxldGVkID8gXCIxXCIgOiBcIjBcIjtcbiAgICAgICAgZG9jU3RvcmUucHV0KG1ldGFkYXRhKTtcbiAgICAgICAgY3Vyc29yLmNvbnRpbnVlKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgfVxuICAgIH07XG4gIH1cblxuICAvLyBtaWdyYXRpb24gdG8gdmVyc2lvbiAzIChwYXJ0IDEpXG4gIGZ1bmN0aW9uIGNyZWF0ZUxvY2FsU3RvcmVTY2hlbWEoZGIpIHtcbiAgICBkYi5jcmVhdGVPYmplY3RTdG9yZShMT0NBTF9TVE9SRSwge2tleVBhdGg6ICdfaWQnfSlcbiAgICAgIC5jcmVhdGVJbmRleCgnX2RvY19pZF9yZXYnLCAnX2RvY19pZF9yZXYnLCB7dW5pcXVlOiB0cnVlfSk7XG4gIH1cblxuICAvLyBtaWdyYXRpb24gdG8gdmVyc2lvbiAzIChwYXJ0IDIpXG4gIGZ1bmN0aW9uIG1pZ3JhdGVMb2NhbFN0b3JlKHR4biwgY2IpIHtcbiAgICB2YXIgbG9jYWxTdG9yZSA9IHR4bi5vYmplY3RTdG9yZShMT0NBTF9TVE9SRSk7XG4gICAgdmFyIGRvY1N0b3JlID0gdHhuLm9iamVjdFN0b3JlKERPQ19TVE9SRSk7XG4gICAgdmFyIHNlcVN0b3JlID0gdHhuLm9iamVjdFN0b3JlKEJZX1NFUV9TVE9SRSk7XG5cbiAgICB2YXIgY3Vyc29yID0gZG9jU3RvcmUub3BlbkN1cnNvcigpO1xuICAgIGN1cnNvci5vbnN1Y2Nlc3MgPSBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICAgIHZhciBjdXJzb3IgPSBldmVudC50YXJnZXQucmVzdWx0O1xuICAgICAgaWYgKGN1cnNvcikge1xuICAgICAgICB2YXIgbWV0YWRhdGEgPSBjdXJzb3IudmFsdWU7XG4gICAgICAgIHZhciBkb2NJZCA9IG1ldGFkYXRhLmlkO1xuICAgICAgICB2YXIgbG9jYWwgPSBpc0xvY2FsSWQoZG9jSWQpO1xuICAgICAgICB2YXIgcmV2ID0gY2FsY3VsYXRlV2lubmluZ1JldihtZXRhZGF0YSk7XG4gICAgICAgIGlmIChsb2NhbCkge1xuICAgICAgICAgIHZhciBkb2NJZFJldiA9IGRvY0lkICsgXCI6OlwiICsgcmV2O1xuICAgICAgICAgIC8vIHJlbW92ZSBhbGwgc2VxIGVudHJpZXNcbiAgICAgICAgICAvLyBhc3NvY2lhdGVkIHdpdGggdGhpcyBkb2NJZFxuICAgICAgICAgIHZhciBzdGFydCA9IGRvY0lkICsgXCI6OlwiO1xuICAgICAgICAgIHZhciBlbmQgPSBkb2NJZCArIFwiOjp+XCI7XG4gICAgICAgICAgdmFyIGluZGV4ID0gc2VxU3RvcmUuaW5kZXgoJ19kb2NfaWRfcmV2Jyk7XG4gICAgICAgICAgdmFyIHJhbmdlID0gSURCS2V5UmFuZ2UuYm91bmQoc3RhcnQsIGVuZCwgZmFsc2UsIGZhbHNlKTtcbiAgICAgICAgICB2YXIgc2VxQ3Vyc29yID0gaW5kZXgub3BlbkN1cnNvcihyYW5nZSk7XG4gICAgICAgICAgc2VxQ3Vyc29yLm9uc3VjY2VzcyA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICBzZXFDdXJzb3IgPSBlLnRhcmdldC5yZXN1bHQ7XG4gICAgICAgICAgICBpZiAoIXNlcUN1cnNvcikge1xuICAgICAgICAgICAgICAvLyBkb25lXG4gICAgICAgICAgICAgIGRvY1N0b3JlLmRlbGV0ZShjdXJzb3IucHJpbWFyeUtleSk7XG4gICAgICAgICAgICAgIGN1cnNvci5jb250aW51ZSgpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdmFyIGRhdGEgPSBzZXFDdXJzb3IudmFsdWU7XG4gICAgICAgICAgICAgIGlmIChkYXRhLl9kb2NfaWRfcmV2ID09PSBkb2NJZFJldikge1xuICAgICAgICAgICAgICAgIGxvY2FsU3RvcmUucHV0KGRhdGEpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHNlcVN0b3JlLmRlbGV0ZShzZXFDdXJzb3IucHJpbWFyeUtleSk7XG4gICAgICAgICAgICAgIHNlcUN1cnNvci5jb250aW51ZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY3Vyc29yLmNvbnRpbnVlKCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoY2IpIHtcbiAgICAgICAgY2IoKTtcbiAgICAgIH1cbiAgICB9O1xuICB9XG5cbiAgLy8gbWlncmF0aW9uIHRvIHZlcnNpb24gNCAocGFydCAxKVxuICBmdW5jdGlvbiBhZGRBdHRhY2hBbmRTZXFTdG9yZShkYikge1xuICAgIHZhciBhdHRBbmRTZXFTdG9yZSA9IGRiLmNyZWF0ZU9iamVjdFN0b3JlKEFUVEFDSF9BTkRfU0VRX1NUT1JFLFxuICAgICAge2F1dG9JbmNyZW1lbnQ6IHRydWV9KTtcbiAgICBhdHRBbmRTZXFTdG9yZS5jcmVhdGVJbmRleCgnc2VxJywgJ3NlcScpO1xuICAgIGF0dEFuZFNlcVN0b3JlLmNyZWF0ZUluZGV4KCdkaWdlc3RTZXEnLCAnZGlnZXN0U2VxJywge3VuaXF1ZTogdHJ1ZX0pO1xuICB9XG5cbiAgLy8gbWlncmF0aW9uIHRvIHZlcnNpb24gNCAocGFydCAyKVxuICBmdW5jdGlvbiBtaWdyYXRlQXR0c0FuZFNlcXModHhuLCBjYWxsYmFjaykge1xuICAgIHZhciBzZXFTdG9yZSA9IHR4bi5vYmplY3RTdG9yZShCWV9TRVFfU1RPUkUpO1xuICAgIHZhciBhdHRTdG9yZSA9IHR4bi5vYmplY3RTdG9yZShBVFRBQ0hfU1RPUkUpO1xuICAgIHZhciBhdHRBbmRTZXFTdG9yZSA9IHR4bi5vYmplY3RTdG9yZShBVFRBQ0hfQU5EX1NFUV9TVE9SRSk7XG5cbiAgICAvLyBuZWVkIHRvIGFjdHVhbGx5IHBvcHVsYXRlIHRoZSB0YWJsZS4gdGhpcyBpcyB0aGUgZXhwZW5zaXZlIHBhcnQsXG4gICAgLy8gc28gYXMgYW4gb3B0aW1pemF0aW9uLCBjaGVjayBmaXJzdCB0aGF0IHRoaXMgZGF0YWJhc2UgZXZlblxuICAgIC8vIGNvbnRhaW5zIGF0dGFjaG1lbnRzXG4gICAgdmFyIHJlcSA9IGF0dFN0b3JlLmNvdW50KCk7XG4gICAgcmVxLm9uc3VjY2VzcyA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICB2YXIgY291bnQgPSBlLnRhcmdldC5yZXN1bHQ7XG4gICAgICBpZiAoIWNvdW50KSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjaygpOyAvLyBkb25lXG4gICAgICB9XG5cbiAgICAgIHNlcVN0b3JlLm9wZW5DdXJzb3IoKS5vbnN1Y2Nlc3MgPSBmdW5jdGlvbiAoZSkge1xuICAgICAgICB2YXIgY3Vyc29yID0gZS50YXJnZXQucmVzdWx0O1xuICAgICAgICBpZiAoIWN1cnNvcikge1xuICAgICAgICAgIHJldHVybiBjYWxsYmFjaygpOyAvLyBkb25lXG4gICAgICAgIH1cbiAgICAgICAgdmFyIGRvYyA9IGN1cnNvci52YWx1ZTtcbiAgICAgICAgdmFyIHNlcSA9IGN1cnNvci5wcmltYXJ5S2V5O1xuICAgICAgICB2YXIgYXR0cyA9IE9iamVjdC5rZXlzKGRvYy5fYXR0YWNobWVudHMgfHwge30pO1xuICAgICAgICB2YXIgZGlnZXN0TWFwID0ge307XG4gICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgYXR0cy5sZW5ndGg7IGorKykge1xuICAgICAgICAgIHZhciBhdHQgPSBkb2MuX2F0dGFjaG1lbnRzW2F0dHNbal1dO1xuICAgICAgICAgIGRpZ2VzdE1hcFthdHQuZGlnZXN0XSA9IHRydWU7IC8vIHVuaXEgZGlnZXN0cywganVzdCBpbiBjYXNlXG4gICAgICAgIH1cbiAgICAgICAgdmFyIGRpZ2VzdHMgPSBPYmplY3Qua2V5cyhkaWdlc3RNYXApO1xuICAgICAgICBmb3IgKGogPSAwOyBqIDwgZGlnZXN0cy5sZW5ndGg7IGorKykge1xuICAgICAgICAgIHZhciBkaWdlc3QgPSBkaWdlc3RzW2pdO1xuICAgICAgICAgIGF0dEFuZFNlcVN0b3JlLnB1dCh7XG4gICAgICAgICAgICBzZXE6IHNlcSxcbiAgICAgICAgICAgIGRpZ2VzdFNlcTogZGlnZXN0ICsgJzo6JyArIHNlcVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGN1cnNvci5jb250aW51ZSgpO1xuICAgICAgfTtcbiAgICB9O1xuICB9XG5cbiAgLy8gbWlncmF0aW9uIHRvIHZlcnNpb24gNVxuICAvLyBJbnN0ZWFkIG9mIHJlbHlpbmcgb24gb24tdGhlLWZseSBtaWdyYXRpb24gb2YgbWV0YWRhdGEsXG4gIC8vIHRoaXMgYnJpbmdzIHRoZSBkb2Mtc3RvcmUgdG8gaXRzIG1vZGVybiBmb3JtOlxuICAvLyAtIG1ldGFkYXRhLndpbm5pbmdyZXZcbiAgLy8gLSBtZXRhZGF0YS5zZXFcbiAgLy8gLSBzdHJpbmdpZnkgdGhlIG1ldGFkYXRhIHdoZW4gc3RvcmluZyBpdFxuICBmdW5jdGlvbiBtaWdyYXRlTWV0YWRhdGEodHhuKSB7XG5cbiAgICBmdW5jdGlvbiBkZWNvZGVNZXRhZGF0YUNvbXBhdChzdG9yZWRPYmplY3QpIHtcbiAgICAgIGlmICghc3RvcmVkT2JqZWN0LmRhdGEpIHtcbiAgICAgICAgLy8gb2xkIGZvcm1hdCwgd2hlbiB3ZSBkaWRuJ3Qgc3RvcmUgaXQgc3RyaW5naWZpZWRcbiAgICAgICAgc3RvcmVkT2JqZWN0LmRlbGV0ZWQgPSBzdG9yZWRPYmplY3QuZGVsZXRlZE9yTG9jYWwgPT09ICcxJztcbiAgICAgICAgcmV0dXJuIHN0b3JlZE9iamVjdDtcbiAgICAgIH1cbiAgICAgIHJldHVybiBkZWNvZGVNZXRhZGF0YShzdG9yZWRPYmplY3QpO1xuICAgIH1cblxuICAgIC8vIGVuc3VyZSB0aGF0IGV2ZXJ5IG1ldGFkYXRhIGhhcyBhIHdpbm5pbmdSZXYgYW5kIHNlcSxcbiAgICAvLyB3aGljaCB3YXMgcHJldmlvdXNseSBjcmVhdGVkIG9uLXRoZS1mbHkgYnV0IGJldHRlciB0byBtaWdyYXRlXG4gICAgdmFyIGJ5U2VxU3RvcmUgPSB0eG4ub2JqZWN0U3RvcmUoQllfU0VRX1NUT1JFKTtcbiAgICB2YXIgZG9jU3RvcmUgPSB0eG4ub2JqZWN0U3RvcmUoRE9DX1NUT1JFKTtcbiAgICB2YXIgY3Vyc29yID0gZG9jU3RvcmUub3BlbkN1cnNvcigpO1xuICAgIGN1cnNvci5vbnN1Y2Nlc3MgPSBmdW5jdGlvbiAoZSkge1xuICAgICAgdmFyIGN1cnNvciA9IGUudGFyZ2V0LnJlc3VsdDtcbiAgICAgIGlmICghY3Vyc29yKSB7XG4gICAgICAgIHJldHVybjsgLy8gZG9uZVxuICAgICAgfVxuICAgICAgdmFyIG1ldGFkYXRhID0gZGVjb2RlTWV0YWRhdGFDb21wYXQoY3Vyc29yLnZhbHVlKTtcblxuICAgICAgbWV0YWRhdGEud2lubmluZ1JldiA9IG1ldGFkYXRhLndpbm5pbmdSZXYgfHxcbiAgICAgICAgY2FsY3VsYXRlV2lubmluZ1JldihtZXRhZGF0YSk7XG5cbiAgICAgIGZ1bmN0aW9uIGZldGNoTWV0YWRhdGFTZXEoKSB7XG4gICAgICAgIC8vIG1ldGFkYXRhLnNlcSB3YXMgYWRkZWQgcG9zdC0zLjIuMCwgc28gaWYgaXQncyBtaXNzaW5nLFxuICAgICAgICAvLyB3ZSBuZWVkIHRvIGZldGNoIGl0IG1hbnVhbGx5XG4gICAgICAgIHZhciBzdGFydCA9IG1ldGFkYXRhLmlkICsgJzo6JztcbiAgICAgICAgdmFyIGVuZCA9IG1ldGFkYXRhLmlkICsgJzo6XFx1ZmZmZic7XG4gICAgICAgIHZhciByZXEgPSBieVNlcVN0b3JlLmluZGV4KCdfZG9jX2lkX3JldicpLm9wZW5DdXJzb3IoXG4gICAgICAgICAgSURCS2V5UmFuZ2UuYm91bmQoc3RhcnQsIGVuZCkpO1xuXG4gICAgICAgIHZhciBtZXRhZGF0YVNlcSA9IDA7XG4gICAgICAgIHJlcS5vbnN1Y2Nlc3MgPSBmdW5jdGlvbiAoZSkge1xuICAgICAgICAgIHZhciBjdXJzb3IgPSBlLnRhcmdldC5yZXN1bHQ7XG4gICAgICAgICAgaWYgKCFjdXJzb3IpIHtcbiAgICAgICAgICAgIG1ldGFkYXRhLnNlcSA9IG1ldGFkYXRhU2VxO1xuICAgICAgICAgICAgcmV0dXJuIG9uR2V0TWV0YWRhdGFTZXEoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdmFyIHNlcSA9IGN1cnNvci5wcmltYXJ5S2V5O1xuICAgICAgICAgIGlmIChzZXEgPiBtZXRhZGF0YVNlcSkge1xuICAgICAgICAgICAgbWV0YWRhdGFTZXEgPSBzZXE7XG4gICAgICAgICAgfVxuICAgICAgICAgIGN1cnNvci5jb250aW51ZSgpO1xuICAgICAgICB9O1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBvbkdldE1ldGFkYXRhU2VxKCkge1xuICAgICAgICB2YXIgbWV0YWRhdGFUb1N0b3JlID0gZW5jb2RlTWV0YWRhdGEobWV0YWRhdGEsXG4gICAgICAgICAgbWV0YWRhdGEud2lubmluZ1JldiwgbWV0YWRhdGEuZGVsZXRlZCk7XG5cbiAgICAgICAgdmFyIHJlcSA9IGRvY1N0b3JlLnB1dChtZXRhZGF0YVRvU3RvcmUpO1xuICAgICAgICByZXEub25zdWNjZXNzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgIGN1cnNvci5jb250aW51ZSgpO1xuICAgICAgICB9O1xuICAgICAgfVxuXG4gICAgICBpZiAobWV0YWRhdGEuc2VxKSB7XG4gICAgICAgIHJldHVybiBvbkdldE1ldGFkYXRhU2VxKCk7XG4gICAgICB9XG5cbiAgICAgIGZldGNoTWV0YWRhdGFTZXEoKTtcbiAgICB9O1xuXG4gIH1cblxuICBhcGkuX3JlbW90ZSA9IGZhbHNlO1xuICBhcGkudHlwZSA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gJ2lkYic7XG4gIH07XG5cbiAgYXBpLl9pZCA9IHRvUHJvbWlzZShmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICBjYWxsYmFjayhudWxsLCBhcGkuX21ldGEuaW5zdGFuY2VJZCk7XG4gIH0pO1xuXG4gIGFwaS5fYnVsa0RvY3MgPSBmdW5jdGlvbiBpZGJfYnVsa0RvY3MocmVxLCByZXFPcHRzLCBjYWxsYmFjaykge1xuICAgIGlkYkJ1bGtEb2NzKG9wdHMsIHJlcSwgcmVxT3B0cywgYXBpLCBpZGIsIGVucmljaENhbGxiYWNrRXJyb3IoY2FsbGJhY2spKTtcbiAgfTtcblxuICAvLyBGaXJzdCB3ZSBsb29rIHVwIHRoZSBtZXRhZGF0YSBpbiB0aGUgaWRzIGRhdGFiYXNlLCB0aGVuIHdlIGZldGNoIHRoZVxuICAvLyBjdXJyZW50IHJldmlzaW9uKHMpIGZyb20gdGhlIGJ5IHNlcXVlbmNlIHN0b3JlXG4gIGFwaS5fZ2V0ID0gZnVuY3Rpb24gaWRiX2dldChpZCwgb3B0cywgY2FsbGJhY2spIHtcbiAgICB2YXIgZG9jO1xuICAgIHZhciBtZXRhZGF0YTtcbiAgICB2YXIgZXJyO1xuICAgIHZhciB0eG4gPSBvcHRzLmN0eDtcbiAgICBpZiAoIXR4bikge1xuICAgICAgdmFyIHR4blJlc3VsdCA9IG9wZW5UcmFuc2FjdGlvblNhZmVseShpZGIsXG4gICAgICAgIFtET0NfU1RPUkUsIEJZX1NFUV9TVE9SRSwgQVRUQUNIX1NUT1JFXSwgJ3JlYWRvbmx5Jyk7XG4gICAgICBpZiAodHhuUmVzdWx0LmVycm9yKSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjayh0eG5SZXN1bHQuZXJyb3IpO1xuICAgICAgfVxuICAgICAgdHhuID0gdHhuUmVzdWx0LnR4bjtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBmaW5pc2goKSB7XG4gICAgICBjYWxsYmFjayhlcnIsIHtkb2M6IGRvYywgbWV0YWRhdGE6IG1ldGFkYXRhLCBjdHg6IHR4bn0pO1xuICAgIH1cblxuICAgIHR4bi5vYmplY3RTdG9yZShET0NfU1RPUkUpLmdldChpZCkub25zdWNjZXNzID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgIG1ldGFkYXRhID0gZGVjb2RlTWV0YWRhdGEoZS50YXJnZXQucmVzdWx0KTtcbiAgICAgIC8vIHdlIGNhbiBkZXRlcm1pbmUgdGhlIHJlc3VsdCBoZXJlIGlmOlxuICAgICAgLy8gMS4gdGhlcmUgaXMgbm8gc3VjaCBkb2N1bWVudFxuICAgICAgLy8gMi4gdGhlIGRvY3VtZW50IGlzIGRlbGV0ZWQgYW5kIHdlIGRvbid0IGFzayBhYm91dCBzcGVjaWZpYyByZXZcbiAgICAgIC8vIFdoZW4gd2UgYXNrIHdpdGggb3B0cy5yZXYgd2UgZXhwZWN0IHRoZSBhbnN3ZXIgdG8gYmUgZWl0aGVyXG4gICAgICAvLyBkb2MgKHBvc3NpYmx5IHdpdGggX2RlbGV0ZWQ9dHJ1ZSkgb3IgbWlzc2luZyBlcnJvclxuICAgICAgaWYgKCFtZXRhZGF0YSkge1xuICAgICAgICBlcnIgPSBjcmVhdGVFcnJvcihNSVNTSU5HX0RPQywgJ21pc3NpbmcnKTtcbiAgICAgICAgcmV0dXJuIGZpbmlzaCgpO1xuICAgICAgfVxuXG4gICAgICB2YXIgcmV2O1xuICAgICAgaWYgKCFvcHRzLnJldikge1xuICAgICAgICByZXYgPSBtZXRhZGF0YS53aW5uaW5nUmV2O1xuICAgICAgICB2YXIgZGVsZXRlZCA9IGlzRGVsZXRlZChtZXRhZGF0YSk7XG4gICAgICAgIGlmIChkZWxldGVkKSB7XG4gICAgICAgICAgZXJyID0gY3JlYXRlRXJyb3IoTUlTU0lOR19ET0MsIFwiZGVsZXRlZFwiKTtcbiAgICAgICAgICByZXR1cm4gZmluaXNoKCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldiA9IG9wdHMubGF0ZXN0ID8gZ2V0TGF0ZXN0KG9wdHMucmV2LCBtZXRhZGF0YSkgOiBvcHRzLnJldjtcbiAgICAgIH1cblxuICAgICAgdmFyIG9iamVjdFN0b3JlID0gdHhuLm9iamVjdFN0b3JlKEJZX1NFUV9TVE9SRSk7XG4gICAgICB2YXIga2V5ID0gbWV0YWRhdGEuaWQgKyAnOjonICsgcmV2O1xuXG4gICAgICBvYmplY3RTdG9yZS5pbmRleCgnX2RvY19pZF9yZXYnKS5nZXQoa2V5KS5vbnN1Y2Nlc3MgPSBmdW5jdGlvbiAoZSkge1xuICAgICAgICBkb2MgPSBlLnRhcmdldC5yZXN1bHQ7XG4gICAgICAgIGlmIChkb2MpIHtcbiAgICAgICAgICBkb2MgPSBkZWNvZGVEb2MoZG9jKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIWRvYykge1xuICAgICAgICAgIGVyciA9IGNyZWF0ZUVycm9yKE1JU1NJTkdfRE9DLCAnbWlzc2luZycpO1xuICAgICAgICAgIHJldHVybiBmaW5pc2goKTtcbiAgICAgICAgfVxuICAgICAgICBmaW5pc2goKTtcbiAgICAgIH07XG4gICAgfTtcbiAgfTtcblxuICBhcGkuX2dldEF0dGFjaG1lbnQgPSBmdW5jdGlvbiAoZG9jSWQsIGF0dGFjaElkLCBhdHRhY2htZW50LCBvcHRzLCBjYWxsYmFjaykge1xuICAgIHZhciB0eG47XG4gICAgaWYgKG9wdHMuY3R4KSB7XG4gICAgICB0eG4gPSBvcHRzLmN0eDtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIHR4blJlc3VsdCA9IG9wZW5UcmFuc2FjdGlvblNhZmVseShpZGIsXG4gICAgICAgIFtET0NfU1RPUkUsIEJZX1NFUV9TVE9SRSwgQVRUQUNIX1NUT1JFXSwgJ3JlYWRvbmx5Jyk7XG4gICAgICBpZiAodHhuUmVzdWx0LmVycm9yKSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjayh0eG5SZXN1bHQuZXJyb3IpO1xuICAgICAgfVxuICAgICAgdHhuID0gdHhuUmVzdWx0LnR4bjtcbiAgICB9XG4gICAgdmFyIGRpZ2VzdCA9IGF0dGFjaG1lbnQuZGlnZXN0O1xuICAgIHZhciB0eXBlID0gYXR0YWNobWVudC5jb250ZW50X3R5cGU7XG5cbiAgICB0eG4ub2JqZWN0U3RvcmUoQVRUQUNIX1NUT1JFKS5nZXQoZGlnZXN0KS5vbnN1Y2Nlc3MgPSBmdW5jdGlvbiAoZSkge1xuICAgICAgdmFyIGJvZHkgPSBlLnRhcmdldC5yZXN1bHQuYm9keTtcbiAgICAgIHJlYWRCbG9iRGF0YShib2R5LCB0eXBlLCBvcHRzLmJpbmFyeSwgZnVuY3Rpb24gKGJsb2JEYXRhKSB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIGJsb2JEYXRhKTtcbiAgICAgIH0pO1xuICAgIH07XG4gIH07XG5cbiAgYXBpLl9pbmZvID0gZnVuY3Rpb24gaWRiX2luZm8oY2FsbGJhY2spIHtcbiAgICB2YXIgdXBkYXRlU2VxO1xuICAgIHZhciBkb2NDb3VudDtcblxuICAgIHZhciB0eG5SZXN1bHQgPSBvcGVuVHJhbnNhY3Rpb25TYWZlbHkoaWRiLCBbTUVUQV9TVE9SRSwgQllfU0VRX1NUT1JFXSwgJ3JlYWRvbmx5Jyk7XG4gICAgaWYgKHR4blJlc3VsdC5lcnJvcikge1xuICAgICAgcmV0dXJuIGNhbGxiYWNrKHR4blJlc3VsdC5lcnJvcik7XG4gICAgfVxuICAgIHZhciB0eG4gPSB0eG5SZXN1bHQudHhuO1xuICAgIHR4bi5vYmplY3RTdG9yZShNRVRBX1NUT1JFKS5nZXQoTUVUQV9TVE9SRSkub25zdWNjZXNzID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgIGRvY0NvdW50ID0gZS50YXJnZXQucmVzdWx0LmRvY0NvdW50O1xuICAgIH07XG4gICAgdHhuLm9iamVjdFN0b3JlKEJZX1NFUV9TVE9SRSkub3BlbkN1cnNvcihudWxsLCAncHJldicpLm9uc3VjY2VzcyA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICB2YXIgY3Vyc29yID0gZS50YXJnZXQucmVzdWx0O1xuICAgICAgdXBkYXRlU2VxID0gY3Vyc29yID8gY3Vyc29yLmtleSA6IDA7XG4gICAgfTtcblxuICAgIHR4bi5vbmNvbXBsZXRlID0gZnVuY3Rpb24gKCkge1xuICAgICAgY2FsbGJhY2sobnVsbCwge1xuICAgICAgICBkb2NfY291bnQ6IGRvY0NvdW50LFxuICAgICAgICB1cGRhdGVfc2VxOiB1cGRhdGVTZXEsXG4gICAgICAgIC8vIGZvciBkZWJ1Z2dpbmdcbiAgICAgICAgaWRiX2F0dGFjaG1lbnRfZm9ybWF0OiAoYXBpLl9tZXRhLmJsb2JTdXBwb3J0ID8gJ2JpbmFyeScgOiAnYmFzZTY0JylcbiAgICAgIH0pO1xuICAgIH07XG4gIH07XG5cbiAgYXBpLl9hbGxEb2NzID0gZnVuY3Rpb24gaWRiX2FsbERvY3Mob3B0cywgY2FsbGJhY2spIHtcbiAgICBpZGJBbGxEb2NzKG9wdHMsIGlkYiwgZW5yaWNoQ2FsbGJhY2tFcnJvcihjYWxsYmFjaykpO1xuICB9O1xuXG4gIGFwaS5fY2hhbmdlcyA9IGZ1bmN0aW9uIGlkYkNoYW5nZXMob3B0cykge1xuICAgIHJldHVybiBjaGFuZ2VzKG9wdHMsIGFwaSwgZGJOYW1lLCBpZGIpO1xuICB9O1xuXG4gIGFwaS5fY2xvc2UgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAvLyBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL0luZGV4ZWREQi9JREJEYXRhYmFzZSNjbG9zZVxuICAgIC8vIFwiUmV0dXJucyBpbW1lZGlhdGVseSBhbmQgY2xvc2VzIHRoZSBjb25uZWN0aW9uIGluIGEgc2VwYXJhdGUgdGhyZWFkLi4uXCJcbiAgICBpZGIuY2xvc2UoKTtcbiAgICBjYWNoZWREQnMuZGVsZXRlKGRiTmFtZSk7XG4gICAgY2FsbGJhY2soKTtcbiAgfTtcblxuICBhcGkuX2dldFJldmlzaW9uVHJlZSA9IGZ1bmN0aW9uIChkb2NJZCwgY2FsbGJhY2spIHtcbiAgICB2YXIgdHhuUmVzdWx0ID0gb3BlblRyYW5zYWN0aW9uU2FmZWx5KGlkYiwgW0RPQ19TVE9SRV0sICdyZWFkb25seScpO1xuICAgIGlmICh0eG5SZXN1bHQuZXJyb3IpIHtcbiAgICAgIHJldHVybiBjYWxsYmFjayh0eG5SZXN1bHQuZXJyb3IpO1xuICAgIH1cbiAgICB2YXIgdHhuID0gdHhuUmVzdWx0LnR4bjtcbiAgICB2YXIgcmVxID0gdHhuLm9iamVjdFN0b3JlKERPQ19TVE9SRSkuZ2V0KGRvY0lkKTtcbiAgICByZXEub25zdWNjZXNzID0gZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICB2YXIgZG9jID0gZGVjb2RlTWV0YWRhdGEoZXZlbnQudGFyZ2V0LnJlc3VsdCk7XG4gICAgICBpZiAoIWRvYykge1xuICAgICAgICBjYWxsYmFjayhjcmVhdGVFcnJvcihNSVNTSU5HX0RPQykpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgZG9jLnJldl90cmVlKTtcbiAgICAgIH1cbiAgICB9O1xuICB9O1xuXG4gIC8vIFRoaXMgZnVuY3Rpb24gcmVtb3ZlcyByZXZpc2lvbnMgb2YgZG9jdW1lbnQgZG9jSWRcbiAgLy8gd2hpY2ggYXJlIGxpc3RlZCBpbiByZXZzIGFuZCBzZXRzIHRoaXMgZG9jdW1lbnRcbiAgLy8gcmV2aXNpb24gdG8gdG8gcmV2X3RyZWVcbiAgYXBpLl9kb0NvbXBhY3Rpb24gPSBmdW5jdGlvbiAoZG9jSWQsIHJldnMsIGNhbGxiYWNrKSB7XG4gICAgdmFyIHN0b3JlcyA9IFtcbiAgICAgIERPQ19TVE9SRSxcbiAgICAgIEJZX1NFUV9TVE9SRSxcbiAgICAgIEFUVEFDSF9TVE9SRSxcbiAgICAgIEFUVEFDSF9BTkRfU0VRX1NUT1JFXG4gICAgXTtcbiAgICB2YXIgdHhuUmVzdWx0ID0gb3BlblRyYW5zYWN0aW9uU2FmZWx5KGlkYiwgc3RvcmVzLCAncmVhZHdyaXRlJyk7XG4gICAgaWYgKHR4blJlc3VsdC5lcnJvcikge1xuICAgICAgcmV0dXJuIGNhbGxiYWNrKHR4blJlc3VsdC5lcnJvcik7XG4gICAgfVxuICAgIHZhciB0eG4gPSB0eG5SZXN1bHQudHhuO1xuXG4gICAgdmFyIGRvY1N0b3JlID0gdHhuLm9iamVjdFN0b3JlKERPQ19TVE9SRSk7XG5cbiAgICBkb2NTdG9yZS5nZXQoZG9jSWQpLm9uc3VjY2VzcyA9IGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgdmFyIG1ldGFkYXRhID0gZGVjb2RlTWV0YWRhdGEoZXZlbnQudGFyZ2V0LnJlc3VsdCk7XG4gICAgICB0cmF2ZXJzZVJldlRyZWUobWV0YWRhdGEucmV2X3RyZWUsIGZ1bmN0aW9uIChpc0xlYWYsIHBvcyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldkhhc2gsIGN0eCwgb3B0cykge1xuICAgICAgICB2YXIgcmV2ID0gcG9zICsgJy0nICsgcmV2SGFzaDtcbiAgICAgICAgaWYgKHJldnMuaW5kZXhPZihyZXYpICE9PSAtMSkge1xuICAgICAgICAgIG9wdHMuc3RhdHVzID0gJ21pc3NpbmcnO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGNvbXBhY3RSZXZzKHJldnMsIGRvY0lkLCB0eG4pO1xuICAgICAgdmFyIHdpbm5pbmdSZXYgPSBtZXRhZGF0YS53aW5uaW5nUmV2O1xuICAgICAgdmFyIGRlbGV0ZWQgPSBtZXRhZGF0YS5kZWxldGVkO1xuICAgICAgdHhuLm9iamVjdFN0b3JlKERPQ19TVE9SRSkucHV0KFxuICAgICAgICBlbmNvZGVNZXRhZGF0YShtZXRhZGF0YSwgd2lubmluZ1JldiwgZGVsZXRlZCkpO1xuICAgIH07XG4gICAgdHhuLm9uYWJvcnQgPSBpZGJFcnJvcihjYWxsYmFjayk7XG4gICAgdHhuLm9uY29tcGxldGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICBjYWxsYmFjaygpO1xuICAgIH07XG4gIH07XG5cblxuICBhcGkuX2dldExvY2FsID0gZnVuY3Rpb24gKGlkLCBjYWxsYmFjaykge1xuICAgIHZhciB0eG5SZXN1bHQgPSBvcGVuVHJhbnNhY3Rpb25TYWZlbHkoaWRiLCBbTE9DQUxfU1RPUkVdLCAncmVhZG9ubHknKTtcbiAgICBpZiAodHhuUmVzdWx0LmVycm9yKSB7XG4gICAgICByZXR1cm4gY2FsbGJhY2sodHhuUmVzdWx0LmVycm9yKTtcbiAgICB9XG4gICAgdmFyIHR4ID0gdHhuUmVzdWx0LnR4bjtcbiAgICB2YXIgcmVxID0gdHgub2JqZWN0U3RvcmUoTE9DQUxfU1RPUkUpLmdldChpZCk7XG5cbiAgICByZXEub25lcnJvciA9IGlkYkVycm9yKGNhbGxiYWNrKTtcbiAgICByZXEub25zdWNjZXNzID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgIHZhciBkb2MgPSBlLnRhcmdldC5yZXN1bHQ7XG4gICAgICBpZiAoIWRvYykge1xuICAgICAgICBjYWxsYmFjayhjcmVhdGVFcnJvcihNSVNTSU5HX0RPQykpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGVsZXRlIGRvY1snX2RvY19pZF9yZXYnXTsgLy8gZm9yIGJhY2t3YXJkcyBjb21wYXRcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgZG9jKTtcbiAgICAgIH1cbiAgICB9O1xuICB9O1xuXG4gIGFwaS5fcHV0TG9jYWwgPSBmdW5jdGlvbiAoZG9jLCBvcHRzLCBjYWxsYmFjaykge1xuICAgIGlmICh0eXBlb2Ygb3B0cyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY2FsbGJhY2sgPSBvcHRzO1xuICAgICAgb3B0cyA9IHt9O1xuICAgIH1cbiAgICBkZWxldGUgZG9jLl9yZXZpc2lvbnM7IC8vIGlnbm9yZSB0aGlzLCB0cnVzdCB0aGUgcmV2XG4gICAgdmFyIG9sZFJldiA9IGRvYy5fcmV2O1xuICAgIHZhciBpZCA9IGRvYy5faWQ7XG4gICAgaWYgKCFvbGRSZXYpIHtcbiAgICAgIGRvYy5fcmV2ID0gJzAtMSc7XG4gICAgfSBlbHNlIHtcbiAgICAgIGRvYy5fcmV2ID0gJzAtJyArIChwYXJzZUludChvbGRSZXYuc3BsaXQoJy0nKVsxXSwgMTApICsgMSk7XG4gICAgfVxuXG4gICAgdmFyIHR4ID0gb3B0cy5jdHg7XG4gICAgdmFyIHJldDtcbiAgICBpZiAoIXR4KSB7XG4gICAgICB2YXIgdHhuUmVzdWx0ID0gb3BlblRyYW5zYWN0aW9uU2FmZWx5KGlkYiwgW0xPQ0FMX1NUT1JFXSwgJ3JlYWR3cml0ZScpO1xuICAgICAgaWYgKHR4blJlc3VsdC5lcnJvcikge1xuICAgICAgICByZXR1cm4gY2FsbGJhY2sodHhuUmVzdWx0LmVycm9yKTtcbiAgICAgIH1cbiAgICAgIHR4ID0gdHhuUmVzdWx0LnR4bjtcbiAgICAgIHR4Lm9uZXJyb3IgPSBpZGJFcnJvcihjYWxsYmFjayk7XG4gICAgICB0eC5vbmNvbXBsZXRlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAocmV0KSB7XG4gICAgICAgICAgY2FsbGJhY2sobnVsbCwgcmV0KTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9XG5cbiAgICB2YXIgb1N0b3JlID0gdHgub2JqZWN0U3RvcmUoTE9DQUxfU1RPUkUpO1xuICAgIHZhciByZXE7XG4gICAgaWYgKG9sZFJldikge1xuICAgICAgcmVxID0gb1N0b3JlLmdldChpZCk7XG4gICAgICByZXEub25zdWNjZXNzID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgdmFyIG9sZERvYyA9IGUudGFyZ2V0LnJlc3VsdDtcbiAgICAgICAgaWYgKCFvbGREb2MgfHwgb2xkRG9jLl9yZXYgIT09IG9sZFJldikge1xuICAgICAgICAgIGNhbGxiYWNrKGNyZWF0ZUVycm9yKFJFVl9DT05GTElDVCkpO1xuICAgICAgICB9IGVsc2UgeyAvLyB1cGRhdGVcbiAgICAgICAgICB2YXIgcmVxID0gb1N0b3JlLnB1dChkb2MpO1xuICAgICAgICAgIHJlcS5vbnN1Y2Nlc3MgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXQgPSB7b2s6IHRydWUsIGlkOiBkb2MuX2lkLCByZXY6IGRvYy5fcmV2fTtcbiAgICAgICAgICAgIGlmIChvcHRzLmN0eCkgeyAvLyByZXR1cm4gaW1tZWRpYXRlbHlcbiAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgcmV0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH0gZWxzZSB7IC8vIG5ldyBkb2NcbiAgICAgIHJlcSA9IG9TdG9yZS5hZGQoZG9jKTtcbiAgICAgIHJlcS5vbmVycm9yID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgLy8gY29uc3RyYWludCBlcnJvciwgYWxyZWFkeSBleGlzdHNcbiAgICAgICAgY2FsbGJhY2soY3JlYXRlRXJyb3IoUkVWX0NPTkZMSUNUKSk7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTsgLy8gYXZvaWQgdHJhbnNhY3Rpb24gYWJvcnRcbiAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTsgLy8gYXZvaWQgdHJhbnNhY3Rpb24gb25lcnJvclxuICAgICAgfTtcbiAgICAgIHJlcS5vbnN1Y2Nlc3MgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldCA9IHtvazogdHJ1ZSwgaWQ6IGRvYy5faWQsIHJldjogZG9jLl9yZXZ9O1xuICAgICAgICBpZiAob3B0cy5jdHgpIHsgLy8gcmV0dXJuIGltbWVkaWF0ZWx5XG4gICAgICAgICAgY2FsbGJhY2sobnVsbCwgcmV0KTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9XG4gIH07XG5cbiAgYXBpLl9yZW1vdmVMb2NhbCA9IGZ1bmN0aW9uIChkb2MsIG9wdHMsIGNhbGxiYWNrKSB7XG4gICAgaWYgKHR5cGVvZiBvcHRzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBjYWxsYmFjayA9IG9wdHM7XG4gICAgICBvcHRzID0ge307XG4gICAgfVxuICAgIHZhciB0eCA9IG9wdHMuY3R4O1xuICAgIGlmICghdHgpIHtcbiAgICAgIHZhciB0eG5SZXN1bHQgPSBvcGVuVHJhbnNhY3Rpb25TYWZlbHkoaWRiLCBbTE9DQUxfU1RPUkVdLCAncmVhZHdyaXRlJyk7XG4gICAgICBpZiAodHhuUmVzdWx0LmVycm9yKSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjayh0eG5SZXN1bHQuZXJyb3IpO1xuICAgICAgfVxuICAgICAgdHggPSB0eG5SZXN1bHQudHhuO1xuICAgICAgdHgub25jb21wbGV0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKHJldCkge1xuICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHJldCk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfVxuICAgIHZhciByZXQ7XG4gICAgdmFyIGlkID0gZG9jLl9pZDtcbiAgICB2YXIgb1N0b3JlID0gdHgub2JqZWN0U3RvcmUoTE9DQUxfU1RPUkUpO1xuICAgIHZhciByZXEgPSBvU3RvcmUuZ2V0KGlkKTtcblxuICAgIHJlcS5vbmVycm9yID0gaWRiRXJyb3IoY2FsbGJhY2spO1xuICAgIHJlcS5vbnN1Y2Nlc3MgPSBmdW5jdGlvbiAoZSkge1xuICAgICAgdmFyIG9sZERvYyA9IGUudGFyZ2V0LnJlc3VsdDtcbiAgICAgIGlmICghb2xkRG9jIHx8IG9sZERvYy5fcmV2ICE9PSBkb2MuX3Jldikge1xuICAgICAgICBjYWxsYmFjayhjcmVhdGVFcnJvcihNSVNTSU5HX0RPQykpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb1N0b3JlLmRlbGV0ZShpZCk7XG4gICAgICAgIHJldCA9IHtvazogdHJ1ZSwgaWQ6IGlkLCByZXY6ICcwLTAnfTtcbiAgICAgICAgaWYgKG9wdHMuY3R4KSB7IC8vIHJldHVybiBpbW1lZGlhdGVseVxuICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHJldCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuICB9O1xuXG4gIGFwaS5fZGVzdHJveSA9IGZ1bmN0aW9uIChvcHRzLCBjYWxsYmFjaykge1xuICAgIGNoYW5nZXNIYW5kbGVyLnJlbW92ZUFsbExpc3RlbmVycyhkYk5hbWUpO1xuXG4gICAgLy9DbG9zZSBvcGVuIHJlcXVlc3QgZm9yIFwiZGJOYW1lXCIgZGF0YWJhc2UgdG8gZml4IGllIGRlbGF5LlxuICAgIHZhciBvcGVuUmVxID0gb3BlblJlcUxpc3QuZ2V0KGRiTmFtZSk7XG4gICAgaWYgKG9wZW5SZXEgJiYgb3BlblJlcS5yZXN1bHQpIHtcbiAgICAgIG9wZW5SZXEucmVzdWx0LmNsb3NlKCk7XG4gICAgICBjYWNoZWREQnMuZGVsZXRlKGRiTmFtZSk7XG4gICAgfVxuICAgIHZhciByZXEgPSBpbmRleGVkREIuZGVsZXRlRGF0YWJhc2UoZGJOYW1lKTtcblxuICAgIHJlcS5vbnN1Y2Nlc3MgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAvL1JlbW92ZSBvcGVuIHJlcXVlc3QgZnJvbSB0aGUgbGlzdC5cbiAgICAgIG9wZW5SZXFMaXN0LmRlbGV0ZShkYk5hbWUpO1xuICAgICAgaWYgKGhhc0xvY2FsU3RvcmFnZSgpICYmIChkYk5hbWUgaW4gbG9jYWxTdG9yYWdlKSkge1xuICAgICAgICBkZWxldGUgbG9jYWxTdG9yYWdlW2RiTmFtZV07XG4gICAgICB9XG4gICAgICBjYWxsYmFjayhudWxsLCB7ICdvayc6IHRydWUgfSk7XG4gICAgfTtcblxuICAgIHJlcS5vbmVycm9yID0gaWRiRXJyb3IoY2FsbGJhY2spO1xuICB9O1xuXG4gIHZhciBjYWNoZWQgPSBjYWNoZWREQnMuZ2V0KGRiTmFtZSk7XG5cbiAgaWYgKGNhY2hlZCkge1xuICAgIGlkYiA9IGNhY2hlZC5pZGI7XG4gICAgYXBpLl9tZXRhID0gY2FjaGVkLmdsb2JhbDtcbiAgICByZXR1cm4gbmV4dFRpY2soZnVuY3Rpb24gKCkge1xuICAgICAgY2FsbGJhY2sobnVsbCwgYXBpKTtcbiAgICB9KTtcbiAgfVxuXG4gIHZhciByZXEgPSBpbmRleGVkREIub3BlbihkYk5hbWUsIEFEQVBURVJfVkVSU0lPTik7XG4gIG9wZW5SZXFMaXN0LnNldChkYk5hbWUsIHJlcSk7XG5cbiAgcmVxLm9udXBncmFkZW5lZWRlZCA9IGZ1bmN0aW9uIChlKSB7XG4gICAgdmFyIGRiID0gZS50YXJnZXQucmVzdWx0O1xuICAgIGlmIChlLm9sZFZlcnNpb24gPCAxKSB7XG4gICAgICByZXR1cm4gY3JlYXRlU2NoZW1hKGRiKTsgLy8gbmV3IGRiLCBpbml0aWFsIHNjaGVtYVxuICAgIH1cbiAgICAvLyBkbyBtaWdyYXRpb25zXG5cbiAgICB2YXIgdHhuID0gZS5jdXJyZW50VGFyZ2V0LnRyYW5zYWN0aW9uO1xuICAgIC8vIHRoZXNlIG1pZ3JhdGlvbnMgaGF2ZSB0byBiZSBkb25lIGluIHRoaXMgZnVuY3Rpb24sIGJlZm9yZVxuICAgIC8vIGNvbnRyb2wgaXMgcmV0dXJuZWQgdG8gdGhlIGV2ZW50IGxvb3AsIGJlY2F1c2UgSW5kZXhlZERCXG5cbiAgICBpZiAoZS5vbGRWZXJzaW9uIDwgMykge1xuICAgICAgY3JlYXRlTG9jYWxTdG9yZVNjaGVtYShkYik7IC8vIHYyIC0+IHYzXG4gICAgfVxuICAgIGlmIChlLm9sZFZlcnNpb24gPCA0KSB7XG4gICAgICBhZGRBdHRhY2hBbmRTZXFTdG9yZShkYik7IC8vIHYzIC0+IHY0XG4gICAgfVxuXG4gICAgdmFyIG1pZ3JhdGlvbnMgPSBbXG4gICAgICBhZGREZWxldGVkT3JMb2NhbEluZGV4LCAvLyB2MSAtPiB2MlxuICAgICAgbWlncmF0ZUxvY2FsU3RvcmUsICAgICAgLy8gdjIgLT4gdjNcbiAgICAgIG1pZ3JhdGVBdHRzQW5kU2VxcywgICAgIC8vIHYzIC0+IHY0XG4gICAgICBtaWdyYXRlTWV0YWRhdGEgICAgICAgICAvLyB2NCAtPiB2NVxuICAgIF07XG5cbiAgICB2YXIgaSA9IGUub2xkVmVyc2lvbjtcblxuICAgIGZ1bmN0aW9uIG5leHQoKSB7XG4gICAgICB2YXIgbWlncmF0aW9uID0gbWlncmF0aW9uc1tpIC0gMV07XG4gICAgICBpKys7XG4gICAgICBpZiAobWlncmF0aW9uKSB7XG4gICAgICAgIG1pZ3JhdGlvbih0eG4sIG5leHQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIG5leHQoKTtcbiAgfTtcblxuICByZXEub25zdWNjZXNzID0gZnVuY3Rpb24gKGUpIHtcblxuICAgIGlkYiA9IGUudGFyZ2V0LnJlc3VsdDtcblxuICAgIGlkYi5vbnZlcnNpb25jaGFuZ2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgICBpZGIuY2xvc2UoKTtcbiAgICAgIGNhY2hlZERCcy5kZWxldGUoZGJOYW1lKTtcbiAgICB9O1xuXG4gICAgaWRiLm9uYWJvcnQgPSBmdW5jdGlvbiAoZSkge1xuICAgICAgZ3VhcmRlZENvbnNvbGUoJ2Vycm9yJywgJ0RhdGFiYXNlIGhhcyBhIGdsb2JhbCBmYWlsdXJlJywgZS50YXJnZXQuZXJyb3IpO1xuICAgICAgaWRiR2xvYmFsRmFpbHVyZUVycm9yID0gZS50YXJnZXQuZXJyb3I7XG4gICAgICBpZGIuY2xvc2UoKTtcbiAgICAgIGNhY2hlZERCcy5kZWxldGUoZGJOYW1lKTtcbiAgICB9O1xuXG4gICAgLy8gRG8gYSBmZXcgc2V0dXAgb3BlcmF0aW9ucyAoaW4gcGFyYWxsZWwgYXMgbXVjaCBhcyBwb3NzaWJsZSk6XG4gICAgLy8gMS4gRmV0Y2ggbWV0YSBkb2NcbiAgICAvLyAyLiBDaGVjayBibG9iIHN1cHBvcnRcbiAgICAvLyAzLiBDYWxjdWxhdGUgZG9jQ291bnRcbiAgICAvLyA0LiBHZW5lcmF0ZSBhbiBpbnN0YW5jZUlkIGlmIG5lY2Vzc2FyeVxuICAgIC8vIDUuIFN0b3JlIGRvY0NvdW50IGFuZCBpbnN0YW5jZUlkIG9uIG1ldGEgZG9jXG5cbiAgICB2YXIgdHhuID0gaWRiLnRyYW5zYWN0aW9uKFtcbiAgICAgIE1FVEFfU1RPUkUsXG4gICAgICBERVRFQ1RfQkxPQl9TVVBQT1JUX1NUT1JFLFxuICAgICAgRE9DX1NUT1JFXG4gICAgXSwgJ3JlYWR3cml0ZScpO1xuXG4gICAgdmFyIHN0b3JlZE1ldGFEb2MgPSBmYWxzZTtcbiAgICB2YXIgbWV0YURvYztcbiAgICB2YXIgZG9jQ291bnQ7XG4gICAgdmFyIGJsb2JTdXBwb3J0O1xuICAgIHZhciBpbnN0YW5jZUlkO1xuXG4gICAgZnVuY3Rpb24gY29tcGxldGVTZXR1cCgpIHtcbiAgICAgIGlmICh0eXBlb2YgYmxvYlN1cHBvcnQgPT09ICd1bmRlZmluZWQnIHx8ICFzdG9yZWRNZXRhRG9jKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGFwaS5fbWV0YSA9IHtcbiAgICAgICAgbmFtZTogZGJOYW1lLFxuICAgICAgICBpbnN0YW5jZUlkOiBpbnN0YW5jZUlkLFxuICAgICAgICBibG9iU3VwcG9ydDogYmxvYlN1cHBvcnRcbiAgICAgIH07XG5cbiAgICAgIGNhY2hlZERCcy5zZXQoZGJOYW1lLCB7XG4gICAgICAgIGlkYjogaWRiLFxuICAgICAgICBnbG9iYWw6IGFwaS5fbWV0YVxuICAgICAgfSk7XG4gICAgICBjYWxsYmFjayhudWxsLCBhcGkpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHN0b3JlTWV0YURvY0lmUmVhZHkoKSB7XG4gICAgICBpZiAodHlwZW9mIGRvY0NvdW50ID09PSAndW5kZWZpbmVkJyB8fCB0eXBlb2YgbWV0YURvYyA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdmFyIGluc3RhbmNlS2V5ID0gZGJOYW1lICsgJ19pZCc7XG4gICAgICBpZiAoaW5zdGFuY2VLZXkgaW4gbWV0YURvYykge1xuICAgICAgICBpbnN0YW5jZUlkID0gbWV0YURvY1tpbnN0YW5jZUtleV07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBtZXRhRG9jW2luc3RhbmNlS2V5XSA9IGluc3RhbmNlSWQgPSB1dWlkKCk7XG4gICAgICB9XG4gICAgICBtZXRhRG9jLmRvY0NvdW50ID0gZG9jQ291bnQ7XG4gICAgICB0eG4ub2JqZWN0U3RvcmUoTUVUQV9TVE9SRSkucHV0KG1ldGFEb2MpO1xuICAgIH1cblxuICAgIC8vXG4gICAgLy8gZmV0Y2ggb3IgZ2VuZXJhdGUgdGhlIGluc3RhbmNlSWRcbiAgICAvL1xuICAgIHR4bi5vYmplY3RTdG9yZShNRVRBX1NUT1JFKS5nZXQoTUVUQV9TVE9SRSkub25zdWNjZXNzID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgIG1ldGFEb2MgPSBlLnRhcmdldC5yZXN1bHQgfHwgeyBpZDogTUVUQV9TVE9SRSB9O1xuICAgICAgc3RvcmVNZXRhRG9jSWZSZWFkeSgpO1xuICAgIH07XG5cbiAgICAvL1xuICAgIC8vIGNvdW50RG9jc1xuICAgIC8vXG4gICAgY291bnREb2NzKHR4biwgZnVuY3Rpb24gKGNvdW50KSB7XG4gICAgICBkb2NDb3VudCA9IGNvdW50O1xuICAgICAgc3RvcmVNZXRhRG9jSWZSZWFkeSgpO1xuICAgIH0pO1xuXG4gICAgLy9cbiAgICAvLyBjaGVjayBibG9iIHN1cHBvcnRcbiAgICAvL1xuICAgIGlmICghYmxvYlN1cHBvcnRQcm9taXNlKSB7XG4gICAgICAvLyBtYWtlIHN1cmUgYmxvYiBzdXBwb3J0IGlzIG9ubHkgY2hlY2tlZCBvbmNlXG4gICAgICBibG9iU3VwcG9ydFByb21pc2UgPSBjaGVja0Jsb2JTdXBwb3J0KHR4bik7XG4gICAgfVxuXG4gICAgYmxvYlN1cHBvcnRQcm9taXNlLnRoZW4oZnVuY3Rpb24gKHZhbCkge1xuICAgICAgYmxvYlN1cHBvcnQgPSB2YWw7XG4gICAgICBjb21wbGV0ZVNldHVwKCk7XG4gICAgfSk7XG5cbiAgICAvLyBvbmx5IHdoZW4gdGhlIG1ldGFkYXRhIHB1dCB0cmFuc2FjdGlvbiBoYXMgY29tcGxldGVkLFxuICAgIC8vIGNvbnNpZGVyIHRoZSBzZXR1cCBkb25lXG4gICAgdHhuLm9uY29tcGxldGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICBzdG9yZWRNZXRhRG9jID0gdHJ1ZTtcbiAgICAgIGNvbXBsZXRlU2V0dXAoKTtcbiAgICB9O1xuICAgIHR4bi5vbmFib3J0ID0gaWRiRXJyb3IoY2FsbGJhY2spO1xuICB9O1xuXG4gIHJlcS5vbmVycm9yID0gZnVuY3Rpb24gKGUpIHtcbiAgICB2YXIgbXNnID0gZS50YXJnZXQuZXJyb3IgJiYgZS50YXJnZXQuZXJyb3IubWVzc2FnZTtcblxuICAgIGlmICghbXNnKSB7XG4gICAgICBtc2cgPSAnRmFpbGVkIHRvIG9wZW4gaW5kZXhlZERCLCBhcmUgeW91IGluIHByaXZhdGUgYnJvd3NpbmcgbW9kZT8nO1xuICAgIH0gZWxzZSBpZiAobXNnLmluZGV4T2YoXCJzdG9yZWQgZGF0YWJhc2UgaXMgYSBoaWdoZXIgdmVyc2lvblwiKSAhPT0gLTEpIHtcbiAgICAgIG1zZyA9IG5ldyBFcnJvcignVGhpcyBEQiB3YXMgY3JlYXRlZCB3aXRoIHRoZSBuZXdlciBcImluZGV4ZWRkYlwiIGFkYXB0ZXIsIGJ1dCB5b3UgYXJlIHRyeWluZyB0byBvcGVuIGl0IHdpdGggdGhlIG9sZGVyIFwiaWRiXCIgYWRhcHRlcicpO1xuICAgIH1cblxuICAgIGd1YXJkZWRDb25zb2xlKCdlcnJvcicsIG1zZyk7XG4gICAgY2FsbGJhY2soY3JlYXRlRXJyb3IoSURCX0VSUk9SLCBtc2cpKTtcbiAgfTtcbn1cblxuSWRiUG91Y2gudmFsaWQgPSBmdW5jdGlvbiAoKSB7XG4gIC8vIEZvbGxvd2luZyAjNzA4NSBidWdneSBpZGIgdmVyc2lvbnMgKHR5cGljYWxseSBTYWZhcmkgPCAxMC4xKSBhcmVcbiAgLy8gY29uc2lkZXJlZCB2YWxpZC5cblxuICAvLyBPbiBGaXJlZm94IFNlY3VyaXR5RXJyb3IgaXMgdGhyb3duIHdoaWxlIHJlZmVyZW5jaW5nIGluZGV4ZWREQiBpZiBjb29raWVzXG4gIC8vIGFyZSBub3QgYWxsb3dlZC4gYHR5cGVvZiBpbmRleGVkREJgIGFsc28gdHJpZ2dlcnMgdGhlIGVycm9yLlxuICB0cnkge1xuICAgIC8vIHNvbWUgb3V0ZGF0ZWQgaW1wbGVtZW50YXRpb25zIG9mIElEQiB0aGF0IGFwcGVhciBvbiBTYW1zdW5nXG4gICAgLy8gYW5kIEhUQyBBbmRyb2lkIGRldmljZXMgPDQuNCBhcmUgbWlzc2luZyBJREJLZXlSYW5nZVxuICAgIHJldHVybiB0eXBlb2YgaW5kZXhlZERCICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgSURCS2V5UmFuZ2UgIT09ICd1bmRlZmluZWQnO1xuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59O1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoUG91Y2hEQikge1xuICBQb3VjaERCLmFkYXB0ZXIoJ2lkYicsIElkYlBvdWNoLCB0cnVlKTtcbn1cbiJdLCJuYW1lcyI6WyJiNjRTdHJpbmdUb0Jsb2IiLCJidG9hIiwibmV4dFRpY2siLCJjYWxjdWxhdGVXaW5uaW5nUmV2IiwiZ2V0TGF0ZXN0Il0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFDQTtBQUNBLElBQUksZUFBZSxHQUFHLENBQUMsQ0FBQztBQUN4QjtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUksU0FBUyxHQUFHLGdCQUFnQixDQUFDO0FBQ2pDO0FBQ0E7QUFDQSxJQUFJLFlBQVksR0FBRyxhQUFhLENBQUM7QUFDakM7QUFDQSxJQUFJLFlBQVksR0FBRyxjQUFjLENBQUM7QUFDbEM7QUFDQTtBQUNBLElBQUksb0JBQW9CLEdBQUcsa0JBQWtCLENBQUM7QUFDOUM7QUFDQTtBQUNBO0FBQ0EsSUFBSSxVQUFVLEdBQUcsWUFBWSxDQUFDO0FBQzlCO0FBQ0EsSUFBSSxXQUFXLEdBQUcsYUFBYSxDQUFDO0FBQ2hDO0FBQ0EsSUFBSSx5QkFBeUIsR0FBRyxxQkFBcUI7O0FDTnJELFNBQVMsUUFBUSxDQUFDLFFBQVEsRUFBRTtBQUM1QixFQUFFLE9BQU8sVUFBVSxHQUFHLEVBQUU7QUFDeEIsSUFBSSxJQUFJLE9BQU8sR0FBRyxlQUFlLENBQUM7QUFDbEMsSUFBSSxJQUFJLEdBQUcsQ0FBQyxNQUFNLElBQUksR0FBRyxD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QUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDO0FBQ2xDLE1BQU0sSUFBSSxDQUFDLEtBQUssRUFBRTtBQUNsQixRQUFRLE9BQU8sUUFBUSxFQUFFLENBQUM7QUFDMUIsT0FBTztBQUNQO0FBQ0EsTUFBTSxRQUFRLENBQUMsVUFBVSxFQUFFLENBQUMsU0FBUyxHQUFHLFVBQVUsQ0FBQyxFQUFFO0FBQ3JELFFBQVEsSUFBSSxNQUFNLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUM7QUFDckMsUUFBUSxJQUFJLENBQUMsTUFBTSxFQUFFO0FBQ3JCLFVBQVUsT0FBTyxRQUFRLEVBQUUsQ0FBQztBQUM1QixTQUFTO0FBQ1QsUUFBUSxJQUFJLEdBQUcsR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDO0FBQy9CLFFBQVEsSUFBSSxHQUFHLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQztBQUNwQyxRQUFRLElBQUksSUFBSSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFlBQVksSUFBSSxFQUFFLENBQUMsQ0FBQztBQUN2RCxRQUFRLElBQUksU0FBUyxHQUFHLEVBQUUsQ0FBQztBQUMzQixRQUFRLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQzlDLFVBQVUsSUFBSSxHQUFHLEdBQUcsR0FBRyxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM5QyxVQUFVLFNBQVMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDO0FBQ3ZDLFNBQVM7QUFDVCxRQUFRLElBQUksT0FBTyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDN0MsUUFBUSxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7QUFDN0MsVUFBVSxJQUFJLE1BQU0s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
