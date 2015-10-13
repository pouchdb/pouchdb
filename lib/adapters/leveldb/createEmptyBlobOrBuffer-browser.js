'use strict';

import createBlob from '../../deps/binary/blob';

export default  function createEmptyBlobOrBuffer(type) {
  return createBlob([''], {type: type});
};