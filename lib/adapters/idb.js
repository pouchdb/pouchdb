'use strict';

var utils = require('../utils');
var merge = require('../merge');
var errors = require('../deps/errors');
var vuvuzela = require('vuvuzela');

var cachedDBs = {};
var taskQueue = {
  running: false,
  queue: []
};

function tryCode(fun, that, args) {
  try {
    fun.apply(that, args);
  } catch (err) { // shouldn't happen
    if (window.PouchDB) {
      window.PouchDB.emit('error', err);
    }
  }
}

function applyNext() {
  if (taskQueue.running || !taskQueue.queue.length) {
    return;
  }
  taskQueue.running = true;
  var item = taskQueue.queue.shift();
  item.action(function (err, res) {
    tryCode(item.callback, this, [err, res]);
    taskQueue.running = false;
    process.nextTick(applyNext);
  });
}

function idbError(callback) {
  return function (event) {
    var message = (event.target && event.target.error &&
      event.target.error.name) || event.target;
    callback(errors.error(errors.IDB_ERROR, message, event.type));
  };
}

// Unfortunately, the metadata has to be stringified
// when it is put into the database, because otherwise
// IndexedDB can throw errors for deeply-nested objects.
// Originally we just used JSON.parse/JSON.stringify; now
// we use this custom vuvuzela library that avoids recursion.
// If we could do it all over again, we'd probably use a
// format for the revision trees other than JSON.
function encodeMetadata(metadata, winningRev, deleted) {
  var storedObject = {data: vuvuzela.stringify(metadata)};
  storedObject.winningRev = winningRev;
  storedObject.deletedOrLocal = deleted ? '1' : '0';
  storedObject.id = metadata.id;
  return storedObject;
}

function decodeMetadata(storedObject) {
  if (!storedObject) {
    return null;
  }
  if (!storedObject.data) {
    // old format, when we didn't store it stringified
    return storedObject;
  }
  var metadata = vuvuzela.parse(storedObject.data);
  metadata.winningRev = storedObject.winningRev;
  metadata.deletedOrLocal = storedObject.deletedOrLocal === '1';
  return metadata;
}

function IdbPouch(opts, callback) {
  var api = this;

  taskQueue.queue.push({
    action: function (thisCallback) {
      init(api, opts, thisCallback);
    },
    callback: callback
  });
  applyNext();
}

