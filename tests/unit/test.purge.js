'use strict';

var should = require('chai').should();

function findPathToLeaf(revs, targetRev) {
  // `revs` has the same structure as what `revs_tree` has on e.g. the IndexedDB representation
  // of the rev tree datastructure.
  let path = [];
  const toVisit = revs.slice();

  let node;
  while ((node = toVisit.pop())) {
    const { pos, ids: tree } = node;
    const rev = `${pos}-${tree[0]}`;
    const branches = tree[2];

    // just assuming we're already working on the path up towards our desired leaf.
    path.push(rev);

    // we've reached the leaf of our dreams, so return the computed path.
    if (rev === targetRev) {
      //…unleeeeess
      if (branches.length !== 0) {
        throw new Error('The requested revision is not a leaf');
      }
      return path.reverse();
    }

    // this is based on the assumption that after we have a leaf (`branches.length == 0`), we handle the next
    // branch. this is true for all branches other than the path leading to the winning rev (which is 6-a in
    // the example below. i've added a reset condition for branching nodes (`branches.length > 1`) as well.
    if (branches.length === 0 || branches.length > 1) {
      path = [];
    }

    // as a next step, we push the branches of this node to `toVisit` for visiting it during the next iteration
    for (let i = 0, len = branches.length; i < len; i++) {
      toVisit.push({ pos: pos + 1, ids: branches[i] });
    }
  }
  if (path.length === 0) {
    throw new Error('The requested revision does not exist');
  }
  return path.reverse();
}

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
const shortConflictedTree = [
  {
    "pos": 1,
    "ids": [
      "9692d401ed2d3434827608278bdc36e3",
      {
        "status": "available"
      },
      [
        [
          "37aa033df08c21b4f56f1da2081e9e00",
          {
            "status": "available"
          },
          [
            [
              "43f6d5557d6de39488c64bb2c684ae7c",
              {
                "status": "missing"
              },
              [
                [
                  "a3b44168027079c2692a7d8eb35e9643",
                  {
                    "status": "available"
                  },
                  []
                ]
              ]
            ],
            [
              "df226cb9a2e5bdd3e6be009fd51f47c1",
              {
                "status": "available"
              },
              [
                [
                  "6e94d345514a08620c3176eea080d3ec",
                  {
                    "status": "available"
                  },
                  [
                    [
                      "0b84bfea5508e2020feb07384714a987",
                      {
                        "status": "missing"
                      },
                      [
                        [
                          "2d0ab4f4089a57c95d52bfd2d66b823d",
                          {
                            "status": "available"
                          },
                          []
                        ]
                      ]
                    ],
                    [
                      "df4a81cd21c75c71974d96e88a68fc2f",
                      {
                        "status": "available"
                      },
                      [
                        [
                          "3f7f6c55c27bf54c009b661607a9fe05",
                          {
                            "status": "available"
                          },
                          []
                        ]
                      ]
                    ]
                  ]
                ]
              ]
            ]
          ]
        ]
      ]
    ]
  }
];

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
const shortConflictedTreeWithTwoRoots = [
  {
    "pos": 1,
    "ids": [
      "9692d401ed2d3434827608278bdc36e3",
      {
        "status": "available"
      },
      [
        [
          "37aa033df08c21b4f56f1da2081e9e00",
          {
            "status": "available"
          },
          [
            [
              "43f6d5557d6de39488c64bb2c684ae7c",
              {
                "status": "missing"
              },
              [
                [
                  "a3b44168027079c2692a7d8eb35e9643",
                  {
                    "status": "available"
                  },
                  []
                ]
              ]
            ]
          ]
        ]
      ]
    ]
  },
  {
    "pos": 3,
    "ids": [
      "df226cb9a2e5bdd3e6be009fd51f47c1",
      {
        "status": "available"
      },
      [
        [
          "6e94d345514a08620c3176eea080d3ec",
          {
            "status": "available"
          },
          [
            [
              "0b84bfea5508e2020feb07384714a987",
              {
                "status": "missing"
              },
              [
                [
                  "2d0ab4f4089a57c95d52bfd2d66b823d",
                  {
                    "status": "available"
                  },
                  []
                ]
              ]
            ],
            [
              "df4a81cd21c75c71974d96e88a68fc2f",
              {
                "status": "available"
              },
              [
                [
                  "3f7f6c55c27bf54c009b661607a9fe05",
                  {
                    "status": "available"
                  },
                  []
                ]
              ]
            ]
          ]
        ]
      ]
    ]
  }
];

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
const revsLimitedSingleBranchTree = [
  {
    "pos": 3,
    "ids": [
      "df226cb9a2e5bdd3e6be009fd51f47c1",
      {
        "status": "available"
      },
      [
        [
          "6e94d345514a08620c3176eea080d3ec",
          {
            "status": "available"
          },
          [
            [
              "df4a81cd21c75c71974d96e88a68fc2f",
              {
                "status": "available"
              },
              [
                [
                  "3f7f6c55c27bf54c009b661607a9fe05",
                  {
                    "status": "available"
                  },
                  []
                ]
              ]
            ]
          ]
        ]
      ]
    ]
  }
];

describe.only('the findPathToLeaf util', function () {
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
