'use strict';

import createBlob from '../../deps/binary/blob';

export default  function readAsBlobOrBuffer(storedObject, type) {
  // In the browser, we've stored a binary string. This now comes back as a
  // browserified Node-style Buffer, but we want a Blob instead.
  return createBlob([storedObject.toArrayBuffer()], {type: type});
};