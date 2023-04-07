'use strict';

const should = require('chai').should();
const { findPathToLeaf, removeLeafFromTree } = require('../../packages/node_modules/pouchdb-merge');

/*
  1-a - 2-a -- 3-a - 4-a - 5-a - 6-a
            \            \
             \             5-c - 6-c
               3-b - 4-b
  1-a = 1-9692d401ed2d3434827608278bdc36e3
  2-a = 2-37aa033df08c21b4f56f1da2081e9e00
  3-a = 3-df226cb9a2e5bdd3e6be009fd51f47c1
  4-a = 4-6e94d345514a08620c3176eea080d3ec
  5-a = 5-df4a81cd21c75c71974d96e88a68fc2f
  6-a = 6-3f7f6c55c27bf54c009b661607a9fe05 leaf
  5-c = 5-0b84bfea5508e2020feb07384714a987
  6-c = 6-2d0ab4f4089a57c95d52bfd2d66b823d leaf
  3-b = 3-43f6d5557d6de39488c64bb2c684ae7c
  4-b = 4-a3b44168027079c2692a7d8eb35e9643 leaf
*/
const shortConflictedTree = [{
  "pos": 1,
  "ids": ["9692d401ed2d3434827608278bdc36e3", {}, [
    ["37aa033df08c21b4f56f1da2081e9e00", {}, [
      ["43f6d5557d6de39488c64bb2c684ae7c", {}, [
        ["a3b44168027079c2692a7d8eb35e9643", {}, []]
      ]],
      ["df226cb9a2e5bdd3e6be009fd51f47c1", {}, [
        ["6e94d345514a08620c3176eea080d3ec", {}, [
          ["0b84bfea5508e2020feb07384714a987", {}, [
            ["2d0ab4f4089a57c95d52bfd2d66b823d", {}, []]
          ]],
          ["df4a81cd21c75c71974d96e88a68fc2f", {}, [
            ["3f7f6c55c27bf54c009b661607a9fe05", {}, []]
          ]]
        ]]
      ]]
    ]]
  ]]
}];

// the same as the above shortConflictedTree, but without the 6-a leaf
const shortConflictedTreeWithout6a = [{
  "pos": 1,
  "ids": ["9692d401ed2d3434827608278bdc36e3", {}, [
    ["37aa033df08c21b4f56f1da2081e9e00", {}, [
      ["43f6d5557d6de39488c64bb2c684ae7c", {}, [
        ["a3b44168027079c2692a7d8eb35e9643", {}, []]
      ]],
      ["df226cb9a2e5bdd3e6be009fd51f47c1", {}, [
        ["6e94d345514a08620c3176eea080d3ec", {}, [
          ["0b84bfea5508e2020feb07384714a987", {}, [
            ["2d0ab4f4089a57c95d52bfd2d66b823d", {}, []]
          ]],
          ["df4a81cd21c75c71974d96e88a68fc2f", {}, []]
        ]]
      ]]
    ]]
  ]]
 }];

// the same as the above shortConflictedTree, but without the 6-a & 5-a leaves
const shortConflictedTreeWithout6a5a = [{
  "pos": 1,
  "ids": ["9692d401ed2d3434827608278bdc36e3", {}, [
    ["37aa033df08c21b4f56f1da2081e9e00", {}, [
      ["43f6d5557d6de39488c64bb2c684ae7c", {}, [
        ["a3b44168027079c2692a7d8eb35e9643", {}, []]
      ]],
      ["df226cb9a2e5bdd3e6be009fd51f47c1", {}, [
        ["6e94d345514a08620c3176eea080d3ec", {}, [
          ["0b84bfea5508e2020feb07384714a987", {}, [
            ["2d0ab4f4089a57c95d52bfd2d66b823d", {}, []]
          ]]
        ]]
      ]]
    ]]
  ]]
}];

// the same as the above shortConflictedTree, but without the 6-a, 5-a, and 6-c leaves
const shortConflictedTreeWithout6a5a6c = [{
  "pos": 1,
  "ids": ["9692d401ed2d3434827608278bdc36e3", {}, [
    ["37aa033df08c21b4f56f1da2081e9e00", {}, [
      ["43f6d5557d6de39488c64bb2c684ae7c", {}, [
        ["a3b44168027079c2692a7d8eb35e9643", {}, []]
      ]],
      ["df226cb9a2e5bdd3e6be009fd51f47c1", {}, [
        ["6e94d345514a08620c3176eea080d3ec", {}, [
          ["0b84bfea5508e2020feb07384714a987", {}, []]
        ]]
      ]]
    ]]
  ]]
}];


