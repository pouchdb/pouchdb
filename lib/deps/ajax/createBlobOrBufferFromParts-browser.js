'use strict';

import createBlob from '../binary/blob';

export default  function createBlobOrBufferFromParts(parts, type) {
  return createBlob(parts, {type: type});
};