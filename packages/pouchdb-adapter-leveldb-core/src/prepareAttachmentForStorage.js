// in Node, we store the buffer directly
function prepareAttachmentForStorage(attData, cb) {
  process.nextTick(function () {
    cb(attData);
  });
}

export default prepareAttachmentForStorage;