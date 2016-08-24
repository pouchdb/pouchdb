'use strict';

import { createError, IDB_ERROR } from 'pouchdb-errors';
import { btoa, readAsBinaryString } from 'pouchdb-binary-utils';

var DOC_STORE = 'docs';
var META_STORE = 'meta';

function idbError(callback) {
  return function (evt) {
    var message = 'unknown_error';
    if (evt.target && evt.target.error) {
      message = evt.target.error.name || evt.target.error.message;
    }
    callback(createError(IDB_ERROR, message, evt.type));
  };
}

function processAttachment(name, src, doc, isBinary) {

  delete doc._attachments[name].stub;

  if (isBinary) {
    doc._attachments[name].data =
      src.attachments[doc._attachments[name].digest].data;
    return Promise.resolve();
  }

  return new Promise(function (resolve) {
    var data = src.attachments[doc._attachments[name].digest].data;
    readAsBinaryString(data, function (binString) {
      doc._attachments[name].data = btoa(binString);
      delete doc._attachments[name].length;
      resolve();
    });
  });
}

function openTransactionSafely(idb, stores, mode) {
  try {
    return {
      txn: idb.transaction(stores, mode)
    };
  } catch (err) {
    return {
      error: err
    };
  }
}

export {
  DOC_STORE,
  META_STORE,
  idbError,
  processAttachment,
  openTransactionSafely
};
