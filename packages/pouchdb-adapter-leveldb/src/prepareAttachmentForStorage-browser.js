import { readAsBinaryString } from 'pouchdb-utils';

// In the browser, we store a binary string
function prepareAttachmentForStorage(attData, cb) {
  readAsBinaryString(attData, cb);
}

export default prepareAttachmentForStorage;