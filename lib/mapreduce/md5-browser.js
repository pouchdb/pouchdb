'use strict';

var Md5 = require('spark-md5');

module.exports = function (string) {
  return Md5.hash(string);
};