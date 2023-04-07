import { DOC_STORE } from "pouchdb-adapter-indexeddb/src/util";
import { removeLeafFromTree, winningRev } from "pouchdb-merge";

function purgeAttachments(doc, revs) {
  if (!doc.attachments) {
    // If there are no attachments, doc.attachments is an empty object
    return {};
  }

  // Iterate over all attachments and remove the respective revs
  for (let key in doc.attachments) {
    const attachment = doc.attachments[key];

    for (let rev of revs) {
      if (attachment.revs[rev]) {
        delete attachment.revs[rev];
      }
    }

    if (Object.keys(attachment.revs).length === 0) {
      delete doc.attachments[key];
    }
  }

  return doc.attachments;
}

// `purge()` expects a path of revisions in its revs argument that:
// - starts with a leaf rev
// - continues sequentially with the remaining revs of that leaf’s branch
//
// eg. for this rev tree:
// 1-9692 ▶ 2-37aa ▶ 3-df22 ▶ 4-6e94 ▶ 5-df4a ▶ 6-6a3a ▶ 7-57e5
//          ┃                 ┗━━━━━━▶ 5-8d8c ▶ 6-65e0
//          ┗━━━━━━▶ 3-43f6 ▶ 4-a3b4
//
// …if you wanted to purge '7-57e5', you would provide ['7-57e5', '6-6a3a', '5-df4a']
//
// The purge adapter implementation in `pouchdb-core` uses the helper function `findPathToLeaf`
// from `pouchdb-merge` to construct this array correctly. Since this purge implementation is
// only ever called from there, we do no additional checks here as to whether `revs` actually
// fulfills the criteria above, since `findPathToLeaf` already does these.
function purge(txn, docId, revs, callback) {
  if (txn.error) {
    return callback(txn.error);
  }

  const docStore = txn.txn.objectStore(DOC_STORE);
  const deletedRevs = [];
  let documentWasRemovedCompletely = false;
  docStore.get(docId).onsuccess = (e) => {
    const doc = e.target.result;

    // we could do a dry run here to check if revs is a proper path towards a leaf in the rev tree

    for (const rev of revs) {
      // purge rev from tree
      doc.rev_tree = removeLeafFromTree(doc.rev_tree, rev);

      // assign new revs
      delete doc.revs[rev];
      deletedRevs.push(rev);
    }

    if (doc.rev_tree.length === 0) {
      // if the rev tree is empty, we can delete the entire document
      docStore.delete(doc.id);
      documentWasRemovedCompletely = true;
      return;
    }

    // find new winning rev
    doc.rev = winningRev(doc);
    doc.data = doc.revs[doc.rev].data;
    doc.attachments = purgeAttachments(doc, revs);

    // finally, write the purged doc
    docStore.put(doc);
  };

  txn.txn.oncomplete = function () {
    callback(null, {
      ok: true,
      deletedRevs,
      documentWasRemovedCompletely
    });
  };
}

export default purge;
