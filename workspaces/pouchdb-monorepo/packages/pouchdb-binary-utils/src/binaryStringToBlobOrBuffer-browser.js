import createBlob from './blob.js';
import binaryStringToArrayBuffer from './binaryStringToArrayBuffer.js';

function binStringToBluffer(binString, type) {
  return createBlob([binaryStringToArrayBuffer(binString)], {type: type});
}

export default binStringToBluffer;