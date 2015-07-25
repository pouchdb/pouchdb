'use strict';

var typedBuffer = require('./typedBuffer');

module.exports = function (binString, type) {
  return typedBuffer(binString, 'binary', type);
};