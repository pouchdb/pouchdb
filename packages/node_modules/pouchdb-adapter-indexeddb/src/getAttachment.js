'use strict';

import { isLocalId } from 'pouchdb-adapter-utils';
import { createError, MISSING_DOC } from 'pouchdb-errors';
import {
  base64StringToBlobOrBuffer as b64StringToBluffer,
  btoa,
  readAsBinaryString,
} from 'pouchdb-binary-utils';

export default function getAttachment(docId, attachId, attachment, opts, cb) {
  if (isLocalId(docId)) {
    cb(createError(MISSING_DOC, 'missing'));
    return;
  }

  const doc = opts.metadata;
  const data = doc.attachments[attachment.digest].data;

  if (typeof data === 'string') {
    if (opts.binary) {
      cb(null, b64StringToBluffer(data, attachment.content_type));
    } else {
      cb(null, data);
    }
    return;
  }

  if (opts.binary) {
    return cb(null, data);
  } else {
    readAsBinaryString(data, function (binString) {
      cb(null, btoa(binString));
    });
  }
}
