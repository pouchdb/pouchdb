import { t as typedBuffer } from './typedBuffer-a8220a49.js';

function b64ToBluffer(b64, type) {
  return typedBuffer(b64, 'base64', type);
}

export { b64ToBluffer as b };
