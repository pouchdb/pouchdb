'use strict';

var crypto = require('crypto');

export default  function (string) {
  return crypto.createHash('md5').update(string).digest('hex');
};