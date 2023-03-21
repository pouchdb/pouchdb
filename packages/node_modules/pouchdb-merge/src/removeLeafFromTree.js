import { clone } from 'pouchdb-utils';

// this method removes a leaf from a rev tree, independent of its status.
// e.g., by removing an available leaf, it could leave its predecessor as
// a missing leaf and corrupting the tree.
function removeLeafFromRevTree(tree, leafRev) {
  return tree.flatMap((path) => {
    path = removeLeafFromPath(path, leafRev);
    return path ? [path] : [];
  });
}

function removeLeafFromPath(path, leafRev) {
  const tree = clone(path);
  const toVisit = [tree];
  let node;

  while ((node = toVisit.pop())) {
    const { pos, ids: [id, , branches], parent } = node;
    const isLeaf = branches.length === 0;
    const hash = `${pos}-${id}`;

    if (isLeaf && hash === leafRev) {
      if (!parent) {
        // FIXME: we're facing the root, and probably shouldn't just return an empty array (object? null?).
        return null;
      }

      parent.ids[2] = parent.ids[2].filter(function (branchNode) {
        return branchNode[0] !== id;
      });
      return tree;
    }

    for (let i = 0, len = branches.length; i < len; i++) {
      toVisit.push({ pos: pos + 1, ids: branches[i], parent: node });
    }
  }
  return tree;
}

export default removeLeafFromRevTree;
