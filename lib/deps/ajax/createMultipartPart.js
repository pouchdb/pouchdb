'use strict';

// create a "part" suitable for multipart. in the browser
// this is an ArrayBuffer; in Node it's a binary string
module.exports = function createMultipartPart(data) {
  return data;
};