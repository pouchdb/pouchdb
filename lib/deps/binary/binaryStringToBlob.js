'use strict';

var createBlob = require('./blob');
var binaryStringToArrayBuffer = require('./binaryStringToArrayBuffer');

module.exports = function binaryStringToBlob(binString, type) {
  return createBlob([binaryStringToArrayBuffer(binString)], {type: type});
};