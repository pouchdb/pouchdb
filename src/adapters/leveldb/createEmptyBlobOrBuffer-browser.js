import createBlob from '../../deps/binary/blob';

function createEmptyBlobOrBuffer(type) {
  return createBlob([''], {type: type});
}

export default createEmptyBlobOrBuffer;