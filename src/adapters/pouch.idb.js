/*globals call: false, extend: false, parseDoc: false, Crypto: false */
/*globals isLocalId: false, isDeleted: false, collectConflicts: false */
/*globals collectLeaves: false, Changes: false */

'use strict';

// While most of the IDB behaviors match between implementations a
// lot of the names still differ. This section tries to normalize the
// different objects & methods.
var indexedDB = window.indexedDB ||
  window.mozIndexedDB ||
  window.webkitIndexedDB;

// still needed for R/W transactions in Android Chrome. follow MDN example:
// https://developer.mozilla.org/en-US/docs/IndexedDB/IDBDatabase#transaction
// note though that Chrome Canary fails on undefined READ_WRITE constants
// on the native IDBTransaction object
var IDBTransaction = (window.IDBTransaction && window.IDBTransaction.READ_WRITE) ?
  window.IDBTransaction :
  (window.webkitIDBTransaction && window.webkitIDBTransaction.READ_WRITE) ?
    window.webkitIDBTransaction :
    { READ_WRITE: 'readwrite' };

var IDBKeyRange = window.IDBKeyRange ||
  window.webkitIDBKeyRange;

window.storageInfo = window.storageInfo ||
  window.webkitStorageInfo;

window.requestFileSystem = window.requestFileSystem ||
    window.webkitRequestFileSystem;

var idbError = function(callback) {
  return function(event) {
    call(callback, {
      status: 500,
      error: event.type,
      reason: event.target
    });
  };
};

