'use strict';

var typedBuffer = require('../../deps/binary/typedBuffer');

export default  function createEmptyBlobOrBuffer(type) {
  return typedBuffer('', 'binary', type);
};