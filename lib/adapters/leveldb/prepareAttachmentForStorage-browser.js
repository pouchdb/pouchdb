'use strict';

var readAsBinaryString = require('../../deps/binary/readAsBinaryString');

// In the browser, we store a binary string
module.exports = function prepareAttachmentForStorage(attData, cb) {
  readAsBinaryString(attData, cb);
};