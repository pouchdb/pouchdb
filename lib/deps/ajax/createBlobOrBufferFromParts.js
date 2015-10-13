'use strict';

import buffer from '../binary/buffer';

export default  function createBlobOrBufferFromParts(parts, type) {
  return buffer.concat(parts.map(function (part) {
    return new buffer(part, 'binary');
  }));
};