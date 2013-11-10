/*globals require, test: true */

'use strict';

var test = require('tape');
var PouchMerge = require('../../src/pouch.merge.js');

var merge = PouchMerge.merge;
var winningRev = PouchMerge.winningRev;

// Set of predefined trees used in various tests
var one = {pos: 1, ids: ['1', {}, []]};
var two = {pos: 1, ids: ['2', {}, []]};
var twoSibs = [one, two];
var three = {pos: 1, ids: ['3', {}, []]};
var threeSibs = [one, two, three];
var stemmed1b = {pos: 2, ids: ['1a', {}, []]};
var stemmed1bb = {pos:3, ids: ['1bb', {}, []]};
var stemmed1aa = {pos: 3, ids: ['1aa', {}, []]};
var stemmed1a = {pos: 2, ids: ['1a', {}, [['1aa', {}, []]]]};
var oneChild = {pos: 1, ids: ['1', {}, [['1a', {}, []]]]};

var simple = {
  pos: 1,
  ids: ['1', {}, []]
};

var two0 = {
  pos: 1,
  ids: ['1', {}, [['2_0', {}, []]]]
};

var two1 = {
  pos: 1,
  ids: ['1', {}, [['2_1', {}, []]]]
};

var newleaf = {
  pos: 2, ids: ['2_0', {}, [['3', {}, []]]]
};

var withnewleaf = {
  pos: 1,
  ids: ['1', {}, [['2_0', {}, [['3', {}, []]]]]]
};

var newbranch = {
  pos: 1,
  ids: ['1', {}, [['2_0', {}, []], ['2_1', {}, []]]]
};

var newdeepbranch = {
  pos: 2, ids: ['2_0', {}, [['3_1', {}, []]]]
};

var stemmededit = {
  pos: 3, ids: ['3', {}, []]
};

var stemmedconflicts = [simple, stemmededit];

var newbranchleaf = {
  pos: 1,
  ids: ['1', {}, [['2_0', {}, [['3', {}, []]]], ['2_1', {}, []]]]
};

var newbranchleafbranch = {
  pos: 1,
  ids: ['1', {}, [
    ['2_0', {}, [['3', {}, []], ['3_1', {}, []]]],
    ['2_1', {}, []]
  ]]
};

var stemmed2 = [
  {pos: 1, ids: ['1', {}, [['2_1', {}, []]]]},
  {pos: 2, ids: ['2_0', {}, [['3', {}, []], ['3_1', {}, []]]]}
];

var stemmed3 = [
  {pos: 2, ids: ['2_1', {}, []]},
  {pos: 3, ids: ['3', {}, []]},
  {pos: 3, ids: ['3_1', {}, []]}
];

var partialrecover = [
  {pos: 1, ids: ['1', {}, [['2_0', {}, [['3', {}, []]]]]]},
  {pos: 2, ids: ['2_1', {}, []]},
  {pos: 3, ids: ['3_1', {}, []]}
];

var tree1 = [
  {"pos":1,"ids":[
    "bfe70372c90ded1087239e5191984f76", {}, [
      ["44d71a718b90e4696c06a90e08912c8f", {}, []],
      ["56e657612d55ab1a402dcb281c874f2a", {}, [
        ["93c3db16462f656f7172ccabd3cf6cd6", {}, []]
      ]]
    ]]
  }];

// this one is from issue #293
var tree2 = [
  {"pos": 1,"ids": [
    "203db1a1810a838895d561f67b224b5d", {}, [
      ["bf5e08a4f9fa6d33a53f4a00ae3ea399", {}, [
        ["28cd77a3ca30f79e1cfffcd6a41ca308", {}, []]
      ]]
    ]
  ]},
  {"pos": 1,"ids": [
    "c6d5cce35bcfbef90b20f140d723cbdb", {}, [
      ["1b8dfbb1267e213328920bae43f2f597", {}, []],
      ["59ed830b84b276ab776c3c51aaf93a16", {}, [
        ["64a9842c6aea50bf24660378e496e853", {}, []]
      ]]
    ]]
  }
];

