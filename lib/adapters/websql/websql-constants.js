'use strict';

function quote(str) {
  return "'" + str + "'";
}

exports.ADAPTER_VERSION = 7; // used to manage migrations

// The object stores created for each database
// DOC_STORE stores the document meta data, its revision history and state
exports.DOC_STORE = quote('document-store');
// BY_SEQ_STORE stores a particular version of a document, keyed by its
// sequence id
exports.BY_SEQ_STORE = quote('by-sequence');
// Where we store attachments
exports.ATTACH_STORE = quote('attach-store');
exports.LOCAL_STORE = quote('local-store');
exports.META_STORE = quote('metadata-store');
// where we store many-to-many relations between attachment
// digests and seqs
exports.ATTACH_AND_SEQ_STORE = quote('attach-seq-store');

