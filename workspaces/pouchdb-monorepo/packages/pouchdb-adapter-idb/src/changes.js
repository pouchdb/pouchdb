import ChangesHandler from './ChangesHandler';
import {
  clone,
  filterChange,
  uuid
} from 'pouchdb-utils';
import {
  ATTACH_STORE,
  BY_SEQ_STORE,
  DOC_STORE
} from './constants';
import {
  decodeDoc,
  decodeMetadata,
  fetchAttachmentsIfNecessary,
  idbError,
  postProcessAttachments,
  openTransactionSafely
} from './utils';
import runBatchedCursor from './runBatchedCursor';

async function changes(opts, api, dbName, idb) {
  opts = clone(opts);

  if (opts.continuous) {
    const id = `${dbName}:${await uuid()}`;
    ChangesHandler.addListener(dbName, id, api, opts);
    ChangesHandler.notify(dbName);
    return {
      cancel() {
        ChangesHandler.removeListener(dbName, id);
      }
    };
  }

  const docIds = opts.doc_ids && new Set(opts.doc_ids);

  opts.since = opts.since || 0;
  let lastSeq = opts.since;

  let limit = 'limit' in opts ? opts.limit : -1;
  if (limit === 0) {
    limit = 1; // per CouchDB _changes spec
  }

  const results = [];
  let numResults = 0;
  const filter = filterChange(opts);
  const docIdsToMetadata = new Map();

  let txn;
  let bySeqStore;
  let docStore;
  let docIdRevIndex;

  function onBatch(batchKeys, batchValues, cursor) {
    if (!cursor || !batchKeys.length) { // done
      return;
    }

    const winningDocs = new Array(batchKeys.length);
    const metadatas = new Array(batchKeys.length);

    function processMetadataAndWinningDoc(metadata, winningDoc) {
      const change = opts.processChange(winningDoc, metadata, opts);
      lastSeq = change.seq = metadata.seq;

      const filtered = filter(change);
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
        return new Promise(resolve => {
          fetchAttachmentsIfNecessary(winningDoc, opts, txn, () => {
            postProcessAttachments([change], opts.binary).then(() => {
              resolve(change);
            });
          });
        });
      } else {
        return Promise.resolve(change);
      }
    }

    function onBatchDone() {
      Promise.all(winningDocs.map((winningDoc,limit) => 
      numResults !== limit && winningDoc && [winningDoc,limit]).filter(x=>x)
      .map(([winningDoc,idx])=>
      processMetadataAndWinningDoc(metadatas[idx], winningDoc))).then((changes) => 
      changes.filter(isDefined=>isDefined).forEach(opts.onChange)
      ).catch(opts.complete);

      if (numResults !== limit) {
        cursor.continue();
      }
    }

    // Fetch all metadatas/winningdocs from this batch in parallel, then process
    // them all only once all data has been collected. This is done in parallel
    // because it's faster than doing it one-at-a-time.
    let numDone = 0;
    batchValues.forEach((value, i) => {
      const doc = decodeDoc(value);
      const seq = batchKeys[i];
      fetchWinningDocAndMetadata(doc, seq, (metadata, winningDoc) => {
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
    const docIdRev = `${doc._id}::${metadata.winningRev}`;
    const req = docIdRevIndex.get(docIdRev);
    req.onsuccess = ({target}) => {
      cb(metadata, decodeDoc(target.result));
    };
  }

  function fetchWinningDocAndMetadata(doc, seq, cb) {
    if (docIds && !docIds.has(doc._id)) {
      return cb();
    }

    let metadata = docIdsToMetadata.get(doc._id);
    if (metadata) { // cached
      return onGetMetadata(doc, seq, metadata, cb);
    }
    // metadata not cached, have to go fetch it
    docStore.get(doc._id).onsuccess = ({target}) => {
      metadata = decodeMetadata(target.result);
      docIdsToMetadata.set(doc._id, metadata);
      onGetMetadata(doc, seq, metadata, cb);
    };
  }

  function finish() {
    opts.complete(null, {
      results,
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

  const objectStores = [DOC_STORE, BY_SEQ_STORE];
  if (opts.attachments) {
    objectStores.push(ATTACH_STORE);
  }
  const txnResult = openTransactionSafely(idb, objectStores, 'readonly');
  if (txnResult.error) {
    return opts.complete(txnResult.error);
  }
  txn = txnResult.txn;
  txn.onabort = idbError(opts.complete);
  txn.oncomplete = onTxnComplete;

  bySeqStore = txn.objectStore(BY_SEQ_STORE);
  docStore = txn.objectStore(DOC_STORE);
  docIdRevIndex = bySeqStore.index('_doc_id_rev');

  const keyRange = (opts.since && !opts.descending) ?
    IDBKeyRange.lowerBound(opts.since, true) : null;

  runBatchedCursor(bySeqStore, keyRange, opts.descending, limit, onBatch);
}

export default changes;
