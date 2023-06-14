import { b as binStringToBluffer } from './binaryStringToBlobOrBuffer-browser-2c8e268c.js';

function b64ToBluffer(b64, type) {
  return binStringToBluffer(atob(b64), type);
}

export { b64ToBluffer as b };
