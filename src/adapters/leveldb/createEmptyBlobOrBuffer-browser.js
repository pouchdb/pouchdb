'use strict';

import createBlob from '../../deps/binary/blob';

module.exports = function createEmptyBlobOrBuffer(type) {
  return createBlob([''], {type: type});
};