import bufferFrom from 'buffer-from'; // ponyfill for Node <6

function createBlobOrBufferFromParts(parts) {
  return Buffer.concat(parts.map(function (part) {
    return bufferFrom(part, 'binary');
  }));
}

export default createBlobOrBufferFromParts;
