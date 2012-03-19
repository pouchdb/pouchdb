// Porting tests from Apache CouchDB
// https://github.com/davisp/couchdb/blob/local_doc_revs/test/etap/060-kt-merging.t

module('merge rev tree');

function stem(tree, depth) {
  return tree;
}

function merge_one(tree, path) {

  var result = {tree: tree, conflicts: null};

  // Returns true if the trees are an exact match, false if they dont match
  // or a merged tree if they are a partial match
  function matchSubtree(base, tree1, tree2) {
    for (var i = 0; i < tree1.length; i++) {
      if (tree1[i][0] === tree2[0]) {
        base.push(tree1);
        var t1Leaf = tree1[i].length === 1;
        var t2Leaf = tree2.length === 1;
        // Exact match
        if (t1Leaf && t1Leaf) {
          return true;
        }
        // tree1 ended, append the rest of tree2
        if (t1Leaf) {
          base[base.length-1][i].push(tree2); // Probably broken
          return base;
        }
        // tree2 ended, append the rest of tree1
        if (t2Leaf) {
          base[base.length-1][i].push(tree1); // Probably broken
          return base;
        }
        return matchSubtree(base[i], tree[i][0], tree2[0]);
      }
    }
    return false;
  }

  function stripBase(arr, i) {
    var base = [];
    var el;
    while (i--) {
      base.push(arr.shift());  // broken
    }

    return base;
  }

  if (!tree.length) {
    return {tree: [path], conflicts: 'new_leaf'};
  }

  var found = false;

  tree.forEach(function(branch, i) {
    if (found) {
      return;
    }
    // Stem the revision paths to a common base, if we have one tree
    // with 3 edits and one with 2, set them both to 2, accumulate the common
    // prefix, as we talk up the tree we append to it
    var base = branch.pos === path.pos ? []
      : branch.pos > path.pos ? stripBase(path.ids, branch.pos - path.pos)
      : stripBase(branch.ids, path.pos - branch.pos);

    var res = matchSubtree(base, branch.ids, path.ids);

    if (res === true) {
      found = true;
      result.conflicts = 'internal_node';
    }

    // branch and path now start from a fixed base,
    // find common path, if it exists, contat the remainder
  });

  // I may have just merged a common parent that joins 2 branches, reduce those

  return result;
}

function merge(tree1, path, depth) {
  var tree = merge_one(tree1, path);
  tree.tree.sort();
  return {
    tree: stem(tree.tree, depth),
    conflicts: tree.conflicts
  };
}

var simple = {pos: 1, ids: ['1']};
var two0 = {pos: 1, ids: ['1', [['2_0']]]};
var two1 = {pos: 1, ids: ['1', [['2_1']]]};
var newleaf = {pos: 2, ids: ['2_0', [['3']]]};
var withnewleaf = {pos: 1, ids: ['1', [['2_0', [['3']]]]]};
var newbranch = {pos: 1, ids: ['1', [['2_0'], ['2_1']]]};
var newdeepbranch = {pos: 2, ids: ['2_0', [['3_1']]]};

var stemmededit = {pos: 3, ids: ['3']};
var stemmedconflicts = [simple, stemmededit];

var newbranchleaf = {pos: 1, ids: ['1', [['2_0', [['3']]], ['2_1']]]};
var newbranchleafbranch = {pos: 1, ids: ['1', [['2_0', [['3'], ['3_1']]], ['2_1']]]};

var stemmed2 = [{pos: 1, ids: ['1', [['2_1']]]},
                {pos: 2, ids: ['2_0', [['3'], ['3_1']]]}];

var stemmed3 = [{pos: 2, ids: ['2_1']},
                {pos: 3, ids: ['3']},
                {pos: 3, ids: ['3_1']}];
var partialrecover = [{pos: 1, ids: ['1', [['2_0', [['3']]]]]},
                      {pos: 2, ids: ['2_1']},
                      {pos: 3, ids: ['3_1']}];

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

test('Merging a deep branch with branches works', function() {
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