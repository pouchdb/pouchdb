'use strict';

import {
  createError,
  REV_CONFLICT,
  MISSING_DOC,
  MISSING_STUB,
  BAD_ARG,
  UNKNOWN_ERROR
} from 'pouchdb-errors';

import {
  atob,
  binaryStringToBlobOrBuffer as binStringToBlobOrBuffer,
  blobOrBufferToBase64 as blufferToBase64,
} from 'pouchdb-binary-utils';

import { isLocalId, parseDoc } from 'pouchdb-adapter-utils';
import { binaryMd5 as md5 } from 'pouchdb-md5';
import { winningRev as calculateWinningRev, merge, compactTree } from 'pouchdb-merge';

import { DOC_STORE, META_LOCAL_STORE, idbError } from './util';

import { rewrite, sanitise } from './rewrite';
const sanitisedAttachmentKey = sanitise('_attachments');

export default function (api, req, opts, metadata, dbOpts, idbChanges, callback) {

  let txn;

  // TODO: I would prefer to get rid of these globals
  let error;
  const results = [];
  const docs = [];
  let lastWriteIndex;

  const revsLimit = dbOpts.revs_limit || 1000;
  const rewriteEnabled = dbOpts.name.indexOf("-mrview-") === -1;
  const autoCompaction = dbOpts.auto_compaction;

  // We only need to track 1 revision for local documents
  function docsRevsLimit(doc) {
    return isLocalId(doc.id) ? 1 : revsLimit;
  }

  function rootIsMissing(doc) {
    return doc.rev_tree[0].ids[1].status === 'missing';
  }

  // Reads the original doc from the store if available
  // As in allDocs with keys option using multiple get calls is the fastest way
  function fetchExistingDocs(txn, docs) {
    let fetched = 0;
    const oldDocs = {};

    function readDone(e) {
      if (e.target.result) {
        oldDocs[e.target.result.id] = e.target.result;
      }
      if (++fetched === docs.length) {
        processDocs(txn, docs, oldDocs);
      }
    }

    docs.forEach(function (doc) {
      const docStore = isLocalId(doc.id) ? META_LOCAL_STORE : DOC_STORE;
      txn.objectStore(docStore).get(doc.id).onsuccess = readDone;
    });
  }

  function revHasAttachment(doc, rev, digest) {
    return doc.revs[rev] &&
      doc.revs[rev].data._attachments &&
      Object.values(doc.revs[rev].data._attachments).find(function (att) {
        return att.digest === digest;
      });
  }

  function processDocs(txn, docs, oldDocs) {

    docs.forEach(function (doc, i) {
      let newDoc;

      // The first document write cannot be a deletion
      if ('was_delete' in opts && !(Object.prototype.hasOwnProperty.call(oldDocs, doc.id))) {
        newDoc = createError(MISSING_DOC, 'deleted');

      // The first write of a document cannot specify a revision
      } else if (opts.new_edits &&
                 !Object.prototype.hasOwnProperty.call(oldDocs, doc.id) &&
                 rootIsMissing(doc)) {
        newDoc = createError(REV_CONFLICT);

      // Update the existing document
      } else if (Object.prototype.hasOwnProperty.call(oldDocs, doc.id)) {
        newDoc = update(txn, doc, oldDocs[doc.id]);
        // The update can be rejected if it is an update to an existing
        // revision, if so skip it
        if (newDoc == false) {
          return;
        }

      // New document
      } else {
        // Ensure new documents are also stemmed
        const merged = merge([], doc.rev_tree[0], docsRevsLimit(doc));
        doc.rev_tree = merged.tree;
        doc.stemmedRevs = merged.stemmedRevs;
        newDoc = doc;
        newDoc.isNewDoc = true;
        newDoc.wasDeleted = doc.revs[doc.rev].deleted ? 1 : 0;
      }

      if (newDoc.error) {
        results[i] = newDoc;
      } else {
        oldDocs[newDoc.id] = newDoc;
        lastWriteIndex = i;
        write(txn, newDoc, i);
      }
    });
  }

  // Converts from the format returned by parseDoc into the new format
  // we use to store
  function convertDocFormat(doc) {

    const newDoc = {
      id: doc.metadata.id,
      rev: doc.metadata.rev,
      rev_tree: doc.metadata.rev_tree,
      revs: doc.metadata.revs || {}
    };

    newDoc.revs[newDoc.rev] = {
      data: doc.data,
      deleted: doc.metadata.deleted
    };

    return newDoc;
  }

  function update(txn, doc, oldDoc) {

    // Ignore updates to existing revisions
    if ((doc.rev in oldDoc.revs) && !opts.new_edits) {
      return false;
    }

    const isRoot = /^1-/.test(doc.rev);

    // Reattach first writes after a deletion to last deleted tree
    if (oldDoc.deleted && !doc.deleted && opts.new_edits && isRoot) {
      const tmp = doc.revs[doc.rev].data;
      tmp._rev = oldDoc.rev;
      tmp._id = oldDoc.id;
      doc = convertDocFormat(parseDoc(tmp, opts.new_edits, dbOpts));
    }

    const merged = merge(oldDoc.rev_tree, doc.rev_tree[0], docsRevsLimit(doc));
    doc.stemmedRevs = merged.stemmedRevs;
    doc.rev_tree = merged.tree;

    // Merge the old and new rev data
    const revs = oldDoc.revs;
    revs[doc.rev] = doc.revs[doc.rev];
    doc.revs = revs;

    doc.attachments = oldDoc.attachments;

    const inConflict = opts.new_edits && (((oldDoc.deleted && doc.deleted) ||
       (!oldDoc.deleted && merged.conflicts !== 'new_leaf') ||
       (oldDoc.deleted && !doc.deleted && merged.conflicts === 'new_branch') ||
       (oldDoc.rev === doc.rev)));

    if (inConflict) {
      return createError(REV_CONFLICT);
    }

    doc.wasDeleted = oldDoc.deleted;

    return doc;
  }

  function write(txn, doc, i) {

    // We copy the data from the winning revision into the root
    // of the document so that it can be indexed
    const winningRev = calculateWinningRev(doc);
    // rev of new doc for attachments and to return it
    const writtenRev = doc.rev;
    const isLocal = isLocalId(doc.id);

    const theDoc = doc.revs[winningRev].data;

    const isNewDoc = doc.isNewDoc;

    if (rewriteEnabled) {
      // doc.data is what we index, so we need to clone and rewrite it, and clean
      // it up for indexability
      doc.data = rewrite(theDoc);
      delete doc.data[sanitisedAttachmentKey];
    } else {
      doc.data = theDoc;
    }

    doc.rev = winningRev;
    // .deleted needs to be an int for indexing
    doc.deleted = doc.revs[winningRev].deleted ? 1 : 0;

    // Bump the seq for every new (non local) revision written
    if (!isLocal) {
      doc.seq = ++metadata.seq;

      let delta = 0;
      // If its a new document, we wont decrement if deleted
      if (doc.isNewDoc) {
        delta = doc.deleted ? 0 : 1;
      } else if (doc.wasDeleted !== doc.deleted) {
        delta = doc.deleted ? -1 : 1;
      }
      metadata.doc_count += delta;
    }
    delete doc.isNewDoc;
    delete doc.wasDeleted;

    // If there have been revisions stemmed when merging trees,
    // delete their data
    let revsToDelete = doc.stemmedRevs || [];

    if (autoCompaction && !isNewDoc) {
      const result = compactTree(doc);
      if (result.length) {
        revsToDelete = revsToDelete.concat(result);
      }
    }

    if (revsToDelete.length) {
      revsToDelete.forEach(function (rev) { delete doc.revs[rev]; });
    }

    delete doc.stemmedRevs;

    if (!('attachments' in doc)) {
      doc.attachments = {};
    }

    if (theDoc._attachments) {
      for (const k in theDoc._attachments) {
        const attachment = theDoc._attachments[k];
        if (attachment.stub) {
          if (!(attachment.digest in doc.attachments)) {
            error = createError(MISSING_STUB);
            // TODO: Not sure how safe this manual abort is, seeing
            // console issues
            txn.abort();
            return;
          }

          if (revHasAttachment(doc, writtenRev, attachment.digest)) {
            doc.attachments[attachment.digest].revs[writtenRev] = true;
          }

        } else {

          doc.attachments[attachment.digest] = attachment;
          doc.attachments[attachment.digest].revs = {};
          doc.attachments[attachment.digest].revs[writtenRev] = true;

          theDoc._attachments[k] = {
            stub: true,
            digest: attachment.digest,
            content_type: attachment.content_type,
            length: attachment.length,
            revpos: parseInt(writtenRev, 10)
          };
        }
      }
    }

    // Local documents have different revision handling
    if (isLocal && doc.deleted) {
      txn.objectStore(META_LOCAL_STORE).delete(doc.id).onsuccess = function () {
        results[i] = {
          ok: true,
          id: doc.id,
          rev: '0-0'
        };
      };
      updateSeq(i);
      return;
    }

    const docStore = isLocal ? META_LOCAL_STORE : DOC_STORE;
    txn.objectStore(docStore).put(doc).onsuccess = function () {
      results[i] = {
        ok: true,
        id: doc.id,
        rev: writtenRev
      };
      updateSeq(i);
    };
  }

  function updateSeq(i) {
    if (i === lastWriteIndex) {
      txn.objectStore(META_LOCAL_STORE).put(metadata);
    }
  }

  function preProcessAttachment(attachment) {
    if (attachment.stub) {
      return Promise.resolve(attachment);
    }

    let binData;
    if (typeof attachment.data === 'string') {
      try {
        binData = atob(attachment.data);
      } catch (e) {
        return Promise.reject(createError(BAD_ARG, 'Attachment is not a valid base64 string'));
      }
      if (metadata.idb_attachment_format === 'binary') {
        attachment.data = binStringToBlobOrBuffer(binData, attachment.content_type);
      }
    } else {
      binData = attachment.data;
      if (metadata.idb_attachment_format === 'base64') {
        // TODO could run these in parallel, if we cared
        return new Promise(resolve => {
          blufferToBase64(attachment.data, function (b64) {
            attachment.data = b64;
            md5(binData, function (result) {
              attachment.digest = 'md5-' + result;
              attachment.length = binData.size || binData.length || 0;
              resolve(attachment);
            });
          });
        });
      }
    }

    return new Promise(function (resolve) {
      md5(binData, function (result) {
        attachment.digest = 'md5-' + result;
        attachment.length = binData.size || binData.length || 0;
        resolve(attachment);
      });
    });
  }

  function preProcessAttachments() {
    const promises = docs.map(function (doc) {
      const data = doc.revs[doc.rev].data;
      if (!data._attachments) {
        return Promise.resolve(data);
      }
      const attachments = Object.keys(data._attachments).map(function (k) {
        data._attachments[k].name = k;
        return preProcessAttachment(data._attachments[k]);
      });

      return Promise.all(attachments).then(function (newAttachments) {
        const processed = {};
        newAttachments.forEach(function (attachment) {
          processed[attachment.name] = attachment;
          delete attachment.name;
        });
        data._attachments = processed;
        return data;
      });
    });
    return Promise.all(promises);
  }

  for (let i = 0, len = req.docs.length; i < len; i++) {
    let result;
    // TODO: We should get rid of throwing for invalid docs, also not sure
    // why this is needed in idb-next and not idb
    try {
      result = parseDoc(req.docs[i], opts.new_edits, dbOpts);
    } catch (err) {
      result = err;
    }
    if (result.error) {
      return callback(result);
    }

    // Ideally parseDoc would return data in this format, but it is currently
    // shared so we need to convert
    docs.push(convertDocFormat(result));
  }

  preProcessAttachments().then(function () {
    // We _could_ check doc ids here, and skip opening DOC_STORE if all docs are local.
    // This may marginally slow things down for local docs.  It seems pragmatic to keep
    // the code simple and optimise for calls to bulkDocs() which include non-local docs.
    api._openTransactionSafely([DOC_STORE, META_LOCAL_STORE], 'readwrite', function (err, _txn) {
      if (err) {
        return callback(err);
      }

      txn = _txn;

      txn.onabort = function () {
        callback(error || createError(UNKNOWN_ERROR, 'transaction was aborted'));
      };
      txn.ontimeout = idbError(callback);

      txn.oncomplete = function () {
        idbChanges.notify(dbOpts.name);
        callback(null, results);
      };

      // We would like to use promises here, but idb sucks
      fetchExistingDocs(txn, docs);
    });
  }).catch(function (err) {
    callback(err);
  });
}
