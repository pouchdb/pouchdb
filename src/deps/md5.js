var crypto = require('crypto');
exports.MD5 = function(string) {
  var hash = new crypto.Hash('md5');
  hash.update(string);
  return hash.digest('hex');
}