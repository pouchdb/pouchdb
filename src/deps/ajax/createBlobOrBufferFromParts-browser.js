'use strict';

import createBlob from '../binary/blob';

module.exports = function createBlobOrBufferFromParts(parts, type) {
  return createBlob(parts, {type: type});
};