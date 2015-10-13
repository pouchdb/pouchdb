'use strict';

import atob from './base64';
import binaryStringToBlobOrBuffer from './binaryStringToBlobOrBuffer';

export default function (b64, type) {
  return binaryStringToBlobOrBuffer(atob(b64), type);
};