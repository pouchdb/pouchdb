import Promise from '../promise';
import readAsBinaryString from './readAsBinaryString';
import { btoa as btoa } from './base64';

function blobToBase64(blobOrBuffer) {
  return new Promise(function (resolve) {
    readAsBinaryString(blobOrBuffer, function (bin) {
      resolve(btoa(bin));
    });
  });
}

export default blobToBase64;