var twoChild = {pos: 1, ids: ['1', {}, [
  ['1a', {}, [
    ['1aa', {}, []]
  ]]
]]};

var twoChildSibs = {pos: 1, ids: ['1', {}, [
  ['1a', {}, []],
  ['1b', {}, []]
]]};

var twoChildPlusSibs = {pos: 1, ids: ['1', {}, [
  ['1a', {}, [
    ['1aa', {}, []]
  ]],
  ['1b', {}, []]
]]};

var twoChildPlusSibs2 = {pos: 1, ids: ['1', {}, [
  ['1a', {}, []],
  ['1b', {}, [
    ['1bb', {}, []]
  ]]
]]};

var stemmedTwoChildSibs2 = [
  {pos: 2, ids: ['1a', {}, []]},
  {pos: 2, ids: ['1b', {}, [['1bb', {}, []]]]}
];

var foo = {pos: 1, ids: ['foo', {}, [
  ['foo2', {}, []],
  ['foo3', {}, []]
]]};

var bar = {pos: 1, ids: ['foo', {}, [
  ['foo3', {}, [
    ['foo4', {}, []]
  ]]
]]};

var fooBar = {pos: 1, ids: ['foo', {}, [
  ['foo2', {}, []],
  ['foo3', {}, [
    ['foo4', {}, []]
  ]]
]]};


