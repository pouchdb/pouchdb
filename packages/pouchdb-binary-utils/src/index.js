import base64StringToBlobOrBuffer from './base64StringToBlobOrBuffer';
import binaryStringToArrayBuffer from './binaryStringToArrayBuffer';
import binaryStringToBlobOrBuffer from './binaryStringToBlobOrBuffer';

import blobOrBufferToBase64 from './blobOrBufferToBase64';
import blobOrBufferToBinaryString from './blobOrBufferToBinaryString';
import readAsArrayBuffer from './readAsArrayBuffer';
import readAsBinaryString from './readAsBinaryString';
import typedBuffer from './typedBuffer';
// export const atob = globalThis.atob;
// export const btoa = globalThis.btoa;
// export const blob = (data) => new Blob([].concat(data));
export {
  base64StringToBlobOrBuffer,
  binaryStringToArrayBuffer,
  binaryStringToBlobOrBuffer,
  blobOrBufferToBase64,
  blobOrBufferToBinaryString,
  readAsArrayBuffer,
  readAsBinaryString,
  typedBuffer
};