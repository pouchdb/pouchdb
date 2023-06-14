import { t as thisAtob } from './base64-browser-5f7b6479.js';
import { a as binStringToBluffer } from './binaryStringToBlobOrBuffer-browser-7dc25c1d.js';

function b64ToBluffer(b64, type) {
  return binStringToBluffer(thisAtob(b64), type);
}

export { b64ToBluffer as b };