// the same as the above shortConflictedTree, but without the 6-a, 5-a, 6-c, and 5-c leaves
const shortConflictedTreeWithout6a5a6c5c = [{
  "pos": 1,
  "ids": ["9692d401ed2d3434827608278bdc36e3", {}, [
    ["37aa033df08c21b4f56f1da2081e9e00", {}, [
      ["43f6d5557d6de39488c64bb2c684ae7c", {}, [
        ["a3b44168027079c2692a7d8eb35e9643", {}, []]
      ]],
      ["df226cb9a2e5bdd3e6be009fd51f47c1", {}, [
        ["6e94d345514a08620c3176eea080d3ec", {}, []]
      ]]
    ]]
  ]]
}];

/*
  With revs_limit: 4, the shortConflictedTree from above becomes:
  3-a - 4-a - 5-a - 6-a
            \
              5-c - 6-c
  1-a - 2-a - 3-b - 4-b
  1-a = 1-9692d401ed2d3434827608278bdc36e3
  2-a = 2-37aa033df08c21b4f56f1da2081e9e00
  3-a = 3-df226cb9a2e5bdd3e6be009fd51f47c1
  4-a = 4-6e94d345514a08620c3176eea080d3ec
  5-a = 5-df4a81cd21c75c71974d96e88a68fc2f
  6-a = 6-3f7f6c55c27bf54c009b661607a9fe05 leaf
  5-c = 5-0b84bfea5508e2020feb07384714a987
  6-c = 6-2d0ab4f4089a57c95d52bfd2d66b823d leaf
  3-b = 3-43f6d5557d6de39488c64bb2c684ae7c
  4-b = 4-a3b44168027079c2692a7d8eb35e9643 leaf
*/
const shortConflictedTreeWithTwoRoots = [{
  "pos": 1,
  "ids": ["9692d401ed2d3434827608278bdc36e3", {}, [
    ["37aa033df08c21b4f56f1da2081e9e00", {}, [
      ["43f6d5557d6de39488c64bb2c684ae7c", {}, [
        ["a3b44168027079c2692a7d8eb35e9643", {}, []]
      ]]
    ]]
  ]]
}, {
  "pos": 3,
  "ids": ["df226cb9a2e5bdd3e6be009fd51f47c1", {}, [
    ["6e94d345514a08620c3176eea080d3ec", {}, [
      ["0b84bfea5508e2020feb07384714a987", {}, [
        ["2d0ab4f4089a57c95d52bfd2d66b823d", {}, []]
      ]],
      ["df4a81cd21c75c71974d96e88a68fc2f", {}, [
        ["3f7f6c55c27bf54c009b661607a9fe05", {}, []]
      ]]
    ]]
  ]]
}];

/*
  With revs_limit: 4, just the main branch
  (a doc without conflicts):
  1-a - 2-a | 3-a - 4-a - 5-a - 6-a
  truncated ^ here, 1-a - 2-a are missing. This
  is functionally the same as traversing a
  single-branch tree that hasn’t had a revs_limit
  applied, so no need to test that separately.
  3-a = 3-df226cb9a2e5bdd3e6be009fd51f47c1
  4-a = 4-6e94d345514a08620c3176eea080d3ec
  5-a = 5-df4a81cd21c75c71974d96e88a68fc2f
  6-a = 6-3f7f6c55c27bf54c009b661607a9fe05 leaf
*/
const revsLimitedSingleBranchTree = [{
  "pos": 3,
  "ids": ["df226cb9a2e5bdd3e6be009fd51f47c1", {}, [
    ["6e94d345514a08620c3176eea080d3ec", {}, [
      ["df4a81cd21c75c71974d96e88a68fc2f", {}, [
        ["3f7f6c55c27bf54c009b661607a9fe05", {}, []]
      ]]
    ]]
  ]]
}];

