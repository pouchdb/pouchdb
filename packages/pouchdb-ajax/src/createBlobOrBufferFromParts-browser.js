import {blob as createBlob } from 'pouchdb-utils';

function createBlobOrBufferFromParts(parts, type) {
  return createBlob(parts, {type: type});
}

export default createBlobOrBufferFromParts;