test('Test Revision tree merging', function(t) {

  t.plan(33);

  // Tests from:
  // https://github.com/davisp/couchdb/blob/local_doc_revs/test/etap/060-kt-merging.t

  t.deepEqual(merge([], simple, 10), {
    tree: [simple],
    conflicts: 'new_leaf'
  }, 'Merging a path into an empty tree is the path');

  t.deepEqual(merge([simple], simple, 10), {
    tree: [simple],
    conflicts: 'internal_node'
  }, 'Remerge path into path is reflexive');

  t.deepEqual(merge([], two0, 10), {
    tree: [two0],
    conflicts: 'new_leaf'
  }, 'Merging a path with multiple entries is the path');

  t.deepEqual(merge([two0], two0, 10), {
    tree: [two0],
    conflicts: 'internal_node'
  }, 'Merging a path with multiple entries is reflexive');

  t.deepEqual(merge([two0], simple, 10), {
    tree: [two0],
    conflicts: 'internal_node'
  }, 'Merging a subpath into a path results in the path');

  t.deepEqual(merge([two0], newleaf, 10), {
    tree: [withnewleaf],
    conflicts: 'new_leaf'
  }, 'Merging a new leaf gives us a new leaf');

  t.deepEqual(merge([two0], two1, 10), {
    tree: [newbranch],
    conflicts: 'new_branch'
  }, 'Merging a new branch returns a proper tree');

  t.deepEqual(merge([two1], two0, 10), {
    tree: [newbranch],
    conflicts: 'new_branch'
  }, 'Order of merging does not affect the resulting tree');

  t.deepEqual(merge([newbranch], newleaf, 10), {
    tree: [newbranchleaf],
    conflicts: 'new_leaf'
  }, 'Merging a new_leaf doesnt return new_branch when branches exist');

  t.deepEqual(merge([newbranchleaf], newdeepbranch, 10), {
    tree: [newbranchleafbranch],
    conflicts: 'new_branch'
  }, 'Merging a deep branch with branches works');

  t.deepEqual(merge(stemmedconflicts, withnewleaf, 10), {
    tree: [withnewleaf],
    conflicts: 'new_leaf'
  }, 'New information reconnects steming induced conflicts');

  t.deepEqual(merge([two0], newleaf, 2), {
    tree: [newleaf],
    conflicts: 'new_leaf'
  }, 'Simple stemming works');

  t.deepEqual(merge([newbranchleafbranch], simple, 2), {
    tree: stemmed2,
    conflicts: 'internal_node'
  }, 'Merge with stemming works correctly for branches');

  t.deepEqual(merge([newbranchleafbranch], simple, 1), {
    tree: stemmed3,
    conflicts: 'internal_node'
  }, 'Merge with stemming to leaves works fine');

  t.deepEqual(merge(stemmed3, withnewleaf, 10), {
    tree: partialrecover,
    conflicts: 'internal_node'
  }, 'Merging unstemmed recovers as much as possible without losing info');

  t.equal(winningRev({rev_tree: tree1}),
        "3-93c3db16462f656f7172ccabd3cf6cd6",
        "Picks the longest path");

  t.equal(winningRev({rev_tree: tree2}),
        "3-64a9842c6aea50bf24660378e496e853",
        "Picks the longest path");

  // Tests from:
  // https://github.com/apache/couchdb/blob/master/test/etap/060-kt-merging.t

  t.deepEqual(merge([], one, 10), {
    tree: [one],
    conflicts: 'new_leaf'
  }, 'The empty tree is the identity for merge.');

  t.deepEqual(merge([one], one, 10), {
    tree: [one],
    conflicts: 'internal_node'
  }, 'Merging is reflexive');

  t.deepEqual(merge(twoSibs, one, 10), {
    tree: twoSibs,
    conflicts: 'internal_node'
  }, 'Merging a prefix of a tree with the tree yields the tree.');

  t.deepEqual(merge(twoSibs, three, 10), {
    tree: threeSibs,
    conflicts: 'internal_node'
  }, 'Merging a third unrelated branch leads to a conflict.');

  t.deepEqual(merge([twoChild], twoChild, 10), {
    tree: [twoChild],
    conflicts: 'internal_node'
  }, 'Merging two children is still reflexive.');

  t.deepEqual(merge([twoChildSibs], twoChildSibs, 10), {
    tree: [twoChildSibs],
    conflicts: 'internal_node'
  }, 'Merging a tree to itself is itself.');

  t.deepEqual(merge([twoChild], twoChildSibs, 10), {
    tree: [twoChildPlusSibs],
    conflicts: 'new_branch'
  }, 'Merging tree of uneven length at node 2.');

  t.deepEqual(merge([twoChildSibs], stemmed1b, 10), {
    tree: [twoChildSibs],
    conflicts: 'internal_node'
  }, 'Merging a tree with a stem.');

  t.deepEqual(merge([twoChildPlusSibs2], stemmed1bb, 10), {
    tree: [twoChildPlusSibs2],
    conflicts: 'internal_node'
  }, 'Merging a stem at a deeper level.');

  t.deepEqual(merge(stemmedTwoChildSibs2, stemmed1bb, 10), {
    tree: stemmedTwoChildSibs2,
    conflicts: 'internal_node'
  }, 'Merging a stem at a deeper level against paths at deeper levels.');

  t.deepEqual(merge([twoChild], stemmed1aa, 10), {
    tree: [twoChild],
    conflicts: 'internal_node'
  }, 'Merging a stem at a deeper level against paths at deeper levels.');

  t.deepEqual(merge([twoChild], stemmed1a, 10), {
    tree: [twoChild],
    conflicts: 'internal_node'
  }, 'Merging a larger stem.');

  t.deepEqual(merge([stemmed1a], stemmed1aa, 10), {
    tree: [stemmed1a],
    conflicts: 'internal_node'
  }, 'More merging.');

  t.deepEqual(merge([oneChild], stemmed1aa, 10), {
    tree: [oneChild, stemmed1aa],
    conflicts: 'internal_node'
  }, 'Merging should create conflicts.');

  t.deepEqual(merge([oneChild, stemmed1aa], twoChild, 10), {
    tree: [twoChild],
    conflicts: 'new_leaf'
  }, 'Merging should create conflicts.');

  t.deepEqual(merge([foo], bar, 10), {
    tree: [fooBar],
    conflicts: 'new_leaf'
  }, 'Merging trees with conflicts ought to behave.');

});
