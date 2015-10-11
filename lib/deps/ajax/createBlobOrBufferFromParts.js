'use strict';

var buffer = require('../binary/buffer');

export default  function createBlobOrBufferFromParts(parts, type) {
  return buffer.concat(parts.map(function (part) {
    return new buffer(part, 'binary');
  }));
};