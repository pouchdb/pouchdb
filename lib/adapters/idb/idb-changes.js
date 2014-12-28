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

    lastSeq = seq;

    if (docIds && !docIds.has(doc._id)) {
      return cursor.continue();
    }

    var metadata;

    function onGetMetadata() {
      if (metadata.seq !== seq) {
        // some other seq is later
        return cursor.continue();
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
      if (numResults !== limit) {
        cursor.continue();
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

    var seqs = [];

    if (descending) {
      getDescendingSeqs();
    } else {
      for (var i = opts.since + 1; i < api._winningSeqs.length; i++) {
        if (api._winningSeqs[i]) {
          seqs.push(i);
        }
      }
    }

    var req;

    if (descending) {
      req = bySeqStore.openCursor(

        null, descending);
    } else {
      req = bySeqStore.openCursor(
        IDBKeyRange.lowerBound(opts.since, true));
    }

    req.onsuccess = onsuccess;
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