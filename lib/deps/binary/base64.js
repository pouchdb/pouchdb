'use strict';

var buffer = require('./buffer');

exports.atob = function (str) {
  var base64 = new buffer(str, 'base64');
  // Node.js will just skip the characters it can't decode instead of
  // throwing an exception
  if (base64.toString('base64') !== str) {
    throw new Error("attachment is not a valid base64 string");
  }
  return base64.toString('binary');
};

exports.btoa = function (str) {
  return new buffer(str, 'binary').toString('base64');
};