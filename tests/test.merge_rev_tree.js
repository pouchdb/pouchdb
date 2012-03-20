// Porting tests from Apache CouchDB
// https://github.com/davisp/couchdb/blob/local_doc_revs/test/etap/060-kt-merging.t

module('merge rev tree');

// for a better overview of what this is doing, read:
// https://github.com/apache/couchdb/blob/master/src/couchdb/couch_key_tree.erl
//
// But for a quick intro, CouchDB uses a revision tree to store a documents
// history, A -> B -> C, when a document has conflicts, that is a branch in the
// tree, A -> (B1 | B2 -> C), We store these as a nested array in the format
//
// KeyTree = [Path ... ]
// Path = {pos: position_from_root, ids: Tree}
// Tree = [Key, Tree]

// Turn a path as a flat array into a tree with a single branch
function pathToTree(path) {
  var root = [path.shift(), []];
  var leaf = root;
  while (path.length) {
    nleaf = [path.shift(), []];
    leaf[1].push(nleaf);
    leaf = nleaf;
  }
  return root;
}

// Turn a tree into a list of rootToLeaf paths
function expandTree(all, current, pos, arr) {
  current = current.slice(0);
  current.push(arr[0]);
  if (!arr[1].length) {
    all.push({pos: pos, ids: current});
  }
  arr[1].forEach(function(child) {
    expandTree(all, current, pos, child);
  });
}

function rootToLeaf(tree) {
  var all = [];
  tree.forEach(function(path) {
    expandTree(all, [], path.pos, path.ids);
  });
  return all;
}

// To ensure we dont grow the revision tree infinitely, we stem old revisions
function stem(tree, depth) {
  // First we break out the tree into a complete list of root to leaf paths,
  // we cut off the start of the path and generate a new set of flat trees
  var stemmedPaths = rootToLeaf(tree).map(function(path) {
    var stemmed = path.ids.slice(-depth);
    return {
      pos: path.pos + (path.ids.length - stemmed.length),
      ids: pathToTree(stemmed)
    };
  });
  // Then we remerge all those flat trees together, ensuring that we dont
  // connect trees that would go beyond the depth limit
  return stemmedPaths.reduce(function(prev, current, i, arr) {
    return doMerge(prev, current, true).tree;
  }, [stemmedPaths.shift()]);
}

// Merge two trees together
function mergeTree(tree1, tree2) {
  var conflicts = false;
  for (var i = 0; i < tree2[1].length; i++) {
    if (!tree1[1][0]) {
      conflicts = 'new_leaf';
      tree1[1][0] = tree2[1][i];
    }
    if (tree1[1][0].indexOf(tree2[1][i][0]) === -1) {
      conflicts = 'new_branch';
      tree1[1].push(tree2[1][i]);
      tree1[1].sort();
    } else {
      var result = mergeTree(tree1[1][0], tree2[1][i]);
      conflicts = result.conflicts || conflicts;
      tree1[1][0] = result.tree;
    }
  }
  return {conflicts: conflicts, tree: tree1};
}

function doMerge(tree, path, dontExpand) {
  var restree = [];
  var conflicts = false;
  var merged = false;
  var res, branch;

  if (!tree.length) {
    return {tree: [path], conflicts: 'new_leaf'};
  }

  tree.forEach(function(branch) {
    if (branch.pos === path.pos && branch.ids[0] === path.ids[0]) {
      // Paths start at the same position and have the same root, so they need
      // merged
      res = mergeTree(branch.ids, path.ids);
      restree.push({pos: branch.pos, ids: res.tree});
      conflicts = conflicts || res.conflicts;
      merged = true;
    } else if (dontExpand !== true) {
      // The paths start at a different position, take the earliest path and
      // traverse up until it as at the same point from root as the path we want to
      // merge if the keys match we return the longer path with the other merged
      // After stemming we dont want to expand the trees

      // destructive assignment plz
      var t1 = branch.pos < path.pos ? branch : path;
      var t2 = branch.pos < path.pos ? path : branch;
      var diff = t2.pos - t1.pos;
      var parent, tmp = t1.ids;

      while(diff--) {
        parent = tmp[1];
        tmp = tmp[1][0];
      }

      if (tmp[0] !== t2.ids[0]) {
        restree.push(branch);
      } else {
        res = mergeTree(tmp, t2.ids);
        parent[0] = res.tree;
        restree.push({pos: t1.pos, ids: t1.ids});
        conflicts = conflicts || res.conflicts;
        merged = true;
      }
    } else {
      restree.push(branch);
    }
  });

  // We didnt find
  if (!merged) {
    restree.push(path);
  }

  restree.sort(function(a, b) {
    return a.pos - b.pos;
  });

  return {
    tree: restree,
    conflicts: conflicts || 'internal_node'
  };
}

