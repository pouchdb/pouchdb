import typedBuffer from './typedBuffer.js';

function b64ToBluffer(b64, type) {
  return typedBuffer(b64, 'base64', type);
}

export default b64ToBluffer;