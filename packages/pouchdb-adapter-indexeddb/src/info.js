'use strict';

export default function(db, metadata, callback) {
  callback(null, {
    doc_count: metadata.doc_count,
    update_seq: metadata.seq
  });
}
