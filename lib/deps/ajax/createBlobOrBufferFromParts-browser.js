'use strict';

var createBlob = require('../binary/blob');

export default  function createBlobOrBufferFromParts(parts, type) {
  return createBlob(parts, {type: type});
};