// While most of the IDB behaviors match between implementations a
// lot of the names still differ. This section tries to normalize the
// different objects & methods.
window.indexedDB = window.indexedDB ||
  window.mozIndexedDB ||
  window.webkitIndexedDB;

// still needed for R/W transactions in Android Chrome. follow MDN example:
// https://developer.mozilla.org/en-US/docs/IndexedDB/IDBDatabase#transaction
window.IDBTransaction = window.IDBTransaction ||
  window.webkitIDBTransaction ||
  { READ_WRITE: 'readwrite' };

window.IDBKeyRange = window.IDBKeyRange ||
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

  var name = opts.name;
  var req = indexedDB.open(name, POUCH_VERSION);
  var update_seq = 0;


  // var storeAttachmentsInIDB = !(window.storageInfo && window.requestFileSystem);
  // We cant store attachments on the filesystem due to a limitation in the
  // indexeddb api, it will close a transaction when we yield to the event loop
  var storeAttachmentsInIDB = true;

  var api = {};
  var idb = null;

  if (Pouch.DEBUG)
    console.log(name + ': Open Database');

  // TODO: before we release, make sure we write upgrade needed
  // in a way that supports a future upgrade path
  req.onupgradeneeded = function(e) {
    var db = e.target.result;
    db.createObjectStore(DOC_STORE, {keyPath : 'id'})
      .createIndex('seq', 'seq', {unique: true});
    db.createObjectStore(BY_SEQ_STORE, {autoIncrement : true})
      .createIndex('_rev', '_rev', {unique: true});
    db.createObjectStore(ATTACH_STORE, {keyPath: 'digest'});
  };

  req.onsuccess = function(e) {

    idb = e.target.result;

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

    // TODO: This is a really inneficient way of finding the last
    // update sequence, cant think of an alterative right now
    api.changes(function(err, changes) {
      if (changes.results.length) {
        update_seq = changes.results[changes.results.length - 1].seq;
      }
      call(callback, null, api);
    });

  };

  req.onerror = idbError(callback);

  api.type = function() {
    return 'idb';
  };

  // Each database needs a unique id so that we can store the sequence
  // checkpoint without having other databases confuse itself, since
  // localstorage is per host this shouldnt conflict, if localstorage
  // gets wiped it isnt fatal, replications will just start from scratch
  api.id = function idb_id() {
    var id = localJSON.get(name + '_id', null);
    if (id === null) {
      id = Math.uuid();
      localJSON.set(name + '_id', id);
    }
    return id;
  };

  api.bulkDocs = function idb_bulkDocs(req, opts, callback) {

    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    if (!opts) {
      opts = {};
    }

    if (!req.docs) {
      return call(callback, Pouch.Errors.MISSING_BULK_DOCS);
    }

    var newEdits = 'new_edits' in opts ? opts.new_edits : true;
    var userDocs = JSON.parse(JSON.stringify(req.docs));

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

    var results = [];
    var docs = [];

    // Group multiple edits to the same document
    docInfos.forEach(function(docInfo) {
      if (docInfo.error) {
        return results.push(docInfo);
      }
      if (!docs.length || docInfo.metadata.id !== docs[0].metadata.id) {
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
        var rev = winningRev(metadata);

        aresults.push({
          ok: true,
          id: metadata.id,
          rev: rev
        });

        if (/_local/.test(metadata.id)) {
          return;
        }

        var change = {
          id: metadata.id,
          seq: metadata.seq,
          changes: collectLeaves(metadata.rev_tree),
          doc: result.data
        };
        change.doc._rev = rev;
        update_seq++;
        IdbPouch.Changes.emitChange(name, change);
      });
      call(callback, null, aresults);
    }

    function writeDoc(docInfo, callback) {
      var err = null;
      var recv = 0;

      docInfo.data._id = docInfo.metadata.id;
      docInfo.data._rev = docInfo.metadata.rev;

      if (isDeleted(docInfo.metadata, docInfo.metadata.rev)) {
        docInfo.data._deleted = true;
      }

      var attachments = docInfo.data._attachments ?
        Object.keys(docInfo.data._attachments) : [];

      for (var key in docInfo.data._attachments) {
        if (!docInfo.data._attachments[key].stub) {
          var data = docInfo.data._attachments[key].data;
          var digest = 'md5-' + Crypto.MD5(data);
          delete docInfo.data._attachments[key].data;
          docInfo.data._attachments[key].digest = digest;
          saveAttachment(docInfo, digest, data, function(err) {
            recv++;
            collectResults(err);
          });
        } else {
          recv++;
          collectResults();
        }
      }

      if (!attachments.length) {
        finish();
      }

      function collectResults(attachmentErr) {
        if (!err) {
          if (attachmentErr) {
            err = attachmentErr;
            call(callback, err);
          } else if (recv == attachments.length) {
            finish();
          }
        }
      }

      function finish() {
        var dataReq = txn.objectStore(BY_SEQ_STORE).put(docInfo.data);
        dataReq.onsuccess = function(e) {
          if (Pouch.DEBUG)
            console.log(name + ': Wrote Document ', docInfo.metadata.id);
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
    }

    function updateDoc(oldDoc, docInfo) {
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
      if (storeAttachmentsInIDB) {
        var objectStore = txn.objectStore(ATTACH_STORE);
        var getReq = objectStore.get(digest).onsuccess = function(e) {
          var ref = [docInfo.metadata.id, docInfo.metadata.rev].join('@');
          var newAtt = {digest: digest, body: data};

          if (e.target.result) {
            if (e.target.result.refs) {
              // only update references if this attachment already has them
              // since we cannot migrate old style attachments here without
              // doing a full db scan for references
              newAtt.refs = e.target.result.refs;
              newAtt.refs[ref] = true;
            }
          } else {
            newAtt.refs = {};
            newAtt.refs[ref] = true;
          }

          var putReq = objectStore.put(newAtt).onsuccess = function(e) {
            call(callback);
          };
          putReq.onerror = putReq.ontimeout = idbError(callback);
        };
        getReq.onerror = getReq.ontimeout = idbError(callback);
      } else {
        // right now fire and forget, needs cleaned
        writeAttachmentToFile(digest,data);
        call(callback);
      }
    }

    var txn = idb.transaction([DOC_STORE, BY_SEQ_STORE, ATTACH_STORE], IDBTransaction.READ_WRITE);
    txn.onerror = idbError(callback);
    txn.ontimeout = idbError(callback);
    txn.oncomplete = complete;

    processDocs();

  };

  function sortByBulkSeq(a, b) {
    return a._bulk_seq - b._bulk_seq;
  }

  // First we look up the metadata in the ids database, then we fetch the
  // current revision(s) from the by sequence store
  api.get = function idb_get(id, opts, callback) {

    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }

    id = parseDocId(id);
    if (id.attachmentId !== '') {
      return api.getAttachment(id, {decode: true}, callback);
    }

    var result;
    var txn = idb.transaction([DOC_STORE, BY_SEQ_STORE, ATTACH_STORE], 'readonly');
    txn.oncomplete = function() {
      if ('error' in result) {
        call(callback, result);
      } else {
        call(callback, null, result);
      }
    };

    txn.objectStore(DOC_STORE).get(id.docId).onsuccess = function(e) {
      var metadata = e.target.result;
      if (!e.target.result || (isDeleted(metadata, opts.rev) && !opts.rev)) {
        result = Pouch.Errors.MISSING_DOC;
        return;
      }

      var rev = winningRev(metadata);
      var key = opts.rev ? opts.rev : rev;
      var index = txn.objectStore(BY_SEQ_STORE).index('_rev');

      index.get(key).onsuccess = function(e) {
        var doc = e.target.result;
        if (opts.revs) {
          var path = arrayFirst(rootToLeaf(metadata.rev_tree), function(arr) {
            return arr.ids.indexOf(doc._rev.split('-')[1]) !== -1;
          });
          path.ids.reverse();
          doc._revisions = {
            start: (path.pos + path.ids.length) - 1,
            ids: path.ids
          };
        }
        if (opts.revs_info) {
          doc._revs_info = metadata.rev_tree.reduce(function(prev, current) {
            return prev.concat(collectRevs(current));
          }, []);
        }
        if (opts.conflicts) {
          var conflicts = collectConflicts(metadata.rev_tree);
          if (conflicts.length) {
            doc._conflicts = conflicts;
          }
        }

        if (opts.attachments && doc._attachments) {
          var attachments = Object.keys(doc._attachments);
          var recv = 0;

          attachments.forEach(function(key) {
            api.getAttachment(doc._id + '/' + key, {txn: txn}, function(err, data) {
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

  api.getAttachment = function(id, opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }
    if (typeof id === 'string') {
      id = parseDocId(id);
    }

    var result;
    var txn;

    // This can be called while we are in a current transaction, pass the context
    // along and dont wait for the transaction to complete here.
    if ('txn' in opts) {
      txn = opts.txn;
    } else {
      txn = idb.transaction([DOC_STORE, BY_SEQ_STORE, ATTACH_STORE], 'readonly');
      txn.oncomplete = function() { call(callback, null, result); }
    }

    txn.objectStore(DOC_STORE).get(id.docId).onsuccess = function(e) {
      var metadata = e.target.result;
      var bySeq = txn.objectStore(BY_SEQ_STORE);
      bySeq.get(metadata.seq).onsuccess = function(e) {
        var attachment = e.target.result._attachments[id.attachmentId];
        var digest = attachment.digest;
        var type = attachment.content_type

        function postProcessDoc(data) {
          if (opts.decode) {
            data = atob(data);
          }
          return data;
        }

        if (storeAttachmentsInIDB) {
          txn.objectStore(ATTACH_STORE).get(digest).onsuccess = function(e) {
            var data = e.target.result.body;
            result = postProcessDoc(data);
            if ('txn' in opts) {
              call(callback, null, result);
            }
          }
        } else {
          // This will be buggy, it will cause the transaction to be closed
          // as we will be returning to the event loop waiting on the file to
          // read, switch back to idb asap
          readAttachmentFromFile(digest, function(data) {
            result = postProcessDoc(data);
            if ('txn' in opts) {
              call(callback, null, result);
            }
          });
        }
      };
    }
    return;
  }

  api.put = function(doc, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }

    if (!doc || !('_id' in doc)) {
      return call(callback, Pouch.Errors.MISSING_ID);
    }
    return api.bulkDocs({docs: [doc]}, opts, yankError(callback));
  }

  api.post = function idb_put(doc, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    return api.bulkDocs({docs: [doc]}, opts, yankError(callback));
  };

  api.putAttachment = function idb_putAttachment(id, rev, doc, type, callback) {
    id = parseDocId(id);
    api.get(id.docId, {attachments: true}, function(err, obj) {
      obj._attachments || (obj._attachments = {});
      obj._attachments[id.attachmentId] = {
        content_type: type,
        data: btoa(doc)
      }
      api.put(obj, callback);
    });
  };

  api.remove = function idb_remove(doc, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    opts.was_delete = true;
    var newDoc = JSON.parse(JSON.stringify(doc));
    newDoc._deleted = true;
    return api.bulkDocs({docs: [newDoc]}, opts, yankError(callback));
  };

  api.removeAttachment = function idb_removeAttachment(id, rev, callback) {
    id = parseDocId(id);
    api.get(id.docId, function(err, obj) {
      if (err) {
        call(callback, err);
        return;
      }

      if (obj._rev != rev) {
        call(callback, Pouch.Errors.REV_CONFLICT);
        return;
      }

      obj._attachments || (obj._attachments = {});
      delete obj._attachments[id.attachmentId];
      api.put(obj, callback);
    });
  };

  api.allDocs = function idb_allDocs(opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }

    var start = 'startkey' in opts ? opts.startkey : false;
    var end = 'endkey' in opts ? opts.endkey : false;

    var descending = 'descending' in opts ? opts.descending : false;
    descending = descending ? 'prev' : null;

    var keyRange = start && end ? IDBKeyRange.bound(start, end, false, false)
      : start ? IDBKeyRange.lowerBound(start, true)
      : end ? IDBKeyRange.upperBound(end) : null;

    var result;
    var transaction = idb.transaction([DOC_STORE, BY_SEQ_STORE], 'readonly');
    transaction.oncomplete = function() { callback(null, result); };

    var oStore = transaction.objectStore(DOC_STORE);
    var oCursor = descending ? oStore.openCursor(keyRange, descending)
      : oStore.openCursor(keyRange);
    var results = [];
    oCursor.onsuccess = function(e) {
      if (!e.target.result) {
        result = {
          total_rows: results.length,
          rows: results
        };
        return;
      }
      var cursor = e.target.result;
      function allDocsInner(metadata, data) {
        if (/_local/.test(metadata.id)) {
          return cursor['continue']();
        }
        if (!isDeleted(metadata)) {
          var doc = {
            id: metadata.id,
            key: metadata.id,
            value: {
              rev: winningRev(metadata)
            }
          };
          if (opts.include_docs) {
            doc.doc = data;
            doc.doc._rev = winningRev(metadata);
            if (opts.conflicts) {
              doc.doc._conflicts = collectConflicts(metadata.rev_tree);
            }
          }
          results.push(doc);
        }
        cursor['continue']();
      }

      if (!opts.include_docs) {
        allDocsInner(cursor.value);
      } else {
        var index = transaction.objectStore(BY_SEQ_STORE);
        index.get(cursor.value.seq).onsuccess = function(event) {
          allDocsInner(cursor.value, event.target.result);
        };
      }
    }
  };

  // Looping through all the documents in the database is a terrible idea
  // easiest to implement though, should probably keep a counter
  api.info = function idb_info(callback) {
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
            update_seq: update_seq
          };
          return;
        }
        if (cursor.value.deleted !== true) {
          count++;
        }
        cursor['continue']();
      };
  };

  api.revsDiff = function idb_revsDiff(req, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    var ids = Object.keys(req);
    var count = 0;
    var missing = {};

    function readDoc(err, doc, id) {
      req[id].map(function(revId) {
        var matches = function(x) { return x.rev !== revId; };
        if (!doc || doc._revs_info.every(matches)) {
          if (!missing[id]) {
            missing[id] = {missing: []};
          }
          missing[id].missing.push(revId);
        }
      });

      if (++count === ids.length) {
        return call(callback, null, missing);
      }
    }

    ids.map(function(id) {
      api.get(id, {revs_info: true}, function(err, doc) {
        readDoc(err, doc, id);
      });
    });
  };

  api.changes = function idb_changes(opts, callback) {

    if (typeof opts === 'function') {
      opts = {complete: opts};
    }
    if (callback) {
      opts.complete = callback;
    }
    if (!opts.seq) {
      opts.seq = 0;
    }
    if (opts.since) {
      opts.seq = opts.since;
    }

    if (Pouch.DEBUG)
      console.log(name + ': Start Changes Feed: continuous=' + opts.continuous);

    var descending = 'descending' in opts ? opts.descending : false;
    descending = descending ? 'prev' : null;

    var results = [], resultIndices = {}, dedupResults = [];
    var id = name + ':' + Math.uuid();
    var txn;

    if (opts.filter && typeof opts.filter === 'string') {
      var filterName = opts.filter.split('/');
      api.get('_design/' + filterName[0], function(err, ddoc) {
        var filter = eval('(function() { return ' +
                          ddoc.filters[filterName[1]] + ' })()');
        opts.filter = filter;
        fetchChanges();
      });
    } else {
      fetchChanges();
    }

    function fetchChanges() {
      txn = idb.transaction([DOC_STORE, BY_SEQ_STORE]);
      txn.oncomplete = onTxnComplete;
      var req = descending
        ? txn.objectStore(BY_SEQ_STORE)
          .openCursor(IDBKeyRange.lowerBound(opts.seq, true), descending)
        : txn.objectStore(BY_SEQ_STORE)
          .openCursor(IDBKeyRange.lowerBound(opts.seq, true));
      req.onsuccess = onsuccess;
      req.onerror = onerror;
    }

    function onsuccess(event) {
      if (!event.target.result) {
        if (opts.continuous && !opts.cancelled) {
          IdbPouch.Changes.addListener(name, id, opts);
        }

        // Filter out null results casued by deduping
        for (var i = 0, l = results.length; i < l; i++ ) {
          var result = results[i];
          if (result) dedupResults.push(result);
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
        if (/_local/.test(metadata.id)) {
          return cursor['continue']();
        }

        var mainRev = winningRev(metadata);
        var index = txn.objectStore(BY_SEQ_STORE).index('_rev');
        index.get(mainRev).onsuccess = function(docevent) {
          var doc = docevent.target.result;
          var changeList = [{rev: mainRev}]
          if (opts.style === 'all_docs') {
          //  console.log('all docs', changeList, collectLeaves(metadata.rev_tree));
            changeList = collectLeaves(metadata.rev_tree);
          }
          var change = {
            id: metadata.id,
            seq: cursor.key,
            changes: changeList,
            doc: doc,
          };
          if (isDeleted(metadata, mainRev)) {
            change.deleted = true;
          }
          if (opts.conflicts) {
            change.doc._conflicts = collectConflicts(metadata.rev_tree);
          }

          // Dedupe the changes feed
          var changeId = change.id, changeIdIndex = resultIndices[changeId];
          if (changeIdIndex !== undefined) {
            results[changeIdIndex] = null;
          }
          results.push(change);
          resultIndices[changeId] = results.length - 1;
          cursor['continue']();
        }
      };
    };

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
    };

    function onerror(error) {
      if (opts.continuous) {
        IdbPouch.Changes.addListener(name, id, opts);
      }
      call(opts.complete);
    };

    if (opts.continuous) {
      return {
        cancel: function() {
          if (Pouch.DEBUG)
            console.log(name + ': Cancel Changes Feed');
          opts.cancelled = true;
          IdbPouch.Changes.removeListener(name, id);
        }
      }
    }
  };

  api.replicate = {};

  api.replicate.from = function idb_replicate_from(url, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    return Pouch.replicate(url, api, opts, callback);
  };

  api.replicate.to = function idb_replicate_to(dbName, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    return Pouch.replicate(api, dbName, opts, callback);
  };

  // Functions for reading and writing an attachment in the html5 file system
  // instead of idb
  function toArray(list) {
    return Array.prototype.slice.call(list || [], 0);
  }
  function fileErrorHandler(e) {
    console.error('File system error',e);
  }

  //Delete attachments that are no longer referenced by any existing documents
  function deleteOrphanedFiles(currentQuota){
    api.allDocs({include_docs:true},function(err, response) {
      window.requestFileSystem(window.PERSISTENT, currentQuota, function(fs){
      var dirReader = fs.root.createReader();
      var entries = [];
      var docRows = response.rows;

      // Call the reader.readEntries() until no more results are returned.
      var readEntries = function() {
        dirReader.readEntries (function(results) {
          if (!results.length) {
            for (var i in entries){
              var entryIsReferenced = false;
              for (var k in docRows){
                if (docRows[k].doc){
                  var aDoc = docRows[k].doc;
                  if (aDoc._attachments) {
                    for (var j in aDoc._attachments) {
                      if (aDoc._attachments[j].digest==entries[i].name) {
                        entryIsReferenced = true;
                      }
                    };
                  }
                  if (entryIsReferenced) break;
                }
              };
              if (!entryIsReferenced){
                entries[i].remove(function() {
                  if (Pouch.DEBUG)
                    console.log("Removed orphaned attachment: "+entries[i].name);
                }, fileErrorHandler);
              }
            };
          } else {
            entries = entries.concat(toArray(results));
            readEntries();
          }
        }, fileErrorHandler);
      };

      readEntries(); // Start reading dirs.

      }, fileErrorHandler);
    });
  }

  function writeAttachmentToFile(digest, data, type){
    //Check the current file quota and increase it if necessary
    window.storageInfo.queryUsageAndQuota(window.PERSISTENT, function(currentUsage, currentQuota) {
      var newQuota = currentQuota;
      if (currentQuota == 0){
        newQuota = 1000*1024*1024; //start with 1GB
      }else if ((currentUsage/currentQuota) > 0.8){
        deleteOrphanedFiles(currentQuota); //delete old attachments when we hit 80% usage
      }else if ((currentUsage/currentQuota) > 0.9){
        newQuota=2*currentQuota; //double the quota when we hit 90% usage
      }

      if (Pouch.DEBUG)
        console.log("Current file quota: "+currentQuota+", current usage:"+currentUsage+", new quota will be: "+newQuota);

      //Ask for file quota. This does nothing if the proper quota size has already been granted.
      window.storageInfo.requestQuota(window.PERSISTENT, newQuota, function(grantedBytes) {
        window.storageInfo.queryUsageAndQuota(window.PERSISTENT, function(currentUsage, currentQuota) {
          window.requestFileSystem(window.PERSISTENT, currentQuota, function(fs){
            fs.root.getFile(digest, {create: true}, function(fileEntry) {
              fileEntry.createWriter(function(fileWriter) {
                fileWriter.onwriteend = function(e) {
                  if (Pouch.DEBUG)
                    console.log('Wrote attachment');
                };
                fileWriter.onerror = function(e) {
                  console.error('File write failed: ' + e.toString());
                };
                var blob = new Blob([data], {type: type});
                fileWriter.write(blob);
              }, fileErrorHandler);
            }, fileErrorHandler);
          }, fileErrorHandler);
        }, fileErrorHandler);
      }, fileErrorHandler);
    },fileErrorHandler);
  }

  function readAttachmentFromFile(digest, callback){
    window.storageInfo.queryUsageAndQuota(window.PERSISTENT, function(currentUsage, currentQuota) {
      window.requestFileSystem(window.PERSISTENT, currentQuota, function(fs){
        fs.root.getFile(digest, {}, function(fileEntry) {
          fileEntry.file(function(file) {
            var reader = new FileReader();
            reader.onloadend = function(e) {
              data = this.result;
              if (Pouch.DEBUG)
                console.log("Read attachment");
              callback(data);
            };
            reader.readAsBinaryString(file);
          }, fileErrorHandler);
        }, fileErrorHandler);
      }, fileErrorHandler);
    }, fileErrorHandler);
  }

  api.close = function(callback) {
    if (idb === null) {
      return call(callback, Pouch.Errors.NOT_OPEN);
    }

    // https://developer.mozilla.org/en-US/docs/IndexedDB/IDBDatabase#close
    // "Returns immediately and closes the connection in a separate thread..."
    idb.close();
    call(callback, null);
  };

  return api;
};

IdbPouch.valid = function idb_valid() {
  if (!document.location.host) {
    console.error('indexedDB cannot be used in pages served from the filesystem');
  }
  return !!window.indexedDB && !!document.location.host;
};

IdbPouch.destroy = function idb_destroy(name, callback) {
  if (Pouch.DEBUG)
    console.log(name + ': Delete Database');
  //delete the db id from localStorage so it doesn't get reused.
  delete localStorage[name+"_id"];
  IdbPouch.Changes.clearListeners(name);
  var req = indexedDB.deleteDatabase(name);

  req.onsuccess = function() {
    call(callback, null);
  };

  req.onerror = idbError(callback);
};

IdbPouch.Changes = (function() {

  var api = {};
  var listeners = {};

  api.addListener = function(db, id, opts) {
    if (!listeners[db]) {
      listeners[db] = {};
    }
    listeners[db][id] = opts;
  }

  api.removeListener = function(db, id) {
    delete listeners[db][id];
  }

  api.clearListeners = function(db) {
    delete listeners[db];
  }

  api.emitChange = function(db, change) {
    if (!listeners[db]) {
      return;
    }
    for (var i in listeners[db]) {
      var opts = listeners[db][i];
      if (opts.filter && !opts.filter.apply(this, [change.doc])) {
        return;
      }
      if (!opts.include_docs) {
        delete change.doc;
      }
      opts.onChange.apply(opts.onChange, [change]);
    }
  }

  return api;
})();

Pouch.adapter('idb', IdbPouch);
