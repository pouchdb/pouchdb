import { t as typedBuffer } from './base64StringToBlobOrBuffer-b0e961a1.js';

function binStringToBluffer(binString, type) {
  return typedBuffer(binString, 'binary', type);
}

function blobToBase64(blobOrBuffer, callback) {
  callback(blobOrBuffer.toString('base64'));
}

export { blobToBase64 as a, binStringToBluffer as b };
