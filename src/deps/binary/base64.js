'use strict';

import buffer from './buffer';

var atob = function (str) {
  var base64 = new buffer(str, 'base64');
  // Node.js will just skip the characters it can't decode instead of
  // throwing an exception
  if (base64.toString('base64') !== str) {
    throw new Error("attachment is not a valid base64 string");
  }
  return base64.toString('binary');
};

var btoa = function (str) {
  return new buffer(str, 'binary').toString('base64');
};

export {
  atob as atob,
  btoa as btoa
};