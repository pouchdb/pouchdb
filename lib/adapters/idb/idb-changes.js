'use strict';

var utils = require('../../utils');

var idbUtils = require('./idb-utils');
var idbConstants = require('./idb-constants');

var ATTACH_STORE = idbConstants.ATTACH_STORE;
var BY_SEQ_STORE = idbConstants.BY_SEQ_STORE;
var DOC_STORE = idbConstants.DOC_STORE;

var decodeDoc = idbUtils.decodeDoc;
var decodeMetadata = idbUtils.decodeMetadata;
var fetchAttachmentsIfNecessary = idbUtils.fetchAttachmentsIfNecessary;
var idbError = idbUtils.idbError;
var postProcessAttachments = idbUtils.postProcessAttachments;

var BATCH_ITERATOR_SIZE = 3;

function idbChanges(opts, api, idb, Changes) {
  opts = utils.clone(opts);

  if (opts.continuous) {
    var id = api._name + ':' + utils.uuid();
    Changes.addListener(api._name, id, api, opts);
    Changes.notify(api._name);
    return {
      cancel: function () {
        Changes.removeListener(api._name, id);
      }
    };
  }

  var docIds = opts.doc_ids && new utils.Set(opts.doc_ids);
  var descending = opts.descending ? 'prev' : null;

  opts.since = opts.since || 0;
  var lastSeq = opts.since;

  var limit = 'limit' in opts ? opts.limit : -1;
  if (limit === 0) {
    limit = 1; // per CouchDB _changes spec
  }
  var returnDocs;
  if ('returnDocs' in opts) {
    returnDocs = opts.returnDocs;
  } else {
    returnDocs = true;
  }

  var results = [];
  var numResults = 0;
  var filter = utils.filterChange(opts);
  var docIdsToMetadata = new utils.Map();

  var txn;
  var bySeqStore;
  var docStore;

  function onGetCursor(cursor) {

    var doc = decodeDoc(cursor.value);
    var seq = cursor.key;

    function next() {
      cursor.continue();
    }

    onGetRevision(doc, seq, next, processValidChange);
  }

  function onGetRevision(doc, seq, next, onValidChange) {

    lastSeq = Math.max(seq, lastSeq);

    if (docIds && !docIds.has(doc._id)) {
      return next();
    }

    var metadata;

    function onGetMetadata() {
      if (metadata.seq !== seq) {
        // some other seq is later
        return next();
      }

      if (metadata.winningRev === doc._rev) {
        return onGetWinningDoc(doc);
      }

      fetchWinningDoc();
    }

    function fetchWinningDoc() {
      var docIdRev = doc._id + '::' + metadata.winningRev;
      var req = bySeqStore.index('_doc_id_rev').openCursor(
        IDBKeyRange.bound(docIdRev, docIdRev + '\uffff'));
      req.onsuccess = function (e) {
        onGetWinningDoc(decodeDoc(e.target.result.value));
      };
    }

    function onGetWinningDoc(winningDoc) {

      var change = opts.processChange(winningDoc, metadata, opts);
      change.seq = metadata.seq;
      if (filter(change)) {
        onValidChange(change, winningDoc);
      }
      if (numResults !== limit) {
        next();
      }
    }

    metadata = docIdsToMetadata.get(doc._id);
    if (metadata) { // cached
      return onGetMetadata();
    }
    // metadata not cached, have to go fetch it
    docStore.get(doc._id).onsuccess = function (event) {
      metadata = decodeMetadata(event.target.result);
      docIdsToMetadata.set(doc._id, metadata);
      onGetMetadata();
    };
  }

  function onsuccess(event) {
    var cursor = event.target.result;

    if (!cursor) {
      return;
    }
    onGetCursor(cursor);
  }

  function fetchChanges() {
    var objectStores = [DOC_STORE, BY_SEQ_STORE];
    if (opts.attachments) {
      objectStores.push(ATTACH_STORE);
    }
    txn = idb.transaction(objectStores, 'readonly');
    txn.onerror = idbError(opts.complete);
    txn.oncomplete = onTxnComplete;

    bySeqStore = txn.objectStore(BY_SEQ_STORE);
    docStore = txn.objectStore(DOC_STORE);

    if (descending) { // can't use batches when descending
      bySeqStore.openCursor(null, descending).onsuccess = onsuccess;
    } else {
      fetchNextBatch();
    }
  }

  function processValidChange(change, winningDoc) {
    numResults++;
    if (returnDocs) {
      results.push(change);
    }
    // process the attachment immediately
    // for the benefit of live listeners
    if (opts.attachments && opts.include_docs) {
      fetchAttachmentsIfNecessary(winningDoc, opts, txn, function () {
        postProcessAttachments([change]).then(function () {
          opts.onChange(change);
        });
      });
    } else {
      opts.onChange(change);
    }
  }

  var start = opts.since + 1;

  function fetchNextBatch() {
    var end = start + BATCH_ITERATOR_SIZE;
    var numDone = 0;

    var batchChanges = [];

    function onGetSuccess(seq) {

      function onValidChange(change, winningDoc) {
        batchChanges.push({
          change: change,
          winningDoc: winningDoc
        });
      }

      return function (e) {
        if (!e.target.result) {
          return checkDone();
        }
        var doc = decodeDoc(e.target.result);
        onGetRevision(doc, seq, checkDone, onValidChange);
      };
    }

    function processBatch() {

      if (opts.limit !== -1 &&
        opts.limit - results.length > batchChanges.length) {
        // fetched too  many this batch
        batchChanges = batchChanges.slice(0, opts.limit - results.length);
      }

      batchChanges.sort(function (a, b) {
        return a.change.seq - b.change.seq;
      });

      for (var i = 0; i < batchChanges; i++) {
        var batchChange = batchChanges[i];
        var change = batchChange.change;
        var winningDoc = batchChange.change;
        processValidChange(change, winningDoc);
      }

      start = end;

      fetchNextBatch();
    }

    function checkDone() {
      if (++numDone === end - start) {
        processBatch();
      }
    }

    for (var i = start; i < end; i++) {
      bySeqStore.get(i).onsuccess = onGetSuccess(i);
    }
  }

  fetchChanges();

  function onTxnComplete() {
    function finish() {
      opts.complete(null, {
        results: results,
        last_seq: lastSeq
      });
    }

    if (!opts.continuous && opts.attachments) {
      // cannot guarantee that postProcessing was already done,
      // so do it again
      postProcessAttachments(results).then(finish);
    } else {
      finish();
    }
  }
}

module.exports = idbChanges;