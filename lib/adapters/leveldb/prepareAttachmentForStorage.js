'use strict';

// in Node, we store the buffer directly
module.exports = function prepareAttachmentForStorage(attData, cb) {
  process.nextTick(function () {
    cb(attData);
  });
};