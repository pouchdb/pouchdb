import { r as readAsBinaryString } from './readAsBinaryString-06e911ba.js';

var thisBtoa = function (str) {
  return btoa(str);
};

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

export { blobToBase64 as a, blobToBinaryString as b };
