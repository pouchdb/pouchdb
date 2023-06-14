export { b as base64StringToBlobOrBuffer } from './base64StringToBlobOrBuffer-browser-ee4c0b54.js';
export { b as binaryStringToBlobOrBuffer } from './binaryStringToBlobOrBuffer-browser-2c8e268c.js';
export { a as blobOrBufferToBase64, b as blobOrBufferToBinaryString } from './blobOrBufferToBase64-browser-35d54d5e.js';
export { r as readAsArrayBuffer } from './readAsArrayBuffer-625b2d33.js';
export { r as readAsBinaryString } from './readAsBinaryString-06e911ba.js';

// From http://stackoverflow.com/questions/14967647/ (continues on next line)
// encode-decode-image-with-base64-breaks-image (2013-04-21)
function binaryStringToArrayBuffer(bin) {
  var length = bin.length;
  var buf = new ArrayBuffer(length);
  var arr = new Uint8Array(buf);
  for (var i = 0; i < length; i++) {
    arr[i] = bin.charCodeAt(i);
  }
  return buf;
}

// this is not used in the browser
function typedBuffer() {
}

export { binaryStringToArrayBuffer, typedBuffer };
