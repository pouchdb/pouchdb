'use strict';

var atob = require('./base64').atob;
import binaryStringToBlobOrBuffer from './binaryStringToBlobOrBuffer';

export default  function (b64, type) {
  return binaryStringToBlobOrBuffer(atob(b64), type);
};