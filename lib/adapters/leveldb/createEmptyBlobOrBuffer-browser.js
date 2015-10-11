'use strict';

var createBlob = require('../../deps/binary/blob');

export default  function createEmptyBlobOrBuffer(type) {
  return createBlob([''], {type: type});
};