'use strict';

import { btoa, readAsBinaryString } from 'pouchdb-binary-utils';

import { DOC_STORE } from './util';

function parseAttachment(attachment, opts, cb) {
  if (opts.binary) {
    return cb(null, attachment);
  } else {
    readAsBinaryString(attachment, function (binString) {
      cb(null, btoa(binString));
    });
  }
}

function getAttachment(txn, docId, attachId, _, opts, cb) {
  if (txn.error) {
    return cb(txn.error);
  }

  var attachment;

  txn.txn.objectStore(DOC_STORE).get(docId).onsuccess = function (e) {
    var doc = e.target.result;
    var rev = doc.revs[opts.rev || doc.rev].data;
    var digest = rev._attachments[attachId].digest;
    attachment = doc.attachments[digest].data;
  };

  txn.txn.oncomplete = function () {
    parseAttachment(attachment, opts, cb);
  };

  txn.txn.onabort = cb;
}

export {
  getAttachment,
  parseAttachment
};
