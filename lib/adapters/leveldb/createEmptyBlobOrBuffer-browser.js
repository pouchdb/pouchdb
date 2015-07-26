'use strict';

var createBlob = require('../../deps/binary/blob');

module.exports = function createEmptyBlobOrBuffer(type) {
  return createBlob([''], {type: type});
};