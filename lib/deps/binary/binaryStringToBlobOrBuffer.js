'use strict';

var typedBuffer = require('./typedBuffer');

export default  function (binString, type) {
  return typedBuffer(binString, 'binary', type);
};