var IdbPouch = function(opts, callback) {

  // IndexedDB requires a versioned database structure, this is going to make
  // it hard to dynamically create object stores if we needed to for things
  // like views
  var POUCH_VERSION = 1;

  // The object stores created for each database
  // DOC_STORE stores the document meta data, its revision history and state
  var DOC_STORE = 'document-store';
  // BY_SEQ_STORE stores a particular version of a document, keyed by its
  // sequence id
  var BY_SEQ_STORE = 'by-sequence';
  // Where we store attachments
  var ATTACH_STORE = 'attach-store';
  // Where we store meta data
  var META_STORE = 'meta-store';
  // Where we detect blob support
  var DETECT_BLOB_SUPPORT_STORE = 'detect-blob-support';


  var name = opts.name;
  var req = indexedDB.open(name, POUCH_VERSION);
  var meta = {
    id: 'meta-store',
    updateSeq: 0
  };

  var blobSupport = null;

  var instanceId = null;
  var api = {};
  var idb = null;

  if (Pouch.DEBUG) {
    console.log(name + ': Open Database');
  }

  // TODO: before we release, make sure we write upgrade needed
  // in a way that supports a future upgrade path
  req.onupgradeneeded = function(e) {
    var db = e.target.result;
    db.createObjectStore(DOC_STORE, {keyPath : 'id'})
      .createIndex('seq', 'seq', {unique: true});
    db.createObjectStore(BY_SEQ_STORE, {autoIncrement : true})
      .createIndex('_doc_id_rev', '_doc_id_rev', {unique: true});
    db.createObjectStore(ATTACH_STORE, {keyPath: 'digest'});
    db.createObjectStore(META_STORE, {keyPath: 'id', autoIncrement: false});
    db.createObjectStore(DETECT_BLOB_SUPPORT_STORE);
  };

  req.onsuccess = function(e) {

    idb = e.target.result;

    var txn = idb.transaction([META_STORE, DETECT_BLOB_SUPPORT_STORE],
                              IDBTransaction.READ_WRITE);

    idb.onversionchange = function() {
      idb.close();
    };

    // polyfill the new onupgradeneeded api for chrome. can get rid of when
    // saucelabs moves to chrome 23
    if (idb.setVersion && Number(idb.version) !== POUCH_VERSION) {
      var versionReq = idb.setVersion(POUCH_VERSION);
      versionReq.onsuccess = function(evt) {
        function setVersionComplete() {
          req.onsuccess(e);
        }
        evt.target.result.oncomplete = setVersionComplete;
        req.onupgradeneeded(e);
      };
      return;
    }

    var req = txn.objectStore(META_STORE).get('meta-store');

    req.onsuccess = function(e) {
      var reqDBId,
          result;

      if (e.target.result) {
        meta = e.target.result;
      }

      if (name + '_id' in meta) {
        instanceId = meta[name + '_id'];
      } else {
        instanceId = Math.uuid();

        meta[name + '_id'] = instanceId;
        reqDBId = txn.objectStore(META_STORE).put(meta);
      }

      // detect blob support
      try {
        txn.objectStore(DETECT_BLOB_SUPPORT_STORE).put(new Blob(), "key");
        blobSupport = true;
      } catch (err) {
        blobSupport = false;
      } finally {
        call(callback, null, api);
      }
    };
  };

  req.onerror = idbError(callback);

  api.type = function() {
    return 'idb';
  };

  // Each database needs a unique id so that we can store the sequence
  // checkpoint without having other databases confuse itself.
  api.id = function idb_id() {
    return instanceId;
  };

  api._bulkDocs = function idb_bulkDocs(req, opts, callback) {

    var newEdits = opts.new_edits;
    var userDocs = req.docs;

    // Parse the docs, give them a sequence number for the result
    var docInfos = userDocs.map(function(doc, i) {
      var newDoc = parseDoc(doc, newEdits);
      newDoc._bulk_seq = i;
      if (doc._deleted) {
        if (!newDoc.metadata.deletions) {
          newDoc.metadata.deletions = {};
        }
        newDoc.metadata.deletions[doc._rev.split('-')[1]] = true;
      }
      return newDoc;
    });

    var docInfoErrors = docInfos.filter(function(docInfo) {
      return docInfo.error;
    });
    if (docInfoErrors.length) {
      return call(callback, docInfoErrors[0]);
    }

    var results = [];
    var docs = [];

    // Group multiple edits to the same document
    docInfos.forEach(function(docInfo) {
      if (docInfo.error) {
        return results.push(docInfo);
      }
      if (!docs.length || !newEdits || docInfo.metadata.id !== docs[0].metadata.id) {
        return docs.unshift(docInfo);
      }
      // We mark subsequent bulk docs with a duplicate id as conflicts
      results.push(makeErr(Pouch.Errors.REV_CONFLICT, docInfo._bulk_seq));
    });

    function processDocs() {
      if (!docs.length) {
        return;
      }
      var currentDoc = docs.shift();
      var req = txn.objectStore(DOC_STORE).get(currentDoc.metadata.id);
      req.onsuccess = function process_docRead(event) {
        var oldDoc = event.target.result;
        if (!oldDoc) {
          insertDoc(currentDoc);
        } else {
          updateDoc(oldDoc, currentDoc);
        }
      };
    }

    function complete(event) {
      var aresults = [];
      results.sort(sortByBulkSeq);
      results.forEach(function(result) {
        delete result._bulk_seq;
        if (result.error) {
          aresults.push(result);
          return;
        }
        var metadata = result.metadata;
        var rev = Pouch.merge.winningRev(metadata);

        aresults.push({
          ok: true,
          id: metadata.id,
          rev: rev
        });

        if (isLocalId(metadata.id)) {
          return;
        }

        IdbPouch.Changes.notify(name);
        IdbPouch.Changes.notifyLocalWindows(name);
      });
      call(callback, null, aresults);
    }

    function preprocessAttachment(att, callback) {
      if (att.stub) {
        return callback();
      }
      if (typeof att.data === 'string') {
        var data = atob(att.data);
        att.digest = 'md5-' + Crypto.MD5(data);
        if (blobSupport) {
          var type = att.content_type;
          att.data = new Blob([data], {type: type});
        }
        return callback();
      }
      var reader = new FileReader();
      reader.onloadend = function(e) {
        att.digest = 'md5-' + Crypto.MD5(this.result);
        if (!blobSupport) {
          att.data = btoa(this.result);
        }
        callback();
      };
      reader.readAsBinaryString(att.data);
    }

    function preprocessAttachments(callback) {
      if (!docInfos.length) {
        return callback();
      }

      var docv = 0;
      docInfos.forEach(function(docInfo) {
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
          preprocessAttachment(docInfo.data._attachments[key], attachmentProcessed);
        }
      });

      function done() {
        docv++;
        if (docInfos.length === docv) {
          callback();
        }
      }
    }

    function writeDoc(docInfo, callback) {
      var err = null;
      var recv = 0;

      docInfo.data._id = docInfo.metadata.id;
      docInfo.data._rev = docInfo.metadata.rev;

      meta.updateSeq++;
      var req = txn.objectStore(META_STORE).put(meta);

      if (isDeleted(docInfo.metadata, docInfo.metadata.rev)) {
        docInfo.data._deleted = true;
      }

      var attachments = docInfo.data._attachments ?
        Object.keys(docInfo.data._attachments) : [];

      function collectResults(attachmentErr) {
        if (!err) {
          if (attachmentErr) {
            err = attachmentErr;
            call(callback, err);
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
        docInfo.data._doc_id_rev = docInfo.data._id + "::" + docInfo.data._rev;
        var dataReq = txn.objectStore(BY_SEQ_STORE).put(docInfo.data);
        dataReq.onsuccess = function(e) {
          if (Pouch.DEBUG) {
            console.log(name + ': Wrote Document ', docInfo.metadata.id);
          }
          docInfo.metadata.seq = e.target.result;
          // Current _rev is calculated from _rev_tree on read
          delete docInfo.metadata.rev;
          var metaDataReq = txn.objectStore(DOC_STORE).put(docInfo.metadata);
          metaDataReq.onsuccess = function() {
            results.push(docInfo);
            call(callback);
          };
        };
      }

      if (!attachments.length) {
        finish();
      }
    }

    function updateDoc(oldDoc, docInfo) {
      docInfo.metadata.deletions = extend(docInfo.metadata.deletions, oldDoc.deletions);

      var merged = Pouch.merge(oldDoc.rev_tree, docInfo.metadata.rev_tree[0], 1000);

      var inConflict = (isDeleted(oldDoc) && isDeleted(docInfo.metadata)) ||
        (!isDeleted(oldDoc) && newEdits && merged.conflicts !== 'new_leaf');

      if (inConflict) {
        results.push(makeErr(Pouch.Errors.REV_CONFLICT, docInfo._bulk_seq));
        return processDocs();
      }

      docInfo.metadata.rev_tree = merged.tree;
      writeDoc(docInfo, processDocs);
    }

    function insertDoc(docInfo) {
      // Cant insert new deleted documents
      if ('was_delete' in opts && isDeleted(docInfo.metadata)) {
        results.push(Pouch.Errors.MISSING_DOC);
        return processDocs();
      }
      writeDoc(docInfo, processDocs);
    }

    // Insert sequence number into the error so we can sort later
    function makeErr(err, seq) {
      err._bulk_seq = seq;
      return err;
    }

    function saveAttachment(docInfo, digest, data, callback) {
      var objectStore = txn.objectStore(ATTACH_STORE);
      var getReq = objectStore.get(digest).onsuccess = function(e) {
        var originalRefs = e.target.result && e.target.result.refs || {};
        var ref = [docInfo.metadata.id, docInfo.metadata.rev].join('@');
        var newAtt = {
          digest: digest,
          body: data,
          refs: originalRefs
        };
        newAtt.refs[ref] = true;
        var putReq = objectStore.put(newAtt).onsuccess = function(e) {
          call(callback);
        };
      };
    }

    var txn;
    preprocessAttachments(function() {
      txn = idb.transaction([DOC_STORE, BY_SEQ_STORE, ATTACH_STORE, META_STORE],
                            IDBTransaction.READ_WRITE);
      txn.onerror = idbError(callback);
      txn.ontimeout = idbError(callback);
      txn.oncomplete = complete;

      processDocs();
    });
  };

  function sortByBulkSeq(a, b) {
    return a._bulk_seq - b._bulk_seq;
  }

  // First we look up the metadata in the ids database, then we fetch the
  // current revision(s) from the by sequence store
  api._get = function idb_get(id, opts, callback) {
    var result;
    var metadata;
    var txn = idb.transaction([DOC_STORE, BY_SEQ_STORE, ATTACH_STORE], 'readonly');
    txn.oncomplete = function() {
      call(callback, result, metadata);
    };

    txn.objectStore(DOC_STORE).get(id.docId).onsuccess = function(e) {
      metadata = e.target.result;
      // we can determine the result here if:
      // 1. there is no such document
      // 2. the document is deleted and we don't ask about specific rev
      // When we ask with opts.rev we expect the answer to be either
      // doc (possibly with _deleted=true) or missing error
      if (!metadata) {
        result = Pouch.Errors.MISSING_DOC;
        return;
      }
      if (isDeleted(metadata) && !opts.rev) {
        result = Pouch.error(Pouch.Errors.MISSING_DOC, "deleted");
        return;
      }

      var rev = Pouch.merge.winningRev(metadata);
      var key = metadata.id + '::' + (opts.rev ? opts.rev : rev);
      var index = txn.objectStore(BY_SEQ_STORE).index('_doc_id_rev');

      index.get(key).onsuccess = function(e) {
        var doc = e.target.result;
        if(doc && doc._doc_id_rev) {
          delete(doc._doc_id_rev);
        }
        if (!doc) {
          result = Pouch.Errors.MISSING_DOC;
          return;
        }
        if (opts.attachments && doc._attachments) {
          var attachments = Object.keys(doc._attachments);
          var recv = 0;

          attachments.forEach(function(key) {
            api.getAttachment(doc._id + '/' + key, {encode: true, txn: txn}, function(err, data) {
              doc._attachments[key].data = data;

              if (++recv === attachments.length) {
                result = doc;
              }
            });
          });
        } else {
          if (doc._attachments){
            for (var key in doc._attachments) {
              doc._attachments[key].stub = true;
            }
          }
          result = doc;
        }
      };
    };
  };

  api._getAttachment = function(id, opts, callback) {
    var result;
    var txn;

    // This can be called while we are in a current transaction, pass the context
    // along and dont wait for the transaction to complete here.
    if ('txn' in opts) {
      txn = opts.txn;
    } else {
      txn = idb.transaction([DOC_STORE, BY_SEQ_STORE, ATTACH_STORE], 'readonly');
      txn.oncomplete = function() { call(callback, null, result); };
    }

    txn.objectStore(DOC_STORE).get(id.docId).onsuccess = function(e) {
      var metadata = e.target.result;
      var bySeq = txn.objectStore(BY_SEQ_STORE);
      bySeq.get(metadata.seq).onsuccess = function(e) {
        var attachment = e.target.result._attachments[id.attachmentId];
        var digest = attachment.digest;
        var type = attachment.content_type;

        txn.objectStore(ATTACH_STORE).get(digest).onsuccess = function(e) {
          var data = e.target.result.body;
          if (opts.encode) {
            if (blobSupport) {
              var reader = new FileReader();
              reader.onloadend = function(e) {
                result = btoa(this.result);

                if ('txn' in opts) {
                  call(callback, null, result);
                }
              };
              reader.readAsBinaryString(data);
            } else {
              result = data;

              if ('txn' in opts) {
                call(callback, null, result);
              }
            }
          } else {
            if (blobSupport) {
              result = data;
            } else {
              result = new Blob([atob(data)], {type: type});
            }
            if ('txn' in opts) {
              call(callback, null, result);
            }
          }
        };
      };
    };
    return;
  };

  api._allDocs = function idb_allDocs(opts, callback) {
    var start = 'startkey' in opts ? opts.startkey : false;
    var end = 'endkey' in opts ? opts.endkey : false;

    var descending = 'descending' in opts ? opts.descending : false;
    descending = descending ? 'prev' : null;

    var keyRange = start && end ? IDBKeyRange.bound(start, end)
      : start ? IDBKeyRange.lowerBound(start)
      : end ? IDBKeyRange.upperBound(end) : null;

    var transaction = idb.transaction([DOC_STORE, BY_SEQ_STORE], 'readonly');
    transaction.oncomplete = function() {
      if ('keys' in opts) {
        opts.keys.forEach(function(key) {
          if (key in resultsMap) {
            results.push(resultsMap[key]);
          } else {
            results.push({"key": key, "error": "not_found"});
          }
        });
        if (opts.descending) {
          results.reverse();
        }
      }
      call(callback, null, {
        total_rows: results.length,
        rows: results
      });
    };

    var oStore = transaction.objectStore(DOC_STORE);
    var oCursor = descending ? oStore.openCursor(keyRange, descending)
      : oStore.openCursor(keyRange);
    var results = [];
    var resultsMap = {};
    oCursor.onsuccess = function(e) {
      if (!e.target.result) {
        return;
      }
      var cursor = e.target.result;
      var metadata = cursor.value;
      // If opts.keys is set we want to filter here only those docs with
      // key in opts.keys. With no performance tests it is difficult to
      // guess if iteration with filter is faster than many single requests
      function allDocsInner(metadata, data) {
        if (isLocalId(metadata.id)) {
          return cursor['continue']();
        }
        var doc = {
          id: metadata.id,
          key: metadata.id,
          value: {
            rev: Pouch.merge.winningRev(metadata)
          }
        };
        if (opts.include_docs) {
          doc.doc = data;
          doc.doc._rev = Pouch.merge.winningRev(metadata);
          if (doc.doc._doc_id_rev) {
              delete(doc.doc._doc_id_rev);
          }
          if (opts.conflicts) {
            doc.doc._conflicts = collectConflicts(metadata);
          }
        }
        if ('keys' in opts) {
          if (opts.keys.indexOf(metadata.id) > -1) {
            if (isDeleted(metadata)) {
              doc.value.deleted = true;
              doc.doc = null;
            }
            resultsMap[doc.id] = doc;
          }
        } else {
          if(!isDeleted(metadata)) {
            results.push(doc);
          }
        }
        cursor['continue']();
      }

      if (!opts.include_docs) {
        allDocsInner(metadata);
      } else {
        var index = transaction.objectStore(BY_SEQ_STORE).index('_doc_id_rev');
        var mainRev = Pouch.merge.winningRev(metadata);
        var key = metadata.id + "::" + mainRev;
        index.get(key).onsuccess = function(event) {
          allDocsInner(cursor.value, event.target.result);
        };
      }
    };
  };

  // Looping through all the documents in the database is a terrible idea
  // easiest to implement though, should probably keep a counter
  api._info = function idb_info(callback) {
    var count = 0;
    var result;
    var txn = idb.transaction([DOC_STORE], 'readonly');

    txn.oncomplete = function() {
      callback(null, result);
    };

    txn.objectStore(DOC_STORE).openCursor().onsuccess = function(e) {
        var cursor = e.target.result;
        if (!cursor) {
          result = {
            db_name: name,
            doc_count: count,
            update_seq: meta.updateSeq
          };
          return;
        }
        if (cursor.value.deleted !== true) {
          count++;
        }
        cursor['continue']();
      };
  };

  api._changes = function idb_changes(opts) {
    if (Pouch.DEBUG) {
      console.log(name + ': Start Changes Feed: continuous=' + opts.continuous);
    }

    if (!opts.since) {
      opts.since = 0;
    }

    if (opts.continuous) {
      var id = name + ':' + Math.uuid();
      opts.cancelled = false;
      IdbPouch.Changes.addListener(name, id, api, opts);
      IdbPouch.Changes.notify(name);
      return {
        cancel: function() {
          if (Pouch.DEBUG) {
            console.log(name + ': Cancel Changes Feed');
          }
          opts.cancelled = true;
          IdbPouch.Changes.removeListener(name, id);
        }
      };
    }

    var descending = 'descending' in opts ? opts.descending : false;
    descending = descending ? 'prev' : null;

    // Ignore the `since` parameter when `descending` is true
    opts.since = opts.since && !descending ? opts.since : 0;

    var results = [], resultIndices = {}, dedupResults = [];
    var txn;

    function fetchChanges() {
      txn = idb.transaction([DOC_STORE, BY_SEQ_STORE]);
      txn.oncomplete = onTxnComplete;
      var req = descending ?
        txn.objectStore(BY_SEQ_STORE)
          .openCursor(IDBKeyRange.lowerBound(opts.since, true), descending) :
        txn.objectStore(BY_SEQ_STORE)
          .openCursor(IDBKeyRange.lowerBound(opts.since, true));
      req.onsuccess = onsuccess;
      req.onerror = onerror;
    }

    if (opts.filter && typeof opts.filter === 'string') {
      var filterName = opts.filter.split('/');
      api.get('_design/' + filterName[0], function(err, ddoc) {
        /*jshint evil: true */
        var filter = eval('(function() { return ' +
                          ddoc.filters[filterName[1]] + ' })()');
        opts.filter = filter;
        fetchChanges();
      });
    } else {
      fetchChanges();
    }

    function onsuccess(event) {
      if (!event.target.result) {
        // Filter out null results casued by deduping
        for (var i = 0, l = results.length; i < l; i++ ) {
          var result = results[i];
          if (result) {
            dedupResults.push(result);
          }
        }
        return false;
      }

      var cursor = event.target.result;

      // Try to pre-emptively dedup to save us a bunch of idb calls
      var changeId = cursor.value._id, changeIdIndex = resultIndices[changeId];
      if (changeIdIndex !== undefined) {
        results[changeIdIndex].seq = cursor.key; // update so it has the later sequence number
        results.push(results[changeIdIndex]);
        results[changeIdIndex] = null;
        resultIndices[changeId] = results.length - 1;
        return cursor['continue']();
      }

      var index = txn.objectStore(DOC_STORE);
      index.get(cursor.value._id).onsuccess = function(event) {
        var metadata = event.target.result;
        if (isLocalId(metadata.id)) {
          return cursor['continue']();
        }

        var mainRev = Pouch.merge.winningRev(metadata);
        var key = metadata.id + "::" + mainRev;
        var index = txn.objectStore(BY_SEQ_STORE).index('_doc_id_rev');
        index.get(key).onsuccess = function(docevent) {
          var doc = docevent.target.result;
          var changeList = [{rev: mainRev}];
          if (opts.style === 'all_docs') {
          //  console.log('all docs', changeList, collectLeaves(metadata.rev_tree));
            changeList = collectLeaves(metadata.rev_tree);
          }
          var change = {
            id: metadata.id,
            seq: cursor.key,
            changes: changeList,
            doc: doc
          };
          if (isDeleted(metadata, mainRev)) {
            change.deleted = true;
          }
          if (opts.conflicts) {
            change.doc._conflicts = collectConflicts(metadata);
          }

          // Dedupe the changes feed
          var changeId = change.id, changeIdIndex = resultIndices[changeId];
          if (changeIdIndex !== undefined) {
            results[changeIdIndex] = null;
          }
          results.push(change);
          resultIndices[changeId] = results.length - 1;
          cursor['continue']();
        };
      };
    }

    function onTxnComplete() {
      dedupResults.map(function(c) {
        if (opts.filter && !opts.filter.apply(this, [c.doc])) {
          return;
        }
        if (!opts.include_docs) {
          delete c.doc;
        }
        call(opts.onChange, c);
      });
      call(opts.complete, null, {results: dedupResults});
    }

    function onerror(error) {
      // TODO: shouldn't we pass some params here?
      call(opts.complete);
    }
  };

  api._close = function(callback) {
    if (idb === null) {
      return call(callback, Pouch.Errors.NOT_OPEN);
    }

    // https://developer.mozilla.org/en-US/docs/IndexedDB/IDBDatabase#close
    // "Returns immediately and closes the connection in a separate thread..."
    idb.close();
    call(callback, null);
  };

  // compaction internal functions
  api._getRevisionTree = function(docId, callback) {
    var txn = idb.transaction([DOC_STORE], 'readonly');
    var req = txn.objectStore(DOC_STORE).get(docId);
    req.onsuccess = function (event) {
      var doc = event.target.result;
      if (!doc) {
        call(callback, Pouch.Errors.MISSING_DOC);
      } else {
        call(callback, null, doc.rev_tree);
      }
    };
  };

  api._removeDocRevisions = function(docId, revs, callback) {
    var txn = idb.transaction([BY_SEQ_STORE], IDBTransaction.READ_WRITE);
    var index = txn.objectStore(BY_SEQ_STORE).index('_doc_id_rev');
    revs.forEach(function(rev) {
      var key = docId + "::" + rev;
      index.getKey(key).onsuccess = function(e) {
        var seq = e.target.result;
        if (!seq) {
          return;
        }
        var req = txn.objectStore(BY_SEQ_STORE)['delete'](seq);
      };
    });
    txn.oncomplete = function() {
      callback();
    };
  };
  // end of compaction internal functions

  return api;
};

IdbPouch.valid = function idb_valid() {
  return !!indexedDB;
};

IdbPouch.destroy = function idb_destroy(name, callback) {
  if (Pouch.DEBUG) {
    console.log(name + ': Delete Database');
  }
  IdbPouch.Changes.clearListeners(name);
  var req = indexedDB.deleteDatabase(name);

  req.onsuccess = function() {
    call(callback, null);
  };

  req.onerror = idbError(callback);
};

IdbPouch.Changes = new Changes();

Pouch.adapter('idb', IdbPouch);
