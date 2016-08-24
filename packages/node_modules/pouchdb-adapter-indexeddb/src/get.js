'use strict';

import { createError, MISSING_DOC } from 'pouchdb-errors';

import { DOC_STORE, openTransactionSafely } from './util';

export default function (db, id, opts, callback) {

  var openTxn = openTransactionSafely(db, [DOC_STORE], 'readonly');
  if (openTxn.error) {
    return callback(openTxn.error);
  }

  openTxn.txn.objectStore(DOC_STORE).get(id).onsuccess = function (e) {

    var doc = e.target.result;
    var rev = opts.rev || (doc && doc.rev);

    if (!doc || (doc.deleted && !opts.rev) || !(rev in doc.revs)) {
      callback(createError(MISSING_DOC, 'missing'));
      return;
    }

    var result = doc.revs[rev].data;
    result._id = doc.id;
    result._rev = rev;

    // WARNING: expecting possible old format
    callback(null, {
      doc: result,
      metadata: doc,
      ctx: openTxn
    });

  };
}
