'use strict';

import Promise from '../promise';
import readAsBinaryString from './readAsBinaryString';
var btoa = require('./base64').btoa;

export default  function blobToBase64(blobOrBuffer) {
  return new Promise(function (resolve) {
    readAsBinaryString(blobOrBuffer, function (bin) {
      resolve(btoa(bin));
    });
  });
};