'use strict';

var Promise = require('../promise');

module.exports = function blobToBase64(blobOrBuffer) {
  return Promise.resolve(blobOrBuffer.toString('base64'));
};