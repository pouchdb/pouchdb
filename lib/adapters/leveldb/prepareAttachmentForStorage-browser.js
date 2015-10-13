'use strict';

import readAsBinaryString from '../../deps/binary/readAsBinaryString';

// In the browser, we store a binary string
export default  function prepareAttachmentForStorage(attData, cb) {
  readAsBinaryString(attData, cb);
};