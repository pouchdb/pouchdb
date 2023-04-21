import typedBuffer from './typedBuffer';

function binStringToBluffer(binString, type) {
  return typedBuffer(binString, 'binary', type);
}

export default binStringToBluffer;