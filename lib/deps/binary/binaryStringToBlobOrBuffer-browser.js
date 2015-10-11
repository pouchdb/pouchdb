'use strict';

var createBlob = require('./blob');
var binaryStringToArrayBuffer = require('./binaryStringToArrayBuffer');

export default  function (binString, type) {
  return createBlob([binaryStringToArrayBuffer(binString)], {type: type});
};