'use strict';

var buffer = require('../binary/buffer');

export default  function defaultBody() {
  return new buffer('', 'binary');
};