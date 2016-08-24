'use strict';

import { btoa, readAsBinaryString } from 'pouchdb-binary-utils';

import { DOC_STORE, openTransactionSafely } from './util';

export default function (db, docId, attachId, opts, cb) {

  var openTxn = openTransactionSafely(db, [DOC_STORE], 'readonly');
  if (openTxn.error) {
    return cb(openTxn.error);
  }

  var attachment;

  openTxn.txn.objectStore(DOC_STORE).get(docId).onsuccess = function (e) {
    var doc = e.target.result;
    var rev = opts.rev ? doc.revs[opts.rev].data : doc.data;
    var digest = rev._attachments[attachId].digest;
    attachment = doc.attachments[digest].data;
  };

  openTxn.txn.oncomplete = function () {
    if (opts.binary) {
      cb(null, attachment);
    } else {
      readAsBinaryString(attachment, function (binString) {
        cb(null, btoa(binString));
      });
    }
  };

  openTxn.txn.onabort = cb;
}
