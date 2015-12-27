import buffer from '../binary/buffer';

function createBlobOrBufferFromParts(parts, type) {
  return buffer.concat(parts.map(function (part) {
    return new buffer(part, 'binary');
  }));
}

export default createBlobOrBufferFromParts;