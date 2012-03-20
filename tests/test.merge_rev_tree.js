// Porting tests from Apache CouchDB
// https://github.com/davisp/couchdb/blob/local_doc_revs/test/etap/060-kt-merging.t

module('merge rev tree');

function stem(tree, depth) {
  return tree;
}

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
    } else {
      var result = mergeTree(tree1[1][0], tree2[1][i]);
      conflicts = result.conflicts || conflicts;
      tree1[1][0] = result.tree;
    }
  }
  return {conflicts: conflicts, tree: tree1};
}

function merge_one(tree, path) {

  var result = {tree: tree, conflicts: null};

  if (!tree.length) {
    return {tree: path, conflicts: 'new_leaf'};
  }

  for (var i = 0; i < tree.length; i++) {
    var branch = tree[i];
    var res;
    if (branch.pos === path.pos) {
      res = mergeTree(branch.ids, path.ids);
      return {
        conflicts: res.conflicts || 'internal_node',
        tree: {pos: branch.pos, ids: res.tree}
      };
    } else {
      // destructive assignment plz
      var t1 = branch.pos < path.pos ? branch : path;
      var t2 = branch.pos < path.pos ? path : branch;
      var diff = t2.pos - t1.pos;
      var parent, tmp = t1.ids;

      while(diff--) {
        parent = tmp[1];
        tmp = tmp[1][0];
      }

      res = mergeTree(tmp, t2.ids);
      parent[0] = res.tree;
      return {
        conflicts: res.conflicts || 'internal_node',
        tree: {pos: t1.pos, ids: t1.ids}
      };
    }
  }
  return result;
}

function merge(tree1, path, depth) {
  tree1 = JSON.parse(JSON.stringify(tree1));
  path = JSON.parse(JSON.stringify(path));
  var tree = merge_one(tree1, path);
  return {
    tree: [stem(tree.tree, depth)],
    conflicts: tree.conflicts
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

var stemmed2 = [{pos: 1, ids: ['1', [['2_1']]]},
                {pos: 2, ids: ['2_0', [['3', ['3_1', []]]]]}];

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