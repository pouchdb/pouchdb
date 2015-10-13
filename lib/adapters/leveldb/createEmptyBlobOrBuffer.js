'use strict';

import typedBuffer from '../../deps/binary/typedBuffer';

export default  function createEmptyBlobOrBuffer(type) {
  return typedBuffer('', 'binary', type);
};