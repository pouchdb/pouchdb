'use strict';

import Promise from '../promise';
import readAsBinaryString from './readAsBinaryString';
import btoa from './base64';

export default  function blobToBase64(blobOrBuffer) {
  return new Promise(function (resolve) {
    readAsBinaryString(blobOrBuffer, function (bin) {
      resolve(btoa(bin));
    });
  });
};