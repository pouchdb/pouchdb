'use strict';

var atob = require('./base64').atob;
var binaryStringToBlobOrBuffer = require('./binaryStringToBlobOrBuffer');

module.exports = function (b64, type) {
  return binaryStringToBlobOrBuffer(atob(b64), type);
};