function init(api, opts, callback) {

  // IndexedDB requires a versioned database structure, so we use the
  // version here to manage migrations.
  var ADAPTER_VERSION = 3;

  // The object stores created for each database
  // DOC_STORE stores the document meta data, its revision history and state
  // Keyed by document id
  var DOC_STORE = 'document-store';
  // BY_SEQ_STORE stores a particular version of a document, keyed by its
  // sequence id
  var BY_SEQ_STORE = 'by-sequence';
  // Where we store attachments
  var ATTACH_STORE = 'attach-store';
  // Where we store database-wide meta data in a single record
  // keyed by id: META_STORE
  var META_STORE = 'meta-store';
  // Where we store local documents
  var LOCAL_STORE = 'local-store';
  // Where we detect blob support
  var DETECT_BLOB_SUPPORT_STORE = 'detect-blob-support';

  var name = opts.name;

  var blobSupport = null;
  var instanceId = null;
  var idStored = false;
  var idb = null;
  var docCount = -1;

  function createSchema(db) {
    db.createObjectStore(DOC_STORE, {keyPath : 'id'})
      .createIndex('seq', 'seq', {unique: true});
    db.createObjectStore(BY_SEQ_STORE, {autoIncrement: true})
      .createIndex('_doc_id_rev', '_doc_id_rev', {unique: true});
    db.createObjectStore(ATTACH_STORE, {keyPath: 'digest'});
    db.createObjectStore(META_STORE, {keyPath: 'id', autoIncrement: false});
    db.createObjectStore(DETECT_BLOB_SUPPORT_STORE);
  }

  // migration to version 2
  // unfortunately "deletedOrLocal" is a misnomer now that we no longer
  // store local docs in the main doc-store, but whaddyagonnado
  function addDeletedOrLocalIndex(e, callback) {
    var transaction = e.currentTarget.transaction;
    var docStore = transaction.objectStore(DOC_STORE);
    docStore.createIndex('deletedOrLocal', 'deletedOrLocal', {unique : false});

    docStore.openCursor().onsuccess = function (event) {
      var cursor = event.target.result;
      if (cursor) {
        var metadata = cursor.value;
        var deleted = utils.isDeleted(metadata);
        metadata.deletedOrLocal = deleted ? "1" : "0";
        docStore.put(metadata);
        cursor.continue();
      } else {
        callback(transaction);
      }
    };
  }

  // migrations to get to version 3

  function createLocalStoreSchema(db) {
    db.createObjectStore(LOCAL_STORE, {keyPath: '_id'})
      .createIndex('_doc_id_rev', '_doc_id_rev', {unique: true});
  }

  function migrateLocalStore(e, tx) {
    tx = tx || e.currentTarget.transaction;
    var localStore = tx.objectStore(LOCAL_STORE);
    var docStore = tx.objectStore(DOC_STORE);
    var seqStore = tx.objectStore(BY_SEQ_STORE);

    var cursor = docStore.openCursor();
    cursor.onsuccess = function (event) {
      var cursor = event.target.result;
      if (cursor) {
        var metadata = cursor.value;
        var docId = metadata.id;
        var local = utils.isLocalId(docId);
        var rev = merge.winningRev(metadata);
        if (local) {
          var docIdRev = docId + "::" + rev;
          // remove all seq entries
          // associated with this docId
          var start = docId + "::";
          var end = docId + "::~";
          var index = seqStore.index('_doc_id_rev');
          var range = global.IDBKeyRange.bound(start, end, false, false);
          var seqCursor = index.openCursor(range);
          seqCursor.onsuccess = function (e) {
            seqCursor = e.target.result;
            if (!seqCursor) {
              // done
              docStore.delete(cursor.primaryKey);
              cursor.continue();
            } else {
              var data = seqCursor.value;
              if (data._doc_id_rev === docIdRev) {
                localStore.put(data);
              }
              seqStore.delete(seqCursor.primaryKey);
              seqCursor.continue();
            }
          };
        } else {
          cursor.continue();
        }
      }
    };
  }

  api.type = function () {
    return 'idb';
  };

  api._id = utils.toPromise(function (callback) {
    callback(null, instanceId);
  });

  api._bulkDocs = function idb_bulkDocs(req, opts, callback) {
    var newEdits = opts.new_edits;
    var userDocs = req.docs;
    // Parse the docs, give them a sequence number for the result
    var docInfos = userDocs.map(function (doc, i) {
      if (doc._id && utils.isLocalId(doc._id)) {
        return doc;
      }
      var newDoc = utils.parseDoc(doc, newEdits);
      newDoc._bulk_seq = i;
      return newDoc;
    });

    var docInfoErrors = docInfos.filter(function (docInfo) {
      return docInfo.error;
    });
    if (docInfoErrors.length) {
      return callback(docInfoErrors[0]);
    }

    var results = new Array(docInfos.length);
    var fetchedDocs = new utils.Map();
    var updateSeq = 0;
    var numDocsWritten = 0;
    var preconditionErrored = false;

    function writeMetaData(e) {
      var meta = e.target.result;
      meta.updateSeq = (meta.updateSeq || 0) + updateSeq;
      txn.objectStore(META_STORE).put(meta);
    }

    function checkDoneWritingDocs() {
      if (++numDocsWritten === docInfos.length) {
        txn.objectStore(META_STORE).get(META_STORE).onsuccess = writeMetaData;
      }
    }

    function processDocs() {
      if (!docInfos.length) {
        return;
      }

      var idsToDocs = new utils.Map();

      docInfos.forEach(function (currentDoc, resultsIdx) {
        if (currentDoc._id && utils.isLocalId(currentDoc._id)) {
          api[currentDoc._deleted ? '_removeLocal' : '_putLocal'](
              currentDoc, {ctx: txn}, function (err, resp) {
            if (err) {
              results[resultsIdx] = err;
            } else {
              results[resultsIdx] = {};
            }
            checkDoneWritingDocs();
          });
          return;
        }

        var id = currentDoc.metadata.id;
        if (idsToDocs.has(id)) {
          idsToDocs.get(id).push([currentDoc, resultsIdx]);
        } else {
          idsToDocs.set(id, [[currentDoc, resultsIdx]]);
        }
      });

      // in the case of new_edits, the user can provide multiple docs
      // with the same id. these need to be processed sequentially
      idsToDocs.forEach(function (docs, id) {
        var numDone = 0;

        function docWritten() {
          checkDoneWritingDocs();
          if (++numDone < docs.length) {
            nextDoc();
          }
        }
        function nextDoc() {
          var value = docs[numDone];
          var currentDoc = value[0];
          var resultsIdx = value[1];

          if (fetchedDocs.has(id)) {
            updateDoc(fetchedDocs.get(id), currentDoc, resultsIdx, docWritten);
          } else {
            insertDoc(currentDoc, resultsIdx, docWritten);
          }
        }
        nextDoc();
      });
    }

    function fetchExistingDocs(callback) {
      if (!docInfos.length) {
        return callback();
      }

      var numFetched = 0;

      function checkDone() {
        if (++numFetched === docInfos.length) {
          callback();
        }
      }

      docInfos.forEach(function (docInfo) {
        if (docInfo._id && utils.isLocalId(docInfo._id)) {
          return checkDone(); // skip local docs
        }
        var id = docInfo.metadata.id;
        var req = txn.objectStore(DOC_STORE).get(id);
        req.onsuccess = function process_docRead(event) {
          var metadata = decodeMetadata(event.target.result);
          if (metadata) {
            fetchedDocs.set(id, metadata);
          }
          checkDone();
        };
      });
    }

    function complete() {
      if (preconditionErrored) {
        return;
      }
      var aresults = results.map(function (result) {
        if (result._bulk_seq) {
          delete result._bulk_seq;
        } else if (!Object.keys(result).length) {
          return {
            ok: true
          };
        }
        if (result.error) {
          return result;
        }

        var metadata = result.metadata;
        var rev = merge.winningRev(metadata);

        return {
          ok: true,
          id: metadata.id,
          rev: rev
        };
      });
      IdbPouch.Changes.notify(name);
      docCount = -1; // invalidate
      callback(null, aresults);
    }

    function preprocessAttachment(att, finish) {
      if (att.stub) {
        return finish();
      }
      if (typeof att.data === 'string') {
        var data;
        try {
          data = atob(att.data);
        } catch (e) {
          var err = errors.error(errors.BAD_ARG,
                                "Attachments need to be base64 encoded");
          return callback(err);
        }
        var length;
        if (blobSupport) {
          var type = att.content_type;
          data = utils.fixBinary(data);
          length = data.byteLength;
          att.data = utils.createBlob([data], {type: type});
        } else {
          length = data.length;
        }
        utils.MD5(data).then(function (result) {
          att.digest = 'md5-' + result;
          att.length = length;
          finish();
        });
        return;
      }
      var reader = new FileReader();
      reader.onloadend = function (e) {
        var binary = utils.arrayBufferToBinaryString(this.result || '');
        if (!blobSupport) {
          att.data = btoa(binary);
        }
        utils.MD5(binary).then(function (result) {
          att.digest = 'md5-' + result;
          att.length = binary.length;
          finish();
        });
      };
      reader.readAsArrayBuffer(att.data);
    }

    function verifyAttachment(digest, callback) {
      var req = txn.objectStore([ATTACH_STORE]).get(digest);
      req.onsuccess = function (e) {
        if (!e.target.result) {
          var err = new Error('unknown stub attachment with digest ' + digest);
          err.status = 412;
          callback(err);
        } else {
          callback();
        }
      };
    }

    function verifyAttachments(finish) {
      var digests = [];
      docInfos.forEach(function (docInfo) {
        if (docInfo.data && docInfo.data._attachments) {
          Object.keys(docInfo.data._attachments).forEach(function (filename) {
            var att = docInfo.data._attachments[filename];
            if (att.stub) {
              digests.push(att.digest);
            }
          });
        }
      });
      if (!digests.length) {
        return finish();
      }
      var numDone = 0;
      var err;

      function checkDone() {
        if (++numDone === digests.length) {
          finish(err);
        }
      }
      digests.forEach(function (digest) {
        verifyAttachment(digest, function (attErr) {
          if (attErr && !err) {
            err = attErr;
          }
          checkDone();
        });
      });
    }

    function preprocessAttachments(callback) {
      if (!docInfos.length) {
        return callback();
      }

      var docv = 0;
      docInfos.forEach(function (docInfo) {
        var attachments = docInfo.data && docInfo.data._attachments ?
          Object.keys(docInfo.data._attachments) : [];

        if (!attachments.length) {
          return done();
        }

        var recv = 0;
        function attachmentProcessed() {
          recv++;
          if (recv === attachments.length) {
            done();
          }
        }

        for (var key in docInfo.data._attachments) {
          if (docInfo.data._attachments.hasOwnProperty(key)) {
            preprocessAttachment(docInfo.data._attachments[key],
                                 attachmentProcessed);
          }
        }
      });

      function done() {
        docv++;
        if (docInfos.length === docv) {
          callback();
        }
      }
    }

    function writeDoc(docInfo, winningRev, deleted, callback, resultsIdx) {
      var err = null;
      var recv = 0;
      docInfo.data._id = docInfo.metadata.id;
      docInfo.data._rev = docInfo.metadata.rev;

      if (deleted) {
        docInfo.data._deleted = true;
      }

      var attachments = docInfo.data._attachments ?
        Object.keys(docInfo.data._attachments) : [];

      function collectResults(attachmentErr) {
        if (!err) {
          if (attachmentErr) {
            err = attachmentErr;
            callback(err);
          } else if (recv === attachments.length) {
            finish();
          }
        }
      }

      function attachmentSaved(err) {
        recv++;
        collectResults(err);
      }

      for (var key in docInfo.data._attachments) {
        if (!docInfo.data._attachments[key].stub) {
          var data = docInfo.data._attachments[key].data;
          delete docInfo.data._attachments[key].data;
          var digest = docInfo.data._attachments[key].digest;
          saveAttachment(docInfo, digest, data, attachmentSaved);
        } else {
          recv++;
          collectResults();
        }
      }

      function finish() {
        updateSeq++;
        docInfo.data._doc_id_rev = docInfo.data._id + "::" + docInfo.data._rev;
        var seqStore = txn.objectStore(BY_SEQ_STORE);
        var index = seqStore.index('_doc_id_rev');

        function afterPut(e) {
          var metadata = docInfo.metadata;
          metadata.seq = e.target.result;
          // Current _rev is calculated from _rev_tree on read
          delete metadata.rev;
          var metadataToStore = encodeMetadata(metadata, winningRev, deleted);
          var metaDataReq = txn.objectStore(DOC_STORE).put(metadataToStore);
          metaDataReq.onsuccess = function () {
            delete metadata.deletedOrLocal;
            delete metadata.winningRev;
            results[resultsIdx] = docInfo;
            fetchedDocs.set(docInfo.metadata.id, docInfo.metadata);
            utils.call(callback);
          };
        }

        var putReq = seqStore.put(docInfo.data);

        putReq.onsuccess = afterPut;
        putReq.onerror = function (e) {
          // ConstraintError, need to update, not put (see #1638 for details)
          e.preventDefault(); // avoid transaction abort
          e.stopPropagation(); // avoid transaction onerror
          var getKeyReq = index.getKey(docInfo.data._doc_id_rev);
          getKeyReq.onsuccess = function (e) {
            var putReq = seqStore.put(docInfo.data, e.target.result);
            updateSeq--; // discount, since it's an update, not a new seq
            putReq.onsuccess = afterPut;
          };
        };
      }

      if (!attachments.length) {
        finish();
      }
    }

    function updateDoc(oldDoc, docInfo, resultsIdx, callback) {

      if (utils.revExists(oldDoc, docInfo.metadata.rev)) {
        results[resultsIdx] = docInfo;
        callback();
        return;
      }

      var merged =
        merge.merge(oldDoc.rev_tree, docInfo.metadata.rev_tree[0], 1000);

      var previouslyDeleted = utils.isDeleted(oldDoc);
      var deleted = utils.isDeleted(docInfo.metadata);
      var inConflict = (previouslyDeleted && deleted && newEdits) ||
        (!previouslyDeleted && newEdits && merged.conflicts !== 'new_leaf') ||
        (previouslyDeleted && !deleted && merged.conflicts === 'new_branch');

      if (inConflict) {
        results[resultsIdx] = makeErr(errors.REV_CONFLICT, docInfo._bulk_seq);
        return callback();
      }

      docInfo.metadata.rev_tree = merged.tree;

      // recalculate
      var winningRev = merge.winningRev(docInfo.metadata);
      deleted = utils.isDeleted(docInfo.metadata, winningRev);

      writeDoc(docInfo, winningRev, deleted, callback, resultsIdx);
    }

    function insertDoc(docInfo, resultsIdx, callback) {
      var winningRev = merge.winningRev(docInfo.metadata);
      var deleted = utils.isDeleted(docInfo.metadata, winningRev);
      // Cant insert new deleted documents
      if ('was_delete' in opts && deleted) {
        results[resultsIdx] = errors.MISSING_DOC;
        return callback();
      }

      writeDoc(docInfo, winningRev, deleted, callback, resultsIdx);
    }

    // Insert sequence number into the error so we can sort later
    function makeErr(err, seq) {
      err._bulk_seq = seq;
      return err;
    }

    function saveAttachment(docInfo, digest, data, callback) {
      var objectStore = txn.objectStore(ATTACH_STORE);
      objectStore.get(digest).onsuccess = function (e) {
        var originalRefs = e.target.result && e.target.result.refs || {};
        var ref = [docInfo.metadata.id, docInfo.metadata.rev].join('@');
        var newAtt = {
          digest: digest,
          body: data,
          refs: originalRefs
        };
        newAtt.refs[ref] = true;
        objectStore.put(newAtt).onsuccess = function (e) {
          utils.call(callback);
        };
      };
    }

    var txn;
    preprocessAttachments(function () {
      var stores = [DOC_STORE, BY_SEQ_STORE, ATTACH_STORE, META_STORE,
        LOCAL_STORE];
      txn = idb.transaction(stores, 'readwrite');
      txn.onerror = idbError(callback);
      txn.ontimeout = idbError(callback);
      txn.oncomplete = complete;

      verifyAttachments(function (err) {
        if (err) {
          preconditionErrored = true;
          return callback(err);
        }
        fetchExistingDocs(processDocs);
      });
    });
  };

  // First we look up the metadata in the ids database, then we fetch the
  // current revision(s) from the by sequence store
  api._get = function idb_get(id, opts, callback) {
    var doc;
    var metadata;
    var err;
    var txn;
    opts = utils.clone(opts);
    if (opts.ctx) {
      txn = opts.ctx;
    } else {
      txn =
        idb.transaction([DOC_STORE, BY_SEQ_STORE, ATTACH_STORE], 'readonly');
    }

    function finish() {
      callback(err, {doc: doc, metadata: metadata, ctx: txn});
    }

    txn.objectStore(DOC_STORE).get(id).onsuccess = function (e) {
      metadata = decodeMetadata(e.target.result);
      // we can determine the result here if:
      // 1. there is no such document
      // 2. the document is deleted and we don't ask about specific rev
      // When we ask with opts.rev we expect the answer to be either
      // doc (possibly with _deleted=true) or missing error
      if (!metadata) {
        err = errors.MISSING_DOC;
        return finish();
      }
      if (utils.isDeleted(metadata) && !opts.rev) {
        err = errors.error(errors.MISSING_DOC, "deleted");
        return finish();
      }
      var objectStore = txn.objectStore(BY_SEQ_STORE);

      // metadata.winningRev was added later, so older DBs might not have it
      var rev = opts.rev || metadata.winningRev || merge.winningRev(metadata);
      var key = metadata.id + '::' + rev;

      objectStore.index('_doc_id_rev').get(key).onsuccess = function (e) {
        doc = e.target.result;
        if (doc && doc._doc_id_rev) {
          delete(doc._doc_id_rev);
        }
        if (!doc) {
          err = errors.MISSING_DOC;
          return finish();
        }
        finish();
      };
    };
  };

  api._getAttachment = function (attachment, opts, callback) {
    var txn;
    opts = utils.clone(opts);
    if (opts.ctx) {
      txn = opts.ctx;
    } else {
      txn =
        idb.transaction([DOC_STORE, BY_SEQ_STORE, ATTACH_STORE], 'readonly');
    }
    var digest = attachment.digest;
    var type = attachment.content_type;

    txn.objectStore(ATTACH_STORE).get(digest).onsuccess = function (e) {
      var data = e.target.result.body;
      if (opts.encode) {
        if (!data) {
          callback(null, '');
        } else if (typeof data !== 'string') { // we have blob support
          var reader = new FileReader();
          reader.onloadend = function (e) {
            var binary = utils.arrayBufferToBinaryString(this.result || '');
            callback(null, btoa(binary));
          };
          reader.readAsArrayBuffer(data);
        } else { // no blob support
          callback(null, data);
        }
      } else {
        if (!data) {
          callback(null, utils.createBlob([''], {type: type}));
        } else if (typeof data !== 'string') { // we have blob support
          callback(null, data);
        } else { // no blob support
          data = utils.fixBinary(atob(data));
          callback(null, utils.createBlob([data], {type: type}));
        }
      }
    };
  };

  function allDocsQuery(totalRows, opts, callback) {
    var start = 'startkey' in opts ? opts.startkey : false;
    var end = 'endkey' in opts ? opts.endkey : false;
    var key = 'key' in opts ? opts.key : false;
    var skip = opts.skip || 0;
    var limit = typeof opts.limit === 'number' ? opts.limit : -1;
    var inclusiveEnd = opts.inclusive_end !== false;
    var descending = 'descending' in opts && opts.descending ? 'prev' : null;

    var manualDescEnd = false;
    if (descending && start && end) {
      // unfortunately IDB has a quirk where IDBKeyRange.bound is invalid if the
      // start is less than the end, even in descending mode.  Best bet
      // is just to handle it manually in that case.
      manualDescEnd = end;
      end = false;
    }

    var keyRange = null;
    try {
      if (start && end) {
        keyRange = global.IDBKeyRange.bound(start, end, false, !inclusiveEnd);
      } else if (start) {
        if (descending) {
          keyRange = global.IDBKeyRange.upperBound(start);
        } else {
          keyRange = global.IDBKeyRange.lowerBound(start);
        }
      } else if (end) {
        if (descending) {
          keyRange = global.IDBKeyRange.lowerBound(end, !inclusiveEnd);
        } else {
          keyRange = global.IDBKeyRange.upperBound(end, !inclusiveEnd);
        }
      } else if (key) {
        keyRange = global.IDBKeyRange.only(key);
      }
    } catch (e) {
      if (e.name === "DataError" && e.code === 0) {
        // data error, start is less than end
        return callback(null, {
          total_rows : totalRows,
          offset : opts.skip,
          rows : []
        });
      } else {
        return callback(errors.error(errors.IDB_ERROR, e.name, e.message));
      }
    }

    var transaction = idb.transaction([DOC_STORE, BY_SEQ_STORE], 'readonly');
    transaction.oncomplete = function () {
      callback(null, {
        total_rows: totalRows,
        offset: opts.skip,
        rows: results
      });
    };

    var oStore = transaction.objectStore(DOC_STORE);
    var oCursor = descending ? oStore.openCursor(keyRange, descending)
      : oStore.openCursor(keyRange);
    var results = [];
    oCursor.onsuccess = function (e) {
      if (!e.target.result) {
        return;
      }
      var cursor = e.target.result;
      var metadata = decodeMetadata(cursor.value);
      // metadata.winningRev added later, some dbs might be missing it
      var winningRev = metadata.winningRev || merge.winningRev(metadata);

      function allDocsInner(metadata, data) {
        var doc = {
          id: metadata.id,
          key: metadata.id,
          value: {
            rev: winningRev
          }
        };
        if (opts.include_docs) {
          doc.doc = data;
          doc.doc._rev = winningRev;
          if (doc.doc._doc_id_rev) {
            delete(doc.doc._doc_id_rev);
          }
          if (opts.conflicts) {
            doc.doc._conflicts = merge.collectConflicts(metadata);
          }
          for (var att in doc.doc._attachments) {
            if (doc.doc._attachments.hasOwnProperty(att)) {
              doc.doc._attachments[att].stub = true;
            }
          }
        }
        var deleted = utils.isDeleted(metadata, winningRev);
        if (opts.deleted === 'ok') {
          // deleted docs are okay with keys_requests
          if (deleted) {
            doc.value.deleted = true;
            doc.doc = null;
          }
          results.push(doc);
        } else if (!deleted && skip-- <= 0) {
          if (manualDescEnd) {
            if (inclusiveEnd && doc.key < manualDescEnd) {
              return;
            } else if (!inclusiveEnd && doc.key <= manualDescEnd) {
              return;
            }
          }
          results.push(doc);
          if (--limit === 0) {
            return;
          }
        }
        cursor.continue();
      }

      if (!opts.include_docs) {
        allDocsInner(metadata);
      } else {
        var index = transaction.objectStore(BY_SEQ_STORE).index('_doc_id_rev');
        var key = metadata.id + "::" + winningRev;
        index.get(key).onsuccess = function (event) {
          allDocsInner(decodeMetadata(cursor.value), event.target.result);
        };
      }
    };
  }

  function countDocs(callback) {
    if (docCount !== -1) {
      return callback(null, docCount);
    }

    var count;
    var txn = idb.transaction([DOC_STORE], 'readonly');
    var index = txn.objectStore(DOC_STORE).index('deletedOrLocal');
    index.count(global.IDBKeyRange.only("0")).onsuccess = function (e) {
      count = e.target.result;
    };
    txn.onerror = idbError(callback);
    txn.oncomplete = function () {
      docCount = count;
      callback(null, docCount);
    };
  }

  api._allDocs = function idb_allDocs(opts, callback) {

    // first count the total_rows
    countDocs(function (err, totalRows) {
      if (err) {
        return callback(err);
      }
      if (opts.limit === 0) {
        return callback(null, {
          total_rows : totalRows,
          offset : opts.skip,
          rows : []
        });
      }
      allDocsQuery(totalRows, opts, callback);
    });
  };

  api._info = function idb_info(callback) {

    countDocs(function (err, count) {
      if (err) {
        return callback(err);
      }
      if (idb === null) {
        var error = new Error('db isn\'t open');
        error.id = 'idbNull';
        return callback(error);
      }
      var updateSeq = 0;
      var txn = idb.transaction([META_STORE], 'readonly');

      txn.objectStore(META_STORE).get(META_STORE).onsuccess = function (e) {
        updateSeq = e.target.result && e.target.result.updateSeq || 0;
      };

      txn.oncomplete = function () {
        callback(null, {
          doc_count: count,
          update_seq: updateSeq
        });
      };
    });
  };

  api._changes = function (opts) {
    opts = utils.clone(opts);

    if (opts.continuous) {
      var id = name + ':' + utils.uuid();
      IdbPouch.Changes.addListener(name, id, api, opts);
      IdbPouch.Changes.notify(name);
      return {
        cancel: function () {
          IdbPouch.Changes.removeListener(name, id);
        }
      };
    }

    var descending = opts.descending ? 'prev' : null;
    var lastSeq = 0;

    // Ignore the `since` parameter when `descending` is true
    opts.since = opts.since && !descending ? opts.since : 0;

    var limit = 'limit' in opts ? opts.limit : -1;
    if (limit === 0) {
      limit = 1; // per CouchDB _changes spec
    }
    var returnDocs;
    if ('returnDocs' in opts) {
      returnDocs = opts.returnDocs;
    } else {
      returnDocs = true;
    }

    var results = [];
    var numResults = 0;
    var filter = utils.filterChange(opts);

    var txn;

    function fetchChanges() {
      txn = idb.transaction([DOC_STORE, BY_SEQ_STORE], 'readonly');
      txn.oncomplete = onTxnComplete;

      var req;

      if (descending) {
        req = txn.objectStore(BY_SEQ_STORE)
            .openCursor(global.IDBKeyRange.lowerBound(opts.since, true),
                        descending);
      } else {
        req = txn.objectStore(BY_SEQ_STORE)
            .openCursor(global.IDBKeyRange.lowerBound(opts.since, true));
      }

      req.onsuccess = onsuccess;
      req.onerror = onerror;
    }

    fetchChanges();

    function onsuccess(event) {
      var cursor = event.target.result;

      if (!cursor) {
        return;
      }

      var doc = cursor.value;

      if (opts.doc_ids && opts.doc_ids.indexOf(doc._id) === -1) {
        return cursor.continue();
      }

      var index = txn.objectStore(DOC_STORE);
      index.get(doc._id).onsuccess = function (event) {
        var metadata = decodeMetadata(event.target.result);

        if (lastSeq < metadata.seq) {
          lastSeq = metadata.seq;
        }
        // metadata.winningRev was only added later
        var winningRev = metadata.winningRev || merge.winningRev(metadata);
        if (doc._rev !== winningRev) {
          return cursor.continue();
        }

        delete doc['_doc_id_rev'];

        var change = opts.processChange(doc, metadata, opts);
        change.seq = cursor.key;
        if (filter(change)) {
          numResults++;
          if (returnDocs) {
            results.push(change);
          }
          opts.onChange(change);
        }
        if (numResults !== limit) {
          cursor.continue();
        }
      };
    }

    function onTxnComplete() {
      if (!opts.continuous) {
        opts.complete(null, {
          results: results,
          last_seq: lastSeq
        });
      }
    }
  };

  api._close = function (callback) {
    if (idb === null) {
      return callback(errors.NOT_OPEN);
    }

    // https://developer.mozilla.org/en-US/docs/IndexedDB/IDBDatabase#close
    // "Returns immediately and closes the connection in a separate thread..."
    idb.close();
    delete cachedDBs[name];
    idb = null;
    callback();
  };

  api._getRevisionTree = function (docId, callback) {
    var txn = idb.transaction([DOC_STORE], 'readonly');
    var req = txn.objectStore(DOC_STORE).get(docId);
    req.onsuccess = function (event) {
      var doc = decodeMetadata(event.target.result);
      if (!doc) {
        callback(errors.MISSING_DOC);
      } else {
        callback(null, doc.rev_tree);
      }
    };
  };

  // This function removes revisions of document docId
  // which are listed in revs and sets this document
  // revision to to rev_tree
  api._doCompaction = function (docId, rev_tree, revs, callback) {
    var txn = idb.transaction([DOC_STORE, BY_SEQ_STORE], 'readwrite');

    var index = txn.objectStore(DOC_STORE);
    index.get(docId).onsuccess = function (event) {
      var metadata = decodeMetadata(event.target.result);
      metadata.rev_tree = rev_tree;

      var count = revs.length;
      revs.forEach(function (rev) {
        var index = txn.objectStore(BY_SEQ_STORE).index('_doc_id_rev');
        var key = docId + "::" + rev;
        index.getKey(key).onsuccess = function (e) {
          var seq = e.target.result;
          if (!seq) {
            return;
          }
          txn.objectStore(BY_SEQ_STORE).delete(seq);

          count--;
          if (!count) {
            // winningRev is not guaranteed to be there, since it's
            // not formally migrated. deletedOrLocal is a
            // now-unfortunate name that really just means "deleted"
            var winningRev = metadata.winningRev ||
              merge.winningRev(metadata);
            var deleted = metadata.deletedOrLocal;
            txn.objectStore(DOC_STORE).put(
              encodeMetadata(metadata, winningRev, deleted));
          }
        };
      });
    };
    txn.oncomplete = function () {
      utils.call(callback);
    };
  };


  api._getLocal = function (id, callback) {
    var tx = idb.transaction([LOCAL_STORE], 'readonly');
    var req = tx.objectStore(LOCAL_STORE).get(id);

    req.onerror = idbError(callback);
    req.onsuccess = function (e) {
      var doc = e.target.result;
      if (!doc) {
        callback(errors.MISSING_DOC);
      } else {
        delete doc['_doc_id_rev'];
        callback(null, doc);
      }
    };
  };

  api._putLocal = function (doc, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    delete doc._revisions; // ignore this, trust the rev
    var oldRev = doc._rev;
    var id = doc._id;
    if (!oldRev) {
      doc._rev = '0-1';
    } else {
      doc._rev = '0-' + (parseInt(oldRev.split('-')[1], 10) + 1);
    }
    doc._doc_id_rev = id + '::' + doc._rev;

    var tx = opts.ctx;
    var ret;
    if (!tx) {
      tx = idb.transaction([LOCAL_STORE], 'readwrite');
      tx.onerror = idbError(callback);
      tx.oncomplete = function () {
        if (ret) {
          callback(null, ret);
        }
      };
    }

    var oStore = tx.objectStore(LOCAL_STORE);
    var req;
    if (oldRev) {
      var index = oStore.index('_doc_id_rev');
      var docIdRev = id + '::' + oldRev;
      req = index.get(docIdRev);
      req.onsuccess = function (e) {
        if (!e.target.result) {
          callback(errors.REV_CONFLICT);
        } else { // update
          var req = oStore.put(doc);
          req.onsuccess = function () {
            ret = {ok: true, id: doc._id, rev: doc._rev};
            if (opts.ctx) { // retuthis.immediately
              callback(null, ret);
            }
          };
        }
      };
    } else { // new doc
      req = oStore.get(id);
      req.onsuccess = function (e) {
        if (e.target.result) { // already exists
          callback(errors.REV_CONFLICT);
        } else { // insert
          var req = oStore.put(doc);
          req.onsuccess = function () {
            ret = {ok: true, id: doc._id, rev: doc._rev};
            if (opts.ctx) { // return immediately
              callback(null, ret);
            }
          };
        }
      };
    }
  };

  api._removeLocal = function (doc, callback) {
    var tx = idb.transaction([LOCAL_STORE], 'readwrite');
    var ret;
    tx.oncomplete = function () {
      if (ret) {
        callback(null, ret);
      }
    };
    var docIdRev = doc._id + '::' + doc._rev;
    var oStore = tx.objectStore(LOCAL_STORE);
    var index = oStore.index('_doc_id_rev');
    var req = index.get(docIdRev);

    req.onerror = idbError(callback);
    req.onsuccess = function (e) {
      var doc = e.target.result;
      if (!doc) {
        callback(errors.MISSING_DOC);
      } else {
        var req = index.getKey(docIdRev);
        req.onsuccess = function (e) {
          var key = e.target.result;
          oStore.delete(key);
          ret = {ok: true, id: doc._id, rev: '0-0'};
        };
      }
    };
  };

  var cached = cachedDBs[name];

  if (cached) {
    idb = cached.idb;
    blobSupport = cached.blobSupport;
    instanceId = cached.instanceId;
    idStored = cached.idStored;
    process.nextTick(function () {
      callback(null, api);
    });
    return;
  }

  var req = global.indexedDB.open(name, ADAPTER_VERSION);

  if (!('openReqList' in IdbPouch)) {
    IdbPouch.openReqList = {};
  }
  IdbPouch.openReqList[name] = req;

  req.onupgradeneeded = function (e) {
    var db = e.target.result;
    if (e.oldVersion < 1) {
      // initial schema
      createSchema(db);
    }
    if (e.oldVersion < 3) {
      createLocalStoreSchema(db);
      if (e.oldVersion < 2) {
        // version 2 adds the deletedOrLocal index
        addDeletedOrLocalIndex(e, function (transaction) {
          migrateLocalStore(e, transaction);
        });
      } else {
        migrateLocalStore(e);
      }
    }
  };

  req.onsuccess = function (e) {

    idb = e.target.result;

    idb.onversionchange = function () {
      idb.close();
      delete cachedDBs[name];
    };
    idb.onabort = function () {
      idb.close();
      delete cachedDBs[name];
    };

    var txn = idb.transaction([META_STORE, DETECT_BLOB_SUPPORT_STORE],
      'readwrite');

    var req = txn.objectStore(META_STORE).get(META_STORE);

    req.onsuccess = function (e) {

      var checkSetupComplete = function () {
        if (blobSupport === null || !idStored) {
          return;
        } else {
          cachedDBs[name] = {
            idb: idb,
            blobSupport: blobSupport,
            instanceId: instanceId,
            idStored: idStored,
            loaded: true
          };
          callback(null, api);
        }
      };

      var meta = e.target.result || {id: META_STORE};
      if (name  + '_id' in meta) {
        instanceId = meta[name + '_id'];
        idStored = true;
        checkSetupComplete();
      } else {
        instanceId = utils.uuid();
        meta[name + '_id'] = instanceId;
        txn.objectStore(META_STORE).put(meta).onsuccess = function () {
          idStored = true;
          checkSetupComplete();
        };
      }

      // Detect blob support. Chrome didn't support it until version 38.
      // in version 37 they had a broken version where PNGs (and possibly
      // other binary types) aren't stored correctly.
      try {
        var blob = utils.createBlob([''], {type: 'image/png'});
        txn.objectStore(DETECT_BLOB_SUPPORT_STORE).put(blob, 'key');
        txn.oncomplete = function () {
          // have to do it in a separate transaction, else the correct
          // content type is always returned
          txn = idb.transaction([META_STORE, DETECT_BLOB_SUPPORT_STORE],
            'readwrite');
          var getBlobReq = txn.objectStore(
            DETECT_BLOB_SUPPORT_STORE).get('key');
          getBlobReq.onsuccess = function (e) {
            var storedBlob = e.target.result;
            var url = URL.createObjectURL(storedBlob);
            utils.ajax({
              url: url,
              cache: true,
              binary: true
            }, function (err, res) {
              if (err && err.status === 405) {
                // firefox won't let us do that. but firefox doesn't
                // have the blob type bug that Chrome does, so that's ok
                blobSupport = true;
              } else {
                blobSupport = !!(res && res.type === 'image/png');
                if (err && err.status === 404) {
                  utils.explain404(
                    'PouchDB is just detecting blob URL support.');
                }
              }
              checkSetupComplete();
            });
          };
        };
      } catch (err) {
        blobSupport = false;
        checkSetupComplete();
      }
    };
  };

  req.onerror = idbError(callback);

}

