import { a as thisBtoa } from './base64-browser-5f7b6479.js';
import { r as readAsBinaryString } from './readAsBinaryString-06e911ba.js';

function blobToBinaryString(blobOrBuffer, callback) {
  readAsBinaryString(blobOrBuffer, function (bin) {
    callback(bin);
  });
}

function blobToBase64(blobOrBuffer, callback) {
  blobToBinaryString(blobOrBuffer, function (base64) {
    callback(thisBtoa(base64));
  });
}

export { blobToBinaryString as a, blobToBase64 as b };
