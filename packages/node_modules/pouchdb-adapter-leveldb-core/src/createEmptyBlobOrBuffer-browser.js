import { blob as createBlob } from 'pouchdb-binary-utils';

function createEmptyBlobOrBuffer(type) {
  return createBlob([''], {type});
}

export default createEmptyBlobOrBuffer;
