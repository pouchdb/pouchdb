'use strict';

var Promise = require('../promise');

export default  function blobToBase64(blobOrBuffer) {
  return Promise.resolve(blobOrBuffer.toString('base64'));
};