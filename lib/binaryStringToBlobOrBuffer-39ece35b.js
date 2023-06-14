import { t as typedBuffer } from './typedBuffer-a8220a49.js';

function binStringToBluffer(binString, type) {
  return typedBuffer(binString, 'binary', type);
}

export { binStringToBluffer as b };
