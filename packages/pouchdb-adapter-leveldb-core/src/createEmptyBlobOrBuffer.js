import { typedBuffer } from 'pouchdb-utils';

function createEmptyBlobOrBuffer(type) {
  return typedBuffer('', 'binary', type);
}

export default createEmptyBlobOrBuffer;