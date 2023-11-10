import createBlob from './blob';
import binaryStringToArrayBuffer from './binaryStringToArrayBuffer';

function binStringToBluffer(binString, type) {
  return createBlob([binaryStringToArrayBuffer(binString)], {type});
}

export default binStringToBluffer;
