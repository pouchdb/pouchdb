'use strict';

var merge = require('../../merge');

// check if a specific revision of a doc has been deleted
//  - metadata: the metadata object from the doc store
//  - rev: (optional) the revision to check. defaults to winning revision
function isDeleted(metadata, rev) {
  if (!rev) {
    rev = merge.winningRev(metadata);
  }
  var dashIndex = rev.indexOf('-');
  if (dashIndex !== -1) {
    rev = rev.substring(dashIndex + 1);
  }
  var deleted = false;
  merge.traverseRevTree(metadata.rev_tree,
    function (isLeaf, pos, id, acc, opts) {
      if (id === rev) {
        deleted = !!opts.deleted;
      }
    });

  return deleted;
}

module.exports = isDeleted;