'use strict';

var typedBuffer = require('../../deps/binary/typedBuffer');

module.exports = function createEmptyBlobOrBuffer(type) {
  return typedBuffer('', 'binary', type);
};