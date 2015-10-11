'use strict';

var toPromise = require('./toPromise');
var crypto = require('crypto');

export default  toPromise(function (data, callback) {
  var base64 = crypto.createHash('md5').update(data).digest('base64');
  callback(null, base64);
});