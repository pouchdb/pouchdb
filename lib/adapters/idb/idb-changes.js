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

  var txn;
  var bySeqStore;
  var docStore;
  var docIdRevIndex;
  var winningSeqIndex;

  function onGetMetadata(metadata, latestDoc, seq, next) {

    lastSeq = Math.max(lastSeq, seq);

    if (docIds && !docIds.has(metadata.id)) {
      return next();
    }

    function fetchWinningDoc() {
      if (latestDoc._rev === metadata.winningRev) {
        // latest doc is also winning doc
        return onGetWinningDoc(latestDoc);
      }

      var docIdRev = metadata.id + '::' + metadata.winningRev;
      var req = docIdRevIndex.get(docIdRev);
      req.onsuccess = function (e) {
        onGetWinningDoc(decodeDoc(e.target.result));
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
        next();
      }
    }

    fetchWinningDoc();
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

    var seqs = [];

    // else need to fetch everything and filter later
    var canUseLimit = opts.limit !== -1 && !opts.filter && !docIds;

    if (descending) {
      for (var seq in api._winningSeqs) {
        if (api._winningSeqs.hasOwnProperty(seq)) {
          seqs.push(parseInt(seq, 10));
        }
      }
      seqs = seqs.reverse();
      if (canUseLimit && seqs.length > opts.limit) {
        seqs = seqs.slice(0, opts.limit);
      }
    } else {
      for (var i = opts.since + 1; i < api._winningSeqs.length; i++) {
        if (api._winningSeqs[i]) {
          seqs.push(i);
          if (canUseLimit && seqs.length === opts.limit) {
            break;
          }
        }
      }
    }

    // fetch latest doc and metadata simultaneously
    var current = 0;
    function next() {
      if (current === seqs.length) {
        return; // done
      }
      var seq = seqs[current++];
      var metadata;
      var doc;
      bySeqStore.get(seq).onsuccess = function (e) {
        doc = decodeDoc(e.target.result);
        if (metadata) {
          onGetMetadata(metadata, doc, seq, next);
        }
      };
      winningSeqIndex.get(seq).onsuccess = function (e) {
        metadata = decodeMetadata(e.target.result);
        if (doc) {
          onGetMetadata(metadata, doc, seq, next);
        }
      };
    }
    next();
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