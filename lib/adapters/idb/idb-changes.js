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

  // else need to fetch everything and filter later
  var canLimitInAdvance = opts.limit !== -1 && !opts.filter && !docIds;

  var results;
  var numResults = 0;
  var filter = utils.filterChange(opts);

  var txn;
  var bySeqStore;
  var docStore;
  var docIdRevIndex;
  var winningSeqIndex;

  function onGetChange(metadata, latestDoc, seq, resultsIdx, next) {

    lastSeq = Math.max(lastSeq, seq);

    if (docIds && !docIds.has(metadata.id)) {
      return next();
    }

    function fetchWinningDoc() {
      var docIdRev = metadata.id + '::' + metadata.winningRev;
      docIdRevIndex.get(docIdRev).onsuccess = function (e) {
        onGetWinningDoc(decodeDoc(e.target.result));
      };
    }

    function onGetWinningDoc(winningDoc) {

      var change = opts.processChange(winningDoc, metadata, opts);
      change.seq = metadata.seq;

      if (filter(change)) {
        numResults++;
        if (returnDocs) {
          if (canLimitInAdvance) { // order is known in advance
            results[resultsIdx] = change;
          } else {
            results.push(change);
          }
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
        next();
      }
    }

    if (latestDoc._rev === metadata.winningRev) {
      // latest doc is also winning doc
      return onGetWinningDoc(latestDoc);
    }
    fetchWinningDoc();
  }

  function getDescendingSeqs() {
    var seqs = [];
    for (var seq in api._winningSeqs) {
      if (api._winningSeqs.hasOwnProperty(seq)) {
        seqs.push(parseInt(seq, 10));
      }
    }
    seqs = seqs.reverse();
    if (canLimitInAdvance && seqs.length > opts.limit) {
      seqs = seqs.slice(0, opts.limit);
    }
    return seqs;
  }

  function getAscendingSeqs() {
    var seqs = [];
    for (var i = opts.since + 1; i < api._winningSeqs.length; i++) {
      if (api._winningSeqs[i]) {
        seqs.push(i);
        if (canLimitInAdvance && seqs.length === opts.limit) {
          break;
        }
      }
    }
    return seqs;
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
    docIdRevIndex = bySeqStore.index('_doc_id_rev');
    winningSeqIndex = docStore.index('seq');

    var seqs = descending ? getDescendingSeqs() : getAscendingSeqs();

    fetchSeqs(seqs);
  }

  function fetchSeqs(seqs) {

    if (canLimitInAdvance && returnDocs) { // know exactly how many we need
      results = new Array(seqs.length);
    } else { // need to filter on-the-fly, or not returning any results
      results = [];
    }

    // fetch latest doc and metadata simultaneously
    var i = -1;
    function next() {
      i++;
      if (i >= seqs.length) {
        return; // done
      }
      var seq = seqs[i];
      fetchMetadataAndLatestDoc(i, seq);
    }

    function fetchMetadataAndLatestDoc(idx, seq) {
      var metadata;
      var doc;

      bySeqStore.get(seq).onsuccess = function (e) {
        doc = decodeDoc(e.target.result);
        if (metadata) {
          onGetChange(metadata, doc, seq, idx, next);
        }
      };
      winningSeqIndex.get(seq).onsuccess = function (e) {
        metadata = decodeMetadata(e.target.result);
        if (doc) {
          onGetChange(metadata, doc, seq, idx, next);
        }
      };
    }

    // If we're able to predict in advance exactly which seqs we need
    // (because there's no doc_ids or filter), then we can just fetch
    // absolutely everything at once. Else we need to iterate one-at-a-time,
    // which is slower. This optimization is designed to help the replication
    // and map/reduce algorithms, which use neither doc_ids nor a filter.
    if (canLimitInAdvance) {
      seqs.forEach(next);
    } else {
      next();
    }
  }

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

  fetchChanges();
}

module.exports = idbChanges;