'use strict';

// non-standard, but we do this to mimic blobs in the browser
module.exports = function (buffer, resp) {
  buffer.type = resp.headers['content-type'];
};