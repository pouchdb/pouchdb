'use strict';

var binToBluffer = require('../../deps/binary/binaryStringToBlobOrBuffer');

module.exports = function readAsBlobOrBuffer(storedObject, type) {
  // In the browser, we've stored a binary string
  return binToBluffer(storedObject, type);
};