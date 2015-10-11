'use strict';

import buffer from './buffer';
var myAtob;
var myBtoa;

/* istanbul ignore if */
if (typeof atob === 'function') {
  myAtob = function (str) {
    /* global atob */
    return atob(str);
  };
} else {
  myAtob = function (str) {
    var base64 = new buffer(str, 'base64');
    // Node.js will just skip the characters it can't encode instead of
    // throwing and exception
    if (base64.toString('base64') !== str) {
      throw ("Cannot base64 encode full string");
    }
    return base64.toString('binary');
  };
}

/* istanbul ignore if */
if (typeof btoa === 'function') {
  myBtoa = function (str) {
    /* global btoa */
    return btoa(str);
  };
} else {
  myBtoa = function (str) {
    return new buffer(str, 'binary').toString('base64');
  };
}

export default {
  btoa: myBtoa,
  atob: myAtob
};