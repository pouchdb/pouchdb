'use strict';

import { DOC_STORE, readBlobData } from './util';

import readAsBinaryString from '../../deps/binary/readAsBinaryString';
import { btoa } from '../../deps/binary/base64';

export default function(db, docId, attachId, opts, cb) {

  var txn = opts.ctx;
  if (!txn) {
    txn = db.transaction([DOC_STORE], 'readonly');
  }

  txn.objectStore(DOC_STORE).get(docId).onsuccess = function (e) {

    var doc = e.target.result;
    var rev = opts.rev ? doc.revs[opts.rev].data : doc.data;
    var digest = rev._attachments[attachId].digest;

    if (opts.binary) {
      cb(null, doc.attachments[digest].data);
    } else {
      readAsBinaryString(doc.attachments[digest].data, function(binString) {
        cb(null, btoa(binString));
      });
    }
  }
}
