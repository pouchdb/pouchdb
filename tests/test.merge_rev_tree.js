// Porting tests from Apache CouchDB
// https://github.com/davisp/couchdb/blob/local_doc_revs/test/etap/060-kt-merging.t

module('merge rev tree');

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
  deepEqual(pouch.merge([], simple, 10), {
    tree: [simple],
    conflicts: 'new_leaf'
  }, '');
});

test('Remerge path into path is reflexive', function() {
  deepEqual(pouch.merge([simple], simple, 10), {
    tree: [simple],
    conflicts: 'internal_node'
  }, '');
});

test('Merging a path with multiple entries is the path', function() {
  deepEqual(pouch.merge([], two0, 10), {
    tree: [two0],
    conflicts: 'new_leaf'
  }, '');
});

test('Merging a path with multiple entries is reflexive', function() {
  deepEqual(pouch.merge([two0], two0, 10), {
    tree: [two0],
    conflicts: 'internal_node'
  }, '');
});

test('Merging a subpath into a path results in the path', function() {
  deepEqual(pouch.merge([two0], simple, 10), {
    tree: [two0],
    conflicts: 'internal_node'
  }, '');
});

test('Merging a new leaf gives us a new leaf', function() {
  deepEqual(pouch.merge([two0], newleaf, 10), {
    tree: [withnewleaf],
    conflicts: 'new_leaf'
  }, '');
});

test('Merging a new branch returns a proper tree', function() {
  deepEqual(pouch.merge([two0], two1, 10), {
    tree: [newbranch],
    conflicts: 'new_branch'
  }, '');
});

test('Order of merging does not affect the resulting tree', function() {
  deepEqual(pouch.merge([two1], two0, 10), {
    tree: [newbranch],
    conflicts: 'new_branch'
  }, '');
});

test('Merging a new_leaf doesnt return new_branch when branches exist', function() {
  deepEqual(pouch.merge([newbranch], newleaf, 10), {
    tree: [newbranchleaf],
    conflicts: 'new_leaf'
  }, '');
});

test('Merging a deep branch with branches works', function() {
  deepEqual(pouch.merge([newbranchleaf], newdeepbranch, 10), {
    tree: [newbranchleafbranch],
    conflicts: 'new_branch'
  }, '');
});

test('New information reconnects steming induced conflicts', function() {
  deepEqual(pouch.merge(stemmedconflicts, withnewleaf, 10), {
    tree: [withnewleaf],
    conflicts: 'new_leaf'
  }, '');
});

test('Simple stemming works', function() {
  deepEqual(pouch.merge([two0], newleaf, 2), {
    tree: [newleaf],
    conflicts: 'new_leaf'
  }, '');
});

test('Merge with stemming works correctly for branches', function() {
  deepEqual(pouch.merge([newbranchleafbranch], simple, 2), {
    tree: stemmed2,
    conflicts: 'internal_node'
  }, '');
});

test('Merge with stemming to leaves works fine', function() {
  deepEqual(pouch.merge([newbranchleafbranch], simple, 1), {
    tree: stemmed3,
    conflicts: 'internal_node'
  }, '');
});

test('Merging unstemmed recovers as much as possible without losing info', function() {
  deepEqual(pouch.merge(stemmed3, withnewleaf, 10), {
    tree: partialrecover,
    conflicts: 'internal_node'
  }, '');
});