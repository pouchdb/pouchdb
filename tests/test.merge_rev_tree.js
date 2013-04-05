"use strict";

// Porting tests from Apache CouchDB
// https://github.com/davisp/couchdb/blob/local_doc_revs/test/etap/060-kt-merging.t
var qunit = module;
if (typeof module !== undefined && module.exports) {
  var Pouch = require('../src/pouch.js');
  var LevelPouch = require('../src/adapters/pouch.leveldb.js');
  var utils = require('./test.utils.js');

  for (var k in utils) {
    global[k] = global[k] || utils[k];
  }
  qunit = QUnit.module;
}

qunit('merge rev tree');

var simple = {pos: 1, ids: ['1', {}, []]};
var two0 = {pos: 1, ids: ['1', {}, [['2_0', {}, []]]]};
var two1 = {pos: 1, ids: ['1', {}, [['2_1', {}, []]]]};
var newleaf = {pos: 2, ids: ['2_0', {}, [['3', {}, []]]]};
var withnewleaf = {pos: 1, ids: ['1', {}, [['2_0', {}, [['3', {}, []]]]]]};
var newbranch = {pos: 1, ids: ['1', {}, [['2_0', {}, []], ['2_1', {}, []]]]};
var newdeepbranch = {pos: 2, ids: ['2_0', {}, [['3_1', {}, []]]]};

var stemmededit = {pos: 3, ids: ['3', {}, []]};
var stemmedconflicts = [simple, stemmededit];

var newbranchleaf = {pos: 1, ids: ['1', {}, [['2_0', {}, [['3', {}, []]]], ['2_1', {}, []]]]};
var newbranchleafbranch = {pos: 1, ids: ['1', {}, [['2_0', {}, [['3', {}, []], ['3_1', {}, []]]], ['2_1', {}, []]]]};

var stemmed2 = [{pos: 1, ids: ['1', {}, [['2_1', {}, []]]]},
                {pos: 2, ids: ['2_0', {}, [['3', {}, []], ['3_1', {}, []]]]}];

var stemmed3 = [{pos: 2, ids: ['2_1', {}, []]},
                {pos: 3, ids: ['3', {}, []]},
                {pos: 3, ids: ['3_1', {}, []]}];
var partialrecover = [{pos: 1, ids: ['1', {}, [['2_0', {}, [['3', {}, []]]]]]},
                      {pos: 2, ids: ['2_1', {}, []]},
                      {pos: 3, ids: ['3_1', {}, []]}];

test('Merging a path into an empty tree is the path', function() {
  deepEqual(JSON.stringify(Pouch.merge([], simple, 10)), JSON.stringify({
    tree: [simple],
    conflicts: 'new_leaf'
  }, ''));
});

test('Remerge path into path is reflexive', function() {
  deepEqual(Pouch.merge([simple], simple, 10), {
    tree: [simple],
    conflicts: 'internal_node'
  }, '');
});

test('Merging a path with multiple entries is the path', function() {
  deepEqual(Pouch.merge([], two0, 10), {
    tree: [two0],
    conflicts: 'new_leaf'
  }, '');
});

test('Merging a path with multiple entries is reflexive', function() {
  deepEqual(Pouch.merge([two0], two0, 10), {
    tree: [two0],
    conflicts: 'internal_node'
  }, '');
});

test('Merging a subpath into a path results in the path', function() {
  deepEqual(Pouch.merge([two0], simple, 10), {
    tree: [two0],
    conflicts: 'internal_node'
  }, '');
});

test('Merging a new leaf gives us a new leaf', function() {
  deepEqual(Pouch.merge([two0], newleaf, 10), {
    tree: [withnewleaf],
    conflicts: 'new_leaf'
  }, '');
});

test('Merging a new branch returns a proper tree', function() {
  deepEqual(Pouch.merge([two0], two1, 10), {
    tree: [newbranch],
    conflicts: 'new_branch'
  }, '');
});

test('Order of merging does not affect the resulting tree', function() {
  deepEqual(Pouch.merge([two1], two0, 10), {
    tree: [newbranch],
    conflicts: 'new_branch'
  }, '');
});

test('Merging a new_leaf doesnt return new_branch when branches exist', function() {
  deepEqual(Pouch.merge([newbranch], newleaf, 10), {
    tree: [newbranchleaf],
    conflicts: 'new_leaf'
  }, '');
});

test('Merging a deep branch with branches works', function() {
  deepEqual(Pouch.merge([newbranchleaf], newdeepbranch, 10), {
    tree: [newbranchleafbranch],
    conflicts: 'new_branch'
  }, '');
});

test('New information reconnects steming induced conflicts', function() {
  deepEqual(Pouch.merge(stemmedconflicts, withnewleaf, 10), {
    tree: [withnewleaf],
    conflicts: 'new_leaf'
  }, '');
});

test('Simple stemming works', function() {
  deepEqual(Pouch.merge([two0], newleaf, 2), {
    tree: [newleaf],
    conflicts: 'new_leaf'
  }, '');
});

test('Merge with stemming works correctly for branches', function() {
  deepEqual(Pouch.merge([newbranchleafbranch], simple, 2), {
    tree: stemmed2,
    conflicts: 'internal_node'
  }, '');
});

test('Merge with stemming to leaves works fine', function() {
  deepEqual(Pouch.merge([newbranchleafbranch], simple, 1), {
    tree: stemmed3,
    conflicts: 'internal_node'
  }, '');
});

test('Merging unstemmed recovers as much as possible without losing info', function() {
  deepEqual(Pouch.merge(stemmed3, withnewleaf, 10), {
    tree: partialrecover,
    conflicts: 'internal_node'
  }, '');
});

