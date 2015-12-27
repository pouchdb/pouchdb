'use strict';

import typedBuffer from '../../deps/binary/typedBuffer';

module.exports = function createEmptyBlobOrBuffer(type) {
  return typedBuffer('', 'binary', type);
};