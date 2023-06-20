'use strict';

// Porting tests from Apache CouchDB
// https://github.com/davisp/couchdb/blob/local_doc_revs/test/
// etap/060-kt-merging.t

var PouchDB = require('../../packages/pouchdb-for-coverage');
var merge = PouchDB.utils.merge;
var winningRev = PouchDB.utils.winningRev;

describe('test.merge.js', function () {

  var simple;
  var two0;
  var two1;
  var newleaf;
  var withnewleaf;
  var newbranch;
  var newdeepbranch;
  var stemmededit;
  var stemmedconflicts;
  var newbranchleaf;
  var newbranchleafbranch;
  var stemmed2;
  var stemmed3;
  var partialrecover;

  /*
   * Our merge() function actually mutates the input object, because it's
   * more performant than deep cloning the object every time it's passed
   * into merge(). So in order for these tests to pass, we need to redefine
   * these objects every time.
   */
  beforeEach(function () {
    simple = {pos: 1, ids: ['1', {}, []]};
    two0 = {pos: 1, ids: ['1', {}, [['2_0', {}, []]]]};
    two1 = {pos: 1, ids: ['1', {}, [['2_1', {}, []]]]};
    newleaf = {pos: 2, ids: ['2_0', {}, [['3', {}, []]]]};
    withnewleaf = {pos: 1, ids: ['1', {}, [['2_0', {}, [['3', {}, []]]]]]};
    newbranch = {pos: 1, ids: ['1', {}, [['2_0', {}, []], ['2_1', {}, []]]]};
    newdeepbranch = {pos: 2, ids: ['2_0', {}, [['3_1', {}, []]]]};

    stemmededit = {pos: 3, ids: ['3', {}, []]};
    stemmedconflicts = [simple, stemmededit];

    newbranchleaf = {
      pos: 1,
      ids: ['1', {}, [['2_0', {}, [['3', {}, []]]], ['2_1', {}, []]]]
    };

    newbranchleafbranch = {
      pos: 1,
      ids: ['1', {}, [
        ['2_0', {}, [['3', {}, []], ['3_1', {}, []]]], ['2_1', {}, []]
      ]]
    };

    stemmed2 = [
      {pos: 1, ids: ['1', {}, [['2_1', {}, []]]]},
      {pos: 2, ids: ['2_0', {}, [['3', {}, []], ['3_1', {}, []]]]}
    ];

    stemmed3 = [
      {pos: 2, ids: ['2_1', {}, []]},
      {pos: 3, ids: ['3', {}, []]},
      {pos: 3, ids: ['3_1', {}, []]}
    ];

    partialrecover = [
      {pos: 1, ids: ['1', {}, [['2_0', {}, [['3', {}, []]]]]]},
      {pos: 2, ids: ['2_1', {}, []]},
      {pos: 3, ids: ['3_1', {}, []]}
    ];
  });

  it('Merging a path into an empty tree is the path', function () {
    merge([], simple, 10).should.deep.equal({
      tree: [simple],
      stemmedRevs: [],
      conflicts: 'new_leaf'
    });
  });

  it('Remerge path into path is reflexive', function () {
    merge([simple], simple, 10).should.deep.equal({
      tree: [simple],
      stemmedRevs: [],
      conflicts: 'internal_node'
    });
  });

  it('Merging a path with multiple entries is the path', function () {
    merge([], two0, 10).should.deep.equal({
      tree: [two0],
      stemmedRevs: [],
      conflicts: 'new_leaf'
    });
  });

  it('Merging a path with multiple entries is reflexive', function () {
    merge([two0], two0, 10).should.deep.equal({
      tree: [two0],
      stemmedRevs: [],
      conflicts: 'internal_node'
    });
  });

  it('Merging a subpath into a path results in the path', function () {
    merge([two0], simple, 10).should.deep.equal({
      tree: [two0],
      stemmedRevs: [],
      conflicts: 'internal_node'
    });
  });

  it('Merging a new leaf gives us a new leaf', function () {
    merge([two0], newleaf, 10).should.deep.equal({
      tree: [withnewleaf],
      stemmedRevs: [],
      conflicts: 'new_leaf'
    });
  });

  it('Merging a new branch returns a proper tree', function () {
    merge([two0], two1, 10).should.deep.equal({
      tree: [newbranch],
      stemmedRevs: [],
      conflicts: 'new_branch'
    });
  });

  it('Order of merging does not affect the resulting tree', function () {
    merge([two1], two0, 10).should.deep.equal({
      tree: [newbranch],
      stemmedRevs: [],
      conflicts: 'new_branch'
    });
  });

  it('Merging a new_leaf doesnt return new_branch when branches exist',
     function () {
    merge([newbranch], newleaf, 10).should.deep.equal({
      tree: [newbranchleaf],
      stemmedRevs: [],
      conflicts: 'new_leaf'
    });
  });

  it('Merging a deep branch with branches works', function () {
    merge([newbranchleaf], newdeepbranch, 10).should.deep.equal({
      tree: [newbranchleafbranch],
      stemmedRevs: [],
      conflicts: 'new_branch'
    });
  });

  it('New information reconnects steming induced conflicts', function () {
    merge(stemmedconflicts, withnewleaf, 10).should.deep.equal({
      tree: [withnewleaf],
      stemmedRevs: [],
      conflicts: 'new_leaf'
    });
  });

  it('Simple stemming works', function () {
    merge([two0], newleaf, 2).should.deep.equal({
      tree: [newleaf],
      stemmedRevs: ['1-1'],
      conflicts: 'new_leaf'
    });
  });

  it('Merge with stemming works correctly for branches', function () {
    merge([newbranchleafbranch], simple, 2).should.deep.equal({
      tree: stemmed2,
      stemmedRevs: [],
      conflicts: 'internal_node'
    });
  });

  it('Merge with stemming to leaves works fine', function () {
    merge([newbranchleafbranch], simple, 1).should.deep.equal({
      tree: stemmed3,
      stemmedRevs: ['1-1', '2-2_0'],
      conflicts: 'internal_node'
    });
  });

  it('Merging unstemmed recovers as much as possible without losing info',
     function () {
    merge(stemmed3, withnewleaf, 10).should.deep.equal({
      tree: partialrecover,
      stemmedRevs: [],
      conflicts: 'internal_node'
    });
  });

  it('winningRev returns the longest leaf', function () {
    var tree = [
      {"pos": 1, "ids": [
        "bfe70372c90ded1087239e5191984f76", {}, [
          ["44d71a718b90e4696c06a90e08912c8f", {}, []],
          ["56e657612d55ab1a402dcb281c874f2a", {}, [
            ["93c3db16462f656f7172ccabd3cf6cd6", {}, []]
          ]]
        ]
      ]}
    ];
    winningRev({rev_tree: tree})
      .should.equal("3-93c3db16462f656f7172ccabd3cf6cd6");
  });

  it('winningRev returns the longest leaf again', function () {
    // this one is from issue #293
    var tree = [
      {"pos": 1, "ids": [
        "203db1a1810a838895d561f67b224b5d", {}, [
          ["bf5e08a4f9fa6d33a53f4a00ae3ea399", {}, [
            ["28cd77a3ca30f79e1cfffcd6a41ca308", {}, []]
          ]]
        ]
      ]},
      {"pos": 1, "ids": [
        "c6d5cce35bcfbef90b20f140d723cbdb", {}, [
          ["1b8dfbb1267e213328920bae43f2f597", {}, []],
          ["59ed830b84b276ab776c3c51aaf93a16", {}, [
            ["64a9842c6aea50bf24660378e496e853", {}, []]
          ]]
        ]
      ]}
    ];
    winningRev({rev_tree: tree})
      .should.equal("3-64a9842c6aea50bf24660378e496e853");
  });

  // ///// These are tests from CouchDB's kt-merging.erl test suite

  var one = {pos: 1, ids: ['1', {}, []]};
  it('The empty tree is the identity for merge.', function () {
    merge([], one, 10).should.deep.equal({
      tree: [one],
      stemmedRevs: [],
      conflicts: 'new_leaf'
    });
  });

  it('Merging is reflexive', function () {
    merge([one], one, 10).should.deep.equal({
      tree: [one],
      stemmedRevs: [],
      conflicts: 'internal_node'
    });
  });

  var two = {pos: 1, ids: ['2', {}, []]};
  var twoSibs = [one, two];
  it('Merging a prefix of a tree with the tree yields the tree.', function () {
    merge(twoSibs, one, 10).should.deep.equal({
      tree: twoSibs,
      stemmedRevs: [],
      conflicts: 'internal_node'
    });
  });

  var three = {pos: 1, ids: ['3', {}, []]};
  var threeSibs = [one, two, three];
  it('Merging a third unrelated branch leads to a conflict.', function () {
    merge(twoSibs, three, 10).should.deep.equal({
      tree: threeSibs,
      stemmedRevs: [],
      conflicts: 'internal_node'
    });
  });

  var twoChild = {pos: 1, ids: ['1', {}, [
    ['1a', {}, [
      ['1aa', {}, []]
    ]]
  ]]};
  it('Merging two children is still reflexive.', function () {
    merge([twoChild], twoChild, 10).should.deep.equal({
      tree: [twoChild],
      stemmedRevs: [],
      conflicts: 'internal_node'
    });
  });

  var twoChildSibs = {pos: 1, ids: ['1', {}, [
    ['1a', {}, []],
    ['1b', {}, []]
  ]]};
  it('Merging a tree to itself is itself.', function () {
    merge([twoChildSibs], twoChildSibs, 10).should.deep.equal({
      tree: [twoChildSibs],
      stemmedRevs: [],
      conflicts: 'internal_node'
    });
  });

  var twoChildPlusSibs = {pos: 1, ids: ['1', {}, [
    ['1a', {}, [
      ['1aa', {}, []]
    ]],
    ['1b', {}, []]
  ]]};
  it('Merging tree of uneven length at node 2.', function () {
    merge([twoChild], twoChildSibs, 10).should.deep.equal({
      tree: [twoChildPlusSibs],
      stemmedRevs: [],
      conflicts: 'new_branch'
    });
  });

  var stemmed1b = {pos: 2, ids: ['1a', {}, []]};
  it('Merging a tree with a stem.', function () {
    merge([twoChildSibs], stemmed1b, 10).should.deep.equal({
      tree: [twoChildSibs],
      stemmedRevs: [],
      conflicts: 'internal_node'
    });
  });

  var twoChildPlusSibs2 = {pos: 1, ids: ['1', {}, [
    ['1a', {}, []],
    ['1b', {}, [
      ['1bb', {}, []]
    ]]
  ]]};
  var stemmed1bb = {pos: 3, ids: ['1bb', {}, []]};
  it('Merging a stem at a deeper level.', function () {
    merge([twoChildPlusSibs2], stemmed1bb, 10).should.deep.equal({
      tree: [twoChildPlusSibs2],
      stemmedRevs: [],
      conflicts: 'internal_node'
    });
  });

  var stemmedTwoChildSibs2 = [
    {pos: 2, ids: ['1a', {}, []]},
    {pos: 2, ids: ['1b', {}, [['1bb', {}, []]]]}
  ];
  it('Merging a stem at a deeper level against paths at deeper levels.',
     function () {
    merge(stemmedTwoChildSibs2, stemmed1bb, 10).should.deep.equal({
      tree: stemmedTwoChildSibs2,
      stemmedRevs: [],
      conflicts: 'internal_node'
    });
  });

  var stemmed1aa = {pos: 3, ids: ['1aa', {}, []]};
  it("Merging a single tree with a deeper stem.", function () {
    merge([twoChild], stemmed1aa, 10).should.deep.equal({
      tree: [twoChild],
      stemmedRevs: [],
      conflicts: 'internal_node'
    });
  });

  var stemmed1a = {pos: 2, ids: ['1a', {}, [['1aa', {}, []]]]};
  it('Merging a larger stem.', function () {
    merge([twoChild], stemmed1a, 10).should.deep.equal({
      tree: [twoChild],
      stemmedRevs: [],
      conflicts: 'internal_node'
    });
  });

  it('More merging.', function () {
    merge([stemmed1a], stemmed1aa, 10).should.deep.equal({
      tree: [stemmed1a],
      stemmedRevs: [],
      conflicts: 'internal_node'
    });
  });

  var oneChild = {pos: 1, ids: ['1', {}, [['1a', {}, []]]]};
  it('Merging should create conflicts.', function () {
    merge([oneChild], stemmed1aa, 10).should.deep.equal({
      tree: [oneChild, stemmed1aa],
      stemmedRevs: [],
      conflicts: 'internal_node'
    });
  });

  it('Merging should have no conflicts.', function () {
    merge([oneChild, stemmed1aa], twoChild, 10).should.deep.equal({
      tree: [twoChild],
      stemmedRevs: [],
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

  it('Merging trees with conflicts ought to behave.', function () {
    merge([foo], bar, 10).should.deep.equal({
      tree: [fooBar],
      stemmedRevs: [],
      conflicts: 'new_leaf'
    });
  });

});
