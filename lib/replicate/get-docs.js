'use strict';

var utils = require('./../utils');
var clone = utils.clone;
var Promise = utils.Promise;

var MAX_SIMULTANEOUS_REVS = 50;

function isGenOne(rev) {
  return /^1-/.test(rev);
}

//
// Fetch all the documents from the src as described in the "diffs",
// which is a mapping of docs IDs to revisions. If the state ever
// changes to "cancelled", then the returned promise will be rejected.
// Else it will be resolved with a list of fetched documents.
//
function getDocs(src, diffs, state) {
  diffs = clone(diffs); // we do not need to modify this

  var resultDocs = [];

  function fetchMissingRevs(id, missingRevs) {
    var opts = {
      revs: true,
      open_revs: missingRevs,
      attachments: true
    };
    return src.get(id, opts).then(function (docs) {
      if (state.cancelled) {
        throw new Error('cancelled');
      }
      docs.forEach(function (doc) {
        if (doc.ok) {
          resultDocs.push(doc.ok);
        }
      });
    });
  }

  function processDiffDoc(id) {
    var missing = diffs[id].missing;
    // avoid url too long error by batching
    var missingBatches = [];
    for (var i = 0; i < missing.length; i += MAX_SIMULTANEOUS_REVS) {
      var missingBatch = missing.slice(i,
        Math.min(missing.length, i + MAX_SIMULTANEOUS_REVS));
      missingBatches.push(missingBatch);
    }

    return Promise.all(missingBatches.map(function (missingRevs) {
      return fetchMissingRevs(id, missingRevs);
    }));
  }

  function getAllDocs() {
    var diffKeys = Object.keys(diffs);
    return Promise.all(diffKeys.map(processDiffDoc));
  }

  function hasAttachments(doc) {
    return doc._attachments && Object.keys(doc._attachments).length > 0;
  }

  function fetchRevisionOneDocs(ids) {
    // Optimization: fetch gen-1 docs and attachments in
    // a single request using _all_docs
    return src.allDocs({
      keys: ids,
      include_docs: true
    }).then(function (res) {
      if (state.cancelled) {
        throw new Error('cancelled');
      }
      res.rows.forEach(function (row) {
        if (row.deleted || !row.doc || !isGenOne(row.value.rev) ||
            hasAttachments(row.doc)) {
          // if any of these conditions apply, we need to fetch using get()
          return;
        }

        // the doc we got back from allDocs() is sufficient
        resultDocs.push(row.doc);
        delete diffs[row.id];
      });
    });
  }

  function getRevisionOneDocs() {
    // filter out the generation 1 docs and get them
    // leaving the non-generation one docs to be got otherwise
    var ids = Object.keys(diffs).filter(function (id) {
      var missing = diffs[id].missing;
      return missing.length === 1 && isGenOne(missing[0]);
    });
    if (ids.length > 0) {
      return fetchRevisionOneDocs(ids);
    }
  }

  function returnDocs() {
    return resultDocs;
  }

  return Promise.resolve()
    .then(getRevisionOneDocs)
    .then(getAllDocs)
    .then(returnDocs);
}

module.exports = getDocs;