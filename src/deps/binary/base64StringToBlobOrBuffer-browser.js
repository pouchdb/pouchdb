import { atob as atob } from './base64';
import binaryStringToBlobOrBuffer from './binaryStringToBlobOrBuffer';

function b64ToBluffer(b64, type) {
  return binaryStringToBlobOrBuffer(atob(b64), type);
}

export default b64ToBluffer;