function merge(tree, path, depth) {
  // Ugh, nicer way to not modify arguments in place?
  tree = JSON.parse(JSON.stringify(tree));
  path = JSON.parse(JSON.stringify(path));
  var newTree = doMerge(tree, path);
  return {
    tree: stem(newTree.tree, depth),
    conflicts: newTree.conflicts
  };
}

var simple = {pos: 1, ids: ['1', []]};
var two0 = {pos: 1, ids: ['1', [['2_0', []]]]};
var two1 = {pos: 1, ids: ['1', [['2_1', []]]]};
var newleaf = {pos: 2, ids: ['2_0', [['3', []]]]};
var withnewleaf = {pos: 1, ids: ['1', [['2_0', [['3', []]]]]]};
var newbranch = {pos: 1, ids: ['1', [['2_0', []], ['2_1', []]]]};
var newdeepbranch = {pos: 2, ids: ['2_0', [['3_1', []]]]};

var stemmededit = {pos: 3, ids: ['3', []]};
var stemmedconflicts = [simple, stemmededit];

var newbranchleaf = {pos: 1, ids: ['1', [['2_0', [['3', []]]], ['2_1', []]]]};
var newbranchleafbranch = {pos: 1, ids: ['1', [['2_0', [['3', []], ['3_1', []]]], ['2_1', []]]]};

var stemmed2 = [{pos: 1, ids: ['1', [['2_1', []]]]},
                {pos: 2, ids: ['2_0', [['3', []], ['3_1', []]]]}];

var stemmed3 = [{pos: 2, ids: ['2_1', []]},
                {pos: 3, ids: ['3', []]},
                {pos: 3, ids: ['3_1', []]}];
var partialrecover = [{pos: 1, ids: ['1', [['2_0', [['3', []]]]]]},
                      {pos: 2, ids: ['2_1', []]},
                      {pos: 3, ids: ['3_1', []]}];

test('Merging a path into an empty tree is the path', function() {
  deepEqual(merge([], simple, 10), {
    tree: [simple],
    conflicts: 'new_leaf'
  }, '');
});

test('Remerge path into path is reflexive', function() {
  deepEqual(merge([simple], simple, 10), {
    tree: [simple],
    conflicts: 'internal_node'
  }, '');
});

test('Merging a path with multiple entries is the path', function() {
  deepEqual(merge([], two0, 10), {
    tree: [two0],
    conflicts: 'new_leaf'
  }, '');
});

test('Merging a path with multiple entries is reflexive', function() {
  deepEqual(merge([two0], two0, 10), {
    tree: [two0],
    conflicts: 'internal_node'
  }, '');
});

test('Merging a subpath into a path results in the path', function() {
  deepEqual(merge([two0], simple, 10), {
    tree: [two0],
    conflicts: 'internal_node'
  }, '');
});

test('Merging a new leaf gives us a new leaf', function() {
  deepEqual(merge([two0], newleaf, 10), {
    tree: [withnewleaf],
    conflicts: 'new_leaf'
  }, '');
});

test('Merging a new branch returns a proper tree', function() {
  deepEqual(merge([two0], two1, 10), {
    tree: [newbranch],
    conflicts: 'new_branch'
  }, '');
});

test('Order of merging does not affect the resulting tree', function() {
  deepEqual(merge([two1], two0, 10), {
    tree: [newbranch],
    conflicts: 'new_branch'
  }, '');
});

test('Merging a new_leaf doesnt return new_branch when branches exist', function() {
  deepEqual(merge([newbranch], newleaf, 10), {
    tree: [newbranchleaf],
    conflicts: 'new_leaf'
  }, '');
});

test('Merging a deep branch with branches works', function() {
  deepEqual(merge([newbranchleaf], newdeepbranch, 10), {
    tree: [newbranchleafbranch],
    conflicts: 'new_branch'
  }, '');
});

test('New information reconnects steming induced conflicts', function() {
  deepEqual(merge(stemmedconflicts, withnewleaf, 10), {
    tree: [withnewleaf],
    conflicts: 'new_leaf'
  }, '');
});

test('Simple stemming works', function() {
  deepEqual(merge([two0], newleaf, 2), {
    tree: [newleaf],
    conflicts: 'new_leaf'
  }, '');
});

test('Merge with stemming works correctly for branches', function() {
  deepEqual(merge([newbranchleafbranch], simple, 2), {
    tree: stemmed2,
    conflicts: 'internal_node'
  }, '');
});

test('Merge with stemming to leaves works fine', function() {
  deepEqual(merge([newbranchleafbranch], simple, 1), {
    tree: stemmed3,
    conflicts: 'internal_node'
  }, '');
});

test('Merging unstemmed recovers as much as possible without losing info', function() {
  deepEqual(merge(stemmed3, withnewleaf, 10), {
    tree: partialrecover,
    conflicts: 'internal_node'
  }, '');
});