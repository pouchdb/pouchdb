'use strict';

var atob = require('./base64').atob;
var binaryStringToBlobOrBuffer = require('./binaryStringToBlobOrBuffer');

export default  function (b64, type) {
  return binaryStringToBlobOrBuffer(atob(b64), type);
};