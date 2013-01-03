(function() {
  // a few hacks to get things in the right place for node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Pouch;
    var utils = require('./pouch.utils.js');
    for (var k in utils) {
      global[k] = utils[k];
    }
  }

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
  // The roots of tree1 and tree2 must be the same revision
  function mergeTree(tree1, tree2) {
    var conflicts = false;
    for (var i = 0; i < tree2[1].length; i++) {
      if (!tree1[1][0]) {
        conflicts = 'new_leaf';
        tree1[1][0] = tree2[1][i];
      }

      var merged = false;
      for (var j = 0; j < tree1[1].length; j++) {
        if (tree1[1][j][0] == tree2[1][i][0]) {
          var result = mergeTree(tree1[1][j], tree2[1][i]);
          conflicts = result.conflicts || conflicts;
          tree1[1][j] = result.tree;
          merged = true;
        }
      }
      if (!merged) {
        conflicts = 'new_branch';
        tree1[1].push(tree2[1][i]);
        tree1[1].sort();
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
        // merge.  If the keys match we return the longer path with the other merged
        // After stemming we dont want to expand the trees

        var t1 = branch.pos < path.pos ? branch : path;
        var t2 = branch.pos < path.pos ? path : branch;
        var diff = t2.pos - t1.pos;

        var candidateParents = [];
        function treeWalk(ids, diff, parent, parentIdx) {
          if (diff == 0) {
            if (ids[0] == t2.ids[0]) {
              candidateParents.push({parent: parent, ids: ids, parentIdx: parentIdx});
            }
            return;
          }
          if (!ids) return;
          ids[1].forEach(function(el, idx) {
            treeWalk(el, diff-1, ids, idx);
          });
        }

        treeWalk(t1.ids, diff, undefined);

        var el = candidateParents[0];

        if (!el) {
          restree.push(branch);
        } else {
          res = mergeTree(el.ids, t2.ids);
          el.parent[1][el.parentIdx] = res.tree;
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

  Pouch.merge = function(tree, path, depth) {
    // Ugh, nicer way to not modify arguments in place?
    tree = JSON.parse(JSON.stringify(tree));
    path = JSON.parse(JSON.stringify(path));
    var newTree = doMerge(tree, path);
    return {
      tree: stem(newTree.tree, depth),
      conflicts: newTree.conflicts
    };
  };

}).call(this);
