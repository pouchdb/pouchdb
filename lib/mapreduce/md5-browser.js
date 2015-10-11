'use strict';

var Md5 = require('spark-md5');

export default  function (string) {
  return Md5.hash(string);
};