'use strict';

var isBrowser = typeof process === 'undefined' || process.browser;
var atob = require('./base64').atob;
var binaryStringToBlobOrBuffer = require('./binaryStringToBlobOrBuffer');
var buffer = require('../buffer');

if (isBrowser) {
  module.exports = function (b64, type) {
    return binaryStringToBlobOrBuffer(atob(b64), type);
  };
} else {
  module.exports = function (b64) {
    return new buffer(b64, 'base64');
  };
}