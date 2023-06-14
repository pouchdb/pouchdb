function createEmptyBlobOrBuffer(type) {
  return new Blob([''], {type: type});
}

export default createEmptyBlobOrBuffer;