IdbPouch.valid = function () {
  // Issue #2533, we finally gave up on doing bug
  // detection instead of browser sniffing. Safari brought us
  // to our knees.
  var isSafari = typeof openDatabase !== 'undefined' &&
    /Safari/.test(navigator.userAgent) &&
    !/Chrome/.test(navigator.userAgent);

  // some outdated implementations of IDB that appear on Samsung
  // and HTC Android devices <4.4 are missing IDBKeyRange
  return !isSafari && global.indexedDB && global.IDBKeyRange;
};

function destroy(name, opts, callback) {
  if (!('openReqList' in IdbPouch)) {
    IdbPouch.openReqList = {};
  }
  IdbPouch.Changes.removeAllListeners(name);

  //Close open request for "name" database to fix ie delay.
  if (IdbPouch.openReqList[name] && IdbPouch.openReqList[name].result) {
    IdbPouch.openReqList[name].result.close();
  }
  var req = global.indexedDB.deleteDatabase(name);

  req.onsuccess = function () {
    //Remove open request from the list.
    if (IdbPouch.openReqList[name]) {
      IdbPouch.openReqList[name] = null;
    }
    if (utils.hasLocalStorage() && (name in global.localStorage)) {
      delete global.localStorage[name];
    }
    delete cachedDBs[name];
    callback(null, { 'ok': true });
  };

  req.onerror = idbError(callback);
}

IdbPouch.destroy = utils.toPromise(function (name, opts, callback) {
  taskQueue.queue.push({
    action: function (thisCallback) {
      destroy(name, opts, thisCallback);
    },
    callback: callback
  });
  applyNext();
});

IdbPouch.Changes = new utils.Changes();

module.exports = IdbPouch;
