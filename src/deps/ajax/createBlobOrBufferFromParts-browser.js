import createBlob from '../binary/blob';

function createBlobOrBufferFromParts(parts, type) {
  return createBlob(parts, {type: type});
}

export default createBlobOrBufferFromParts;