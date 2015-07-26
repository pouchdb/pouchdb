'use strict';

var buffer = require('../binary/buffer');

module.exports = function defaultBody() {
  return new buffer('', 'binary');
};