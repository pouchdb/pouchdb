'use strict';

import createBlob from './blob';
import binaryStringToArrayBuffer from './binaryStringToArrayBuffer';

export default  function (binString, type) {
  return createBlob([binaryStringToArrayBuffer(binString)], {type: type});
};