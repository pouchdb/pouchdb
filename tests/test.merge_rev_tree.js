// Porting tests from Apache CouchDB
// https://github.com/davisp/couchdb/blob/local_doc_revs/test/etap/060-kt-merging.t

module('merge rev tree');

function merge(tree1, tree2, depth) {
  return false;
}

test('Test merging revision tree', function() {

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

  equal(merge([], simple, 10), {
    tree: [simple],
    type: 'new_leaf'
  }, 'Merging a path into an empty tree is the path');

  equal(merge([simple], simple, 10), {
    tree: [simple],
    type: 'internal_node'
  }, 'Remerge path into path is reflexive');

  equal(merge([], two0, 10), {
    tree: [two0],
    type: 'new_leaf'
  }, 'Merging a path with multiple entries is the path');

  equal(merge([two0], two0, 10), {
    tree: [two0],
    type: 'internal_node'
  }, 'Merging a path with multiple entries is reflexive');

  equal(merge([two0], simple, 10), {
    tree: [two0],
    type: 'internal_node'
  }, 'Merging a subpath into a path results in the path');

  equal(merge([two0], newleaf, 10), {
    tree: [withnewleaf],
    type: 'new_leaf'
  }, 'Merging a new leaf gives us a new leaf');

  equal(merge([two0], two1, 10), {
    tree: [newbranch],
    type: 'new_branch'
  }, 'Merging a new branch returns a proper tree');

  equal(merge([two1], two0, 10), {
    tree: [newbranch],
    type: 'new_branch'
  }, 'Order of merging does not affect the resulting tree');

  equal(merge([newbranch], newleaf, 10), {
    tree: [newbranchleaf],
    type: 'new_leaf'
  }, 'Merging a new_leaf doesnt return new_branch when branches exist');

  equal(merge([newbranchleaf], newdeepbranch, 10), {
    tree: [newbranchleafbranch],
    type: 'new_branch'
  }, 'Merging a deep branch with branches works');

  equal(merge(stemmedconflicts, withnewleaf, 10), {
    tree: [withnewleaf],
    type: 'new_leaf'
  }, 'Merging a deep branch with branches works');

  equal(merge([two0], newleaf, 2), {
    tree: [newleaf],
    type: 'new_leaf'
  }, 'Simple stemming works');

  equal(merge([newbranchleafbranch], simple, 2), {
    tree: stemmed2,
    type: 'internal_node'
  }, 'Merge with stemming works correctly for branches');

  equal(merge([newbranchleafbranch], simple, 1), {
    tree: stemmed3,
    type: 'internal_node'
  }, 'Merge with stemming to leaves works fine');

  equal(merge(stemmed3, withnewleaf, 10), {
    tree: partialrecover,
    type: 'internal_node'
  }, 'Merging unstemmed recovers as much as possible without losing info');
});