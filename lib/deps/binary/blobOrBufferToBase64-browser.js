'use strict';

var Promise = require('../promise');
var readAsBinaryString = require('./readAsBinaryString');
var btoa = require('./base64').btoa;

module.exports = function blobToBase64(blobOrBuffer) {
  return new Promise(function (resolve) {
    readAsBinaryString(blobOrBuffer, function (bin) {
      resolve(btoa(bin));
    });
  });
};