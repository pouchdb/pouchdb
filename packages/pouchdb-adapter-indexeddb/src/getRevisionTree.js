// 'use strict'; is default when ESM

import { createError, MISSING_DOC } from 'pouchdb-errors';

import {DOC_STORE} from './util.js';

export default function (txn, id, callback) {
  if (txn.error) {
    return callback(txn.error);
  }

  var req = txn.txn.objectStore(DOC_STORE).get(id);
  req.onsuccess = function (e) {
    if (!e.target.result) {
      callback(createError(MISSING_DOC));
    } else {
      callback(null, e.target.result.rev_tree);
    }
  };
}