describe('the findPathToLeaf util', function () {
  it('finds the first branch in a conflicted tree', function () {
    const path = findPathToLeaf(shortConflictedTree, '6-3f7f6c55c27bf54c009b661607a9fe05');
    path.should.be.eql([
      '6-3f7f6c55c27bf54c009b661607a9fe05',
      '5-df4a81cd21c75c71974d96e88a68fc2f'
    ]);
  });
  it('finds the second branch in a conflicted tree', function () {
    const path = findPathToLeaf(shortConflictedTree, '6-2d0ab4f4089a57c95d52bfd2d66b823d');
    path.should.be.eql([
      '6-2d0ab4f4089a57c95d52bfd2d66b823d',
      '5-0b84bfea5508e2020feb07384714a987'
    ]);
  });
  it('finds the third branch in a conflicted tree', function () {
    const path = findPathToLeaf(shortConflictedTree, '4-a3b44168027079c2692a7d8eb35e9643');
    path.should.be.eql([
      '4-a3b44168027079c2692a7d8eb35e9643',
      '3-43f6d5557d6de39488c64bb2c684ae7c'
    ]);
  });
  it('finds the first branch in a multi-root conflicted tree', function () {
    const path = findPathToLeaf(shortConflictedTreeWithTwoRoots, '6-3f7f6c55c27bf54c009b661607a9fe05');
    path.should.be.eql([
      '6-3f7f6c55c27bf54c009b661607a9fe05',
      '5-df4a81cd21c75c71974d96e88a68fc2f'
    ]);
  });
  it('finds the second branch in a multi-root conflicted tree', function () {
    const path = findPathToLeaf(shortConflictedTreeWithTwoRoots, '6-2d0ab4f4089a57c95d52bfd2d66b823d');
    path.should.be.eql([
      '6-2d0ab4f4089a57c95d52bfd2d66b823d',
      '5-0b84bfea5508e2020feb07384714a987'
    ]);
  });
  it('finds the third branch in a multi-root conflicted tree and returns the entire subtree', function () {
    const path = findPathToLeaf(shortConflictedTreeWithTwoRoots, '4-a3b44168027079c2692a7d8eb35e9643');
    path.should.be.eql([
      '4-a3b44168027079c2692a7d8eb35e9643',
      '3-43f6d5557d6de39488c64bb2c684ae7c',
      '2-37aa033df08c21b4f56f1da2081e9e00',
      '1-9692d401ed2d3434827608278bdc36e3'
    ]);
  });
  it('returns the entire tree of a single-branch tree (truncated by revs_limit)', function () {
    const path = findPathToLeaf(revsLimitedSingleBranchTree, '6-3f7f6c55c27bf54c009b661607a9fe05');
    path.should.be.eql([
      '6-3f7f6c55c27bf54c009b661607a9fe05',
      '5-df4a81cd21c75c71974d96e88a68fc2f',
      '4-6e94d345514a08620c3176eea080d3ec',
      '3-df226cb9a2e5bdd3e6be009fd51f47c1'
    ]);
  });
  it('throws if the requested rev doesn’t exist', function () {
    try {
      findPathToLeaf(shortConflictedTree, '7-009b661607a9fe053f7f6c55c27bf54c');
      should.fail();
    } catch (error) {
      error.message.should.equal("The requested revision does not exist");
    }
  });
  it('throws if the requested rev is not a leaf', function () {
    try {
      findPathToLeaf(shortConflictedTree, '3-df226cb9a2e5bdd3e6be009fd51f47c1');
      should.fail();
    } catch (error) {
      error.message.should.equal("The requested revision is not a leaf");
    }
  });
});

