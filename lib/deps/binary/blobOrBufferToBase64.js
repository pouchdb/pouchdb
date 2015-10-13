'use strict';

import Promise from '../promise';

export default  function blobToBase64(blobOrBuffer) {
  return Promise.resolve(blobOrBuffer.toString('base64'));
};