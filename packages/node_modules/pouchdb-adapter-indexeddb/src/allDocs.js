'use strict';

import { createError, IDB_ERROR } from 'pouchdb-errors';
import { collectConflicts } from 'pouchdb-merge';

import { DOC_STORE, processAttachment } from './util';

function allDocsKeys(keys, docStore, allDocsInner) {
  // It's not guaranteed to be returned in right order
  const valuesBatch = new Array(keys.length);
  let count = 0;
  keys.forEach(function (key, index) {
    docStore.get(key).onsuccess = function (event) {
      if (event.target.result) {
      valuesBatch[index] = event.target.result;
      } else {
        valuesBatch[index] = {key, error: 'not_found'};
      }
      count++;
      if (count === keys.length) {
        valuesBatch.forEach(function (doc) {
            allDocsInner(doc);
        });
      }
    };
  });
}

function createKeyRange(start, end, inclusiveStart, inclusiveEnd, key, descending) {
  try {
    if (key) {
      return IDBKeyRange.only([0, key]);
    } else if (descending) {
      return IDBKeyRange.bound(end, start, !inclusiveEnd, !inclusiveStart);
    } else {
      return IDBKeyRange.bound(start, end, !inclusiveStart, !inclusiveEnd);
    }
  } catch (e) {
    return {error: e};
  }
}

function handleKeyRangeError(opts, metadata, err, callback) {
  if (err.name === "DataError" && err.code === 0) {
    // data error, start is less than end
    const returnVal = {
      total_rows: metadata.doc_count,
      offset: opts.skip,
      rows: []
    };
    /* istanbul ignore if */
    if (opts.update_seq) {
      returnVal.update_seq = metadata.seq;
    }
    return callback(null, returnVal);
  }
  callback(createError(IDB_ERROR, err.name, err.message));
}

export default function (txn, metadata, opts, callback) {
  if (txn.error) {
    return callback(txn.error);
  }

  // TODO: Weird hack, I don't like it
  if (opts.limit === 0) {
    const returnVal = {
      total_rows: metadata.doc_count,
      offset: opts.skip,
      rows: []
    };

    /* istanbul ignore if */
    if (opts.update_seq) {
      returnVal.update_seq = metadata.seq;
    }
    return callback(null, returnVal);
  }

  const results = [];
  const processing = [];

  const key = 'key' in opts ? opts.key : false;
  const keys = 'keys' in opts ? opts.keys : false;
  let skip = opts.skip || 0;
  let limit = typeof opts.limit === 'number' ? opts.limit : undefined;
  const inclusiveEnd = opts.inclusive_end !== false;
  const descending = 'descending' in opts && opts.descending ? 'prev' : null;
  const start = 'startkey' in opts ? opts.startkey : (descending ?  '\uffff' : '');
  const end   = 'endkey'   in opts ? opts.endkey   : (descending ? '' :  '\uffff');

  const docStore = txn.txn.objectStore(DOC_STORE);

  if (keys) {
    txn.txn.oncomplete = onTxnComplete;
    const allDocsInner = doc => {
      if (doc.error) {
        return results.push(doc);
      }

      const row = { id:doc.id, key:doc.id, value:{ rev:doc.rev } };

      if (doc.deleted) {
        row.value.deleted = true;
        row.doc = null;
      } else if (opts.include_docs) {
        include_doc(row, doc);
      }

      results.push(row);
    };
    return allDocsKeys(keys, docStore, allDocsInner);
  }

  let keyRange = createKeyRange([0, start], [0, end], true, inclusiveEnd, key, descending);
  if (keyRange.error) {
    return handleKeyRangeError(opts, metadata, keyRange.error, callback);
  }

  // txn.oncomplete must be set AFTER key-range-error is generated
  txn.txn.oncomplete = onTxnComplete;

  function include_doc(row, doc) {
    const docData = doc.revs[doc.rev].data;

    row.doc = docData;
    row.doc._id = doc.id;
    row.doc._rev = doc.rev;
    if (opts.conflicts) {
      const conflicts = collectConflicts(doc);
      if (conflicts.length) {
        row.doc._conflicts = conflicts;
      }
    }
    if (opts.attachments && docData._attachments) {
      for (const name in docData._attachments) {
        processing.push(processAttachment(name, doc, row.doc, opts.binary,
            metadata.idb_attachment_format));
      }
    }
  }

  function onTxnComplete() {
    const returnVal = {
      total_rows: metadata.doc_count,
      offset: 0,
      rows: results
    };
    /* istanbul ignore if */
    if (opts.update_seq) {
      returnVal.update_seq = metadata.seq;
    }

    if (processing.length) {
      Promise.all(processing).then(function () {
        callback(null, returnVal);
      });
    } else {
      callback(null, returnVal);
    }
  }

  const dbIndex = docStore.index('deleted,id');

  if (!skip && !limit) {
    fetchResults();
  } else {
    let firstKey;
    let limitKey = limit > 0;

    dbIndex.openKeyCursor(keyRange, descending || 'next').onsuccess = (e) => {
      const cursor = e.target.result;

      if (skip) {
        if (!cursor) { return txn.txn.commit(); }
        cursor.advance(skip);
        skip = 0;
        return;
      }

      if (firstKey === undefined) {
        firstKey = cursor && cursor.key;
        if (!firstKey) { return txn.txn.commit(); }
      }

      if (limit) {
        if (limit > 1 && cursor) {
          cursor.advance(limit - 1);
          limit = undefined;
          return;
        }
        limit = undefined;
      }


      if (limitKey) {
        limitKey = cursor && cursor.key;
      }
      if (!limitKey) {
        limitKey = descending ? keyRange.lower : keyRange.upper;
      }

      keyRange = createKeyRange(firstKey, limitKey, true, inclusiveEnd, key, descending);
      if (keyRange.error) {
        txn.txn.abort();
        return handleKeyRangeError(opts, metadata, keyRange.error, callback);
      }

      fetchResults();
    };
  }

  async function fetchResults() {
    // There is a risk here with getting all results into memory - if they have multiple
    // revs, then we risk loading loads of extra data which is then discarded.  This is
    // reduced by batching.  This also loads unused data when include_docs is false.
    //
    // Current batch size is quite arbitrary, but seems like (1) more than a typical
    // result size, and (2) not so big it's likely to cause issues.
    const batchSize = 100;

    let kr = keyRange;
    do {
      kr = await fetchNextBatch(kr);
    } while (kr);
    if (descending) {
      results.reverse();
    }
    return txn.txn.commit();

    function fetchNextBatch(kr) {
      return new Promise((resolve) => {
        dbIndex.getAll(kr, batchSize).onsuccess = (e) => {
          const batch = e.target.result;
          for (let i=0; i<batch.length; ++i) {
            const doc = batch[i];
            const row = { id:doc.id, key:doc.id, value:{ rev:doc.rev } };
            if (opts.include_docs) {
              include_doc(row, doc);
            }
            results.push(row);
          }

          if (batch.length >= batchSize) {
            const lastSeenKey = [ 0, batch[batch.length-1].id ];
            const startKey = descending ? kr.upper : lastSeenKey;
            const endKey = descending ? lastSeenKey : kr.upper;
            if (startKey[1] !== endKey[1]) {
              const incEnd = descending ? false : inclusiveEnd;
              const incStart = descending ? true : false;
              return resolve(createKeyRange(startKey, endKey, incStart, incEnd, key, descending));
            }
          }
          return resolve();
        };
      });
    }
  }
}
