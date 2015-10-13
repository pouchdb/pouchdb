'use strict';

import typedBuffer from './typedBuffer';

export default  function (b64, type) {
  return typedBuffer(b64, 'base64', type);
};