describe('the removeLeafFromTree util', function () {
  it('removes a leaf from the tree', function () {
    let tree = removeLeafFromTree(shortConflictedTree, "6-3f7f6c55c27bf54c009b661607a9fe05");
    tree.should.be.deep.equal(shortConflictedTreeWithout6a);
    tree = removeLeafFromTree(tree, "5-df4a81cd21c75c71974d96e88a68fc2f");
    tree.should.be.deep.equal(shortConflictedTreeWithout6a5a);
    tree = removeLeafFromTree(tree, "6-2d0ab4f4089a57c95d52bfd2d66b823d");
    tree.should.be.deep.equal(shortConflictedTreeWithout6a5a6c);
    tree = removeLeafFromTree(tree, "5-0b84bfea5508e2020feb07384714a987");
    tree.should.be.deep.equal(shortConflictedTreeWithout6a5a6c5c);

  });
  it('should return an empty array if the entire tree is being deleted', function () {
    const smallTree = [
      {
        pos: 1,
        ids: [
          "df226cb9a2e5bdd3e6be009fd51f47c1",
          {
            "status": "available"
          },
          []
        ]
      }
    ];
  let tree = removeLeafFromTree(smallTree, "1-df226cb9a2e5bdd3e6be009fd51f47c1");
    tree.should.be.deep.equal([]);
  });
  it('does not remove anything from the tree if the rev is not a leaf', function () {
    const tree = removeLeafFromTree(shortConflictedTree, "5-df4a81cd21c75c71974d96e88a68fc2f");
    tree.should.be.deep.equal(shortConflictedTree);
  });
  it('does not remove anything from the tree if the rev doesn\'t exist', function () {
    const tree = removeLeafFromTree(shortConflictedTree, "foobar");
    tree.should.be.deep.equal(shortConflictedTree);
  });
  it('removes leafs that are the first child of several siblings', function () {
    let tree = [{
      "pos": 1,
      "ids": ["abcd", {}, [
        ["efgh", {}, [
          ["ijkl", {}, [
            ["mnop", {}, []]
          ]],
          ["qrst", {}, []]
        ]]
      ]]
    }];
    let purged = removeLeafFromTree(tree, "4-mnop");
    purged.should.deep.equal([{
      "pos": 1,
      "ids": ["abcd", {}, [
        ["efgh", {}, [
          ["ijkl", {}, []],
          ["qrst", {}, []]
        ]]
      ]]
    }]);
  });
  it('should remove respective leafs from a multi-root tree with revs_limit=4', function () {
    let tree = removeLeafFromTree(
      removeLeafFromTree(
        shortConflictedTreeWithTwoRoots,
        '6-3f7f6c55c27bf54c009b661607a9fe05'
      ),
      '6-2d0ab4f4089a57c95d52bfd2d66b823d'
    );
    tree.should.be.deep.equal([{
      "pos": 1,
      "ids": ["9692d401ed2d3434827608278bdc36e3", {}, [
        ["37aa033df08c21b4f56f1da2081e9e00", {}, [
          ["43f6d5557d6de39488c64bb2c684ae7c", {}, [
            ["a3b44168027079c2692a7d8eb35e9643", {}, []]
          ]]
        ]]
      ]]
    }, {
      "pos": 3,
      "ids": [
        "df226cb9a2e5bdd3e6be009fd51f47c1", {}, [
          ["6e94d345514a08620c3176eea080d3ec", {}, [
            ["0b84bfea5508e2020feb07384714a987", {}, []],
            ["df4a81cd21c75c71974d96e88a68fc2f", {}, []]
          ]]
        ]
      ]
    }]);
  });
  it('should remove respective leafs from a multi-root tree with revs_limit=3', function () {
    // we're creating the tree below:
    // root1 4-6e94 -> 5-df4a -> 6-3f7f
    //       └-------> 5-8d8c -> 6-65e0
    // root2 4-a3b4
    const limitedTree = [{
      pos: 4,
      ids: ["6e94", {}, [
            ["df4a", {}, [
              ["3f7f", {}, []],
            ]],
            ["8d8c", {}, [
              ["65e0", {}, []],
            ]],
          ]],
    }, {
      pos: 4,
      ids: ["a3b4", {}, []],
    }];

    const tree = removeLeafFromTree(
      removeLeafFromTree(
        limitedTree,
        '6-3f7f'
      ),
      '5-df4a'
    );
    // and we’re expecting this after the purge
    // root1 4-6e94
    //       └-------> 5-8d8c -> 6-65e0
    // root2 4-a3b4
    tree.should.be.deep.equal([
      { pos: 4, ids: [ '6e94', {}, [
        ["8d8c", {}, [["65e0", {}, []]]]
      ] ] },
      { pos: 4, ids: [ 'a3b4', {}, [] ] }
    ]);
  });
});
