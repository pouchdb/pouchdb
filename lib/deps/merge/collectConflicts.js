'use strict';

var winningRev = require('./winningRev');
var collectLeaves = require('./collectLeaves');

// returns revs of all conflicts that is leaves such that
// 1. are not deleted and
// 2. are different than winning revision
module.exports = function collectConflicts(metadata) {
  var win = winningRev(metadata);
  var leaves = collectLeaves(metadata.rev_tree);
  var conflicts = [];
  for (var i = 0, len = leaves.length; i < len; i++) {
    var leaf = leaves[i];
    if (leaf.rev !== win && !leaf.opts.deleted) {
      conflicts.push(leaf.rev);
    }
  }
  return conflicts;
};