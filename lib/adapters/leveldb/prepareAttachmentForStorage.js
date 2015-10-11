export default function prepareAttachmentForStorage(attData, cb) {
  process.nextTick(function () {
    cb(attData);
  });
};