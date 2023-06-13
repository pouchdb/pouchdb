'use strict';

export default function (metadata, callback) {
  callback(null, {
    doc_count: metadata.doc_count,
    update_seq: metadata.seq
  });
}
