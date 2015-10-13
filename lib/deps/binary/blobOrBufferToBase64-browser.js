'use strict';

import Promise from '../promise';
import readAsBinaryString from './readAsBinaryString';
import base64 from './base64';

export default  function blobToBase64(blobOrBuffer) {
  return new Promise(function (resolve) {
    readAsBinaryString(blobOrBuffer, function (bin) {
      resolve(base64.btoa(bin));
    });
  });
};