'use strict';

var typedBuffer = require('./typedBuffer');

module.exports = function (b64, type) {
  return typedBuffer(b64, 'base64', type);
};