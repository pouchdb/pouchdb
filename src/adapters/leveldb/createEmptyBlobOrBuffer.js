import typedBuffer from '../../deps/binary/typedBuffer';

function createEmptyBlobOrBuffer(type) {
  return typedBuffer('', 'binary', type);
}

export default createEmptyBlobOrBuffer;