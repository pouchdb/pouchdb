import { blob as createBlob } from 'pouchdb-utils';

function createEmptyBlobOrBuffer(type) {
  return createBlob([''], {type: type});
}

export default createEmptyBlobOrBuffer;