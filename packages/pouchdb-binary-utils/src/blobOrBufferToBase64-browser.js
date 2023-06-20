import { btoa } from './base64.js';
import blobOrBufferToBinaryString from './blobOrBufferToBinaryString.js';

function blobToBase64(blobOrBuffer, callback) {
  blobOrBufferToBinaryString(blobOrBuffer, function (base64) {
    callback(btoa(base64));
  });
}

export default blobToBase64;