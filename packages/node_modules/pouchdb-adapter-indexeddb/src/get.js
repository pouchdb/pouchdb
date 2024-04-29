'use strict';

import { createError, MISSING_DOC } from 'pouchdb-errors';

import { DOC_STORE } from './util';

import { latest as getLatest } from 'pouchdb-merge';

export default function (txn, id, opts, callback) {
  if (txn.error) {
    return callback(txn.error);
  }

  txn.txn.objectStore(DOC_STORE).get(id).onsuccess = function (e) {
    const doc = e.target.result;
    let rev;
    if (!opts.rev) {
      rev = (doc && doc.rev);
    } else {
      rev = opts.latest ? getLatest(opts.rev, doc) : opts.rev;
    }

    if (!doc || (doc.deleted && !opts.rev) || !(rev in doc.revs)) {
      callback(createError(MISSING_DOC, 'missing'));
      return;
    }

    const result = doc.revs[rev].data;
    result._id = doc.id;
    result._rev = rev;

    // WARNING: expecting possible old format
    // TODO: why are we passing the transaction in the context?
    //       It's not clear we ever thread these txns usefully
    callback(null, {
      doc: result,
      metadata: doc,
      ctx: txn
    });
  };
}