test('winningRev returns the longest leaf', function() {
  var tree = [
    {"pos":1,"ids":[
      "bfe70372c90ded1087239e5191984f76", {}, [
        ["44d71a718b90e4696c06a90e08912c8f", {}, []],
        ["56e657612d55ab1a402dcb281c874f2a", {}, [
          ["93c3db16462f656f7172ccabd3cf6cd6", {}, []]
        ]]
      ]]
    }];
  equal(Pouch.merge.winningRev({rev_tree: tree}),
        "3-93c3db16462f656f7172ccabd3cf6cd6",
        "Picks the longest path");
});

test('winningRev returns the longest leaf again', function() {
  // this one is from issue #293
  var tree = [
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
  equal(Pouch.merge.winningRev({rev_tree: tree}),
        "3-64a9842c6aea50bf24660378e496e853",
        "Picks the longest path");
});

///// These are tests from CouchDB's kt-merging.erl test suite

var one = {pos: 1, ids: ['1', {}, []]};
test('The empty tree is the identity for merge.', function() {
  deepEqual(Pouch.merge([], one, 10), {
    tree: [one],
    conflicts: 'new_leaf'
  });
});

test('Merging is reflexive', function() {
  deepEqual(Pouch.merge([one], one, 10), {
    tree: [one],
    conflicts: 'internal_node'
  });
});

var two = {pos: 1, ids: ['2', {}, []]};
var twoSibs = [one, two];
test('Merging a prefix of a tree with the tree yields the tree.', function() {
  deepEqual(Pouch.merge(twoSibs, one, 10), {
    tree: twoSibs,
    conflicts: 'internal_node'
  });
});

var three = {pos: 1, ids: ['3', {}, []]};
var threeSibs = [one, two, three];
test('Merging a third unrelated branch leads to a conflict.', function() {
  deepEqual(Pouch.merge(twoSibs, three, 10), {
    tree: threeSibs,
    conflicts: 'internal_node'
  });
});

var twoChild = {pos: 1, ids: ['1', {}, [
  ['1a', {}, [
    ['1aa', {}, []]
  ]]
]]};
test('Merging two children is still reflexive.', function() {
  deepEqual(Pouch.merge([twoChild], twoChild, 10), {
    tree: [twoChild],
    conflicts: 'internal_node'
  });
});

var twoChildSibs = {pos: 1, ids: ['1', {}, [
  ['1a', {}, []],
  ['1b', {}, []]
]]};
test('Merging a tree to itself is itself.', function() {
  deepEqual(Pouch.merge([twoChildSibs], twoChildSibs, 10), {
    tree: [twoChildSibs],
    conflicts: 'internal_node'
  });
});

var twoChildPlusSibs = {pos: 1, ids: ['1', {}, [
  ['1a', {}, [
    ['1aa', {}, []]
  ]],
  ['1b', {}, []]
]]};
test('Merging tree of uneven length at node 2.', function() {
  deepEqual(Pouch.merge([twoChild], twoChildSibs, 10), {
    tree: [twoChildPlusSibs],
    conflicts: 'new_branch'
  });
});

var stemmed1b = {pos: 2, ids: ['1a', {}, []]};
test('Merging a tree with a stem.', function() {
  deepEqual(Pouch.merge([twoChildSibs], stemmed1b, 10), {
    tree: [twoChildSibs],
    conflicts: 'internal_node'
  });
});

var twoChildPlusSibs2 = {pos: 1, ids: ['1', {}, [
  ['1a', {}, []],
  ['1b', {}, [
    ['1bb', {}, []]
  ]]
]]};
var stemmed1bb = {pos:3, ids: ['1bb', {}, []]};
test('Merging a stem at a deeper level.', function() {
  deepEqual(Pouch.merge([twoChildPlusSibs2], stemmed1bb, 10), {
    tree: [twoChildPlusSibs2],
    conflicts: 'internal_node'
  });
});

var stemmedTwoChildSibs2 = [
  {pos: 2, ids: ['1a', {}, []]},
  {pos: 2, ids: ['1b', {}, [['1bb', {}, []]]]}
];
test('Merging a stem at a deeper level against paths at deeper levels.', function() {
  deepEqual(Pouch.merge(stemmedTwoChildSibs2, stemmed1bb, 10), {
    tree: stemmedTwoChildSibs2,
    conflicts: 'internal_node'
  });
});

var stemmed1aa = {pos: 3, ids: ['1aa', {}, []]};
test("Merging a single tree with a deeper stem.", function() {
  deepEqual(Pouch.merge([twoChild], stemmed1aa, 10), {
    tree: [twoChild],
    conflicts: 'internal_node'
  });
});

var stemmed1a = {pos: 2, ids: ['1a', {}, [['1aa', {}, []]]]};
test('Merging a larger stem.', function() {
  deepEqual(Pouch.merge([twoChild], stemmed1a, 10), {
    tree: [twoChild],
    conflicts: 'internal_node'
  });
});

test('More merging.', function() {
  deepEqual(Pouch.merge([stemmed1a], stemmed1aa, 10), {
    tree: [stemmed1a],
    conflicts: 'internal_node'
  });
});

var oneChild = {pos: 1, ids: ['1', {}, [['1a', {}, []]]]};
test('Merging should create conflicts.', function() {
  deepEqual(Pouch.merge([oneChild], stemmed1aa, 10), {
    tree: [oneChild, stemmed1aa],
    conflicts: 'internal_node'
  });
});

test('Merging should have no conflicts.', function() {
  deepEqual(Pouch.merge([oneChild, stemmed1aa], twoChild, 10), {
    tree: [twoChild],
    conflicts: 'new_leaf'
  });
});

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
test('Merging trees with conflicts ought to behave.', function() {
  deepEqual(Pouch.merge([foo], bar, 10), {
    tree: [fooBar],
    conflicts: 'new_leaf'
  });
});





