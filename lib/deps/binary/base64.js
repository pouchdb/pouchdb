'use strict';

var buffer = require('./../buffer');

if (typeof atob === 'function') {
  exports.atob = function (str) {
    /* global atob */
    return atob(str);
  };
} else {
  exports.atob = function (str) {
    var base64 = new buffer(str, 'base64');
    // Node.js will just skip the characters it can't encode instead of
    // throwing and exception
    if (base64.toString('base64') !== str) {
      throw ("Cannot base64 encode full string");
    }
    return base64.toString('binary');
  };
}

if (typeof btoa === 'function') {
  exports.btoa = function (str) {
    /* global btoa */
    return btoa(str);
  };
} else {
  exports.btoa = function (str) {
    return new buffer(str, 'binary').toString('base64');
  };
}