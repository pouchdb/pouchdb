'use strict';

var isBrowser = typeof process === 'undefined' || process.browser;
var buffer = require('../buffer');

var createBlob = require('./blob');
var binaryStringToArrayBuffer = require('./binaryStringToArrayBuffer');

if (isBrowser) {
  module.exports = function (binString, type) {
    return createBlob([binaryStringToArrayBuffer(binString)], {type: type});
  };
} else {
  module.exports = function (binString) {
    return new buffer(binString, 'binary');
  };
}