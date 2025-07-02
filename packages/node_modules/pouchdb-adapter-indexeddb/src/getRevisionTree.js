'use strict';

import { createError, MISSING_DOC } from 'pouchdb-errors';

import {DOC_STORE} from './util';

export default function (txn, id, callback) {
  if (txn.error) {
    return callback(txn.error);
  }

  const req = txn.txn.objectStore(DOC_STORE).get(id);
  req.onsuccess = function (e) {
    if (!e.target.result) {
      callback(createError(MISSING_DOC));
    } else {
      callback(null, e.target.result.rev_tree);
    }
  };
}
