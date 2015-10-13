'use strict';

import typedBuffer from './typedBuffer';

export default  function (binString, type) {
  return typedBuffer(binString, 'binary', type);
};