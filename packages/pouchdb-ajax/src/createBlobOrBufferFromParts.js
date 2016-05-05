function createBlobOrBufferFromParts(parts) {
  return Buffer.concat(parts.map(function (part) {
    return new Buffer(part, 'binary');
  }));
}

export default createBlobOrBufferFromParts;
