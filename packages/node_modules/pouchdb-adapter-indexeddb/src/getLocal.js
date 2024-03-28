import { createError, MISSING_DOC } from 'pouchdb-errors';

import { META_LOCAL_STORE, processAttachment } from './util';

// _getLocal() doesn't know if opts.binary is set or not, so assume it's not.
const BINARY_ATTACHMENTS = false;

export default function (txn, id, api, callback) {
  if (txn.error) {
    return callback(txn.error);
  }

  txn.txn.objectStore(META_LOCAL_STORE).get(id).onsuccess = function (e) {
    const doc = e.target.result;

    if (!doc) {
      callback(createError(MISSING_DOC, 'missing'));
      return;
    }

    const result = doc.revs[doc.rev].data;
    result._id = doc.id;
    result._rev = doc.rev;

    if (result._attachments) {
      const processing = [];
      for (const name in result._attachments) {
        processing.push(processAttachment(name, doc, result, BINARY_ATTACHMENTS, api.blobSupport));
      }
      Promise.all(processing)
        .then(() => callback(null, result))
        .catch(callback);
    } else {
      callback(null, result);
    }
  };
}
