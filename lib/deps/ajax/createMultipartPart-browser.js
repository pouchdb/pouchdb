'use strict';

import binaryStringToArrayBuffer from '../binary/binaryStringToArrayBuffer';

// create a "part" suitable for multipart. in the browser
// this is an ArrayBuffer; in Node it's a binary string
export default  function createMultipartPart(data) {
  return binaryStringToArrayBuffer(data);
};