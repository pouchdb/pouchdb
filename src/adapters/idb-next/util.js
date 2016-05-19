'use strict';

import { createError, IDB_ERROR } from '../../deps/errors';

import readAsBinaryString from '../../deps/binary/readAsBinaryString';
import { btoa } from '../../deps/binary/base64';

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
};

function processAttachment(name, src, doc, isBinary) {

  delete doc._attachments[name].stub;

  if (isBinary) {
    doc._attachments[name].data =
      src.attachments[doc._attachments[name].digest].data;
    return Promise.resolve();
  }

  return new Promise(function(resolve) {
    var data = src.attachments[doc._attachments[name].digest].data;
    readAsBinaryString(data, function(binString) {
      doc._attachments[name].data = btoa(binString);
      delete doc._attachments[name].length;
      resolve();
    });
  });
};

export {
  DOC_STORE,
  META_STORE,
  idbError,
  processAttachment
};
