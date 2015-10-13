'use strict';

import base64 from './base64';
import binaryStringToBlobOrBuffer from './binaryStringToBlobOrBuffer';

export default function (b64, type) {
  return binaryStringToBlobOrBuffer(base64.atob(b64), type);
};