// While most of the IDB behaviors match between implementations a
// lot of the names still differ. This section tries to normalize the
// different objects & methods.
window.indexedDB = window.indexedDB ||
  window.mozIndexedDB ||
  window.webkitIndexedDB;

window.IDBCursor = window.IDBCursor ||
  window.webkitIDBCursor;

window.IDBKeyRange = window.IDBKeyRange ||
  window.webkitIDBKeyRange;

window.IDBTransaction = window.IDBTransaction ||
  window.webkitIDBTransaction;

// Newer webkits expect strings for transaction + cursor paramters
// older webkit + older firefox require constants, we can drop
// the constants when both stable releases use strings
IDBTransaction = IDBTransaction || {};
IDBTransaction.READ_WRITE = IDBTransaction.READ_WRITE || 'readwrite';
IDBTransaction.READ = IDBTransaction.READ || 'readonly';

IDBCursor = IDBCursor || {};
IDBCursor.NEXT = IDBCursor.NEXT || 'next';
IDBCursor.PREV = IDBCursor.PREV || 'prev';

var idbError = function(callback) {
  return function(event) {
    call(callback, {
      status: 500,
      error: event.type,
      reason: event.target
    });
  }
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

  //Get the webkit file system objects in a way that is forward compatible
  var storageInfo = (window.webkitStorageInfo ? window.webkitStorageInfo : window.storageInfo)
  var requestFileSystem = (window.webkitRequestFileSystem ? window.webkitRequestFileSystem : window.requestFileSystem)
  var storeAttachmentsInIDB = false;
  if (!storageInfo || !requestFileSystem){
    //This browser does not support the file system API, use idb to store attachments insead
    storeAttachmentsInIDB=true;
  }

  var api = {};
  var idb;

  console.info(name + ': Open Database');

  req.onupgradeneeded = function(e) {
    var db = e.target.result;
    db.createObjectStore(DOC_STORE, {keyPath : 'id'})
      .createIndex('seq', 'seq', {unique : true});
    db.createObjectStore(BY_SEQ_STORE, {autoIncrement : true});
    db.createObjectStore(ATTACH_STORE, {keyPath: 'digest'});
  };

  req.onsuccess = function(e) {

    idb = e.target.result;

    idb.onversionchange = function() {
      idb.close();
    };

    // polyfill the new onupgradeneeded api for chrome. can get rid of when
    // http://code.google.com/p/chromium/issues/detail?id=108223 lands
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

    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }
    if (!opts) {
      opts = {}
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

    var txn = idb.transaction([DOC_STORE, BY_SEQ_STORE, ATTACH_STORE],
                              IDBTransaction.READ_WRITE);
    txn.onerror = idbError(callback);
    txn.ontimeout = idbError(callback);

    processDocs();

    function processDocs() {
      if (!docs.length) {
        return complete();
      }
      var currentDoc = docs.shift();
      var req = txn.objectStore(DOC_STORE).get(currentDoc.metadata.id);
      req.onsuccess = function process_docRead(event) {
        var oldDoc = event.target.result;
        if (!oldDoc) {
          insertDoc(currentDoc, processDocs);
        } else {
          updateDoc(oldDoc, currentDoc);
        }
      }
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
        var rev = winningRev(metadata.rev_tree[0].pos, metadata.rev_tree[0].ids);
        aresults.push({
          ok: true,
          id: metadata.id,
          rev: rev,
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
      for (var key in docInfo.data._attachments) {
        if (!docInfo.data._attachments[key].stub) {
          var data = docInfo.data._attachments[key].data;
          var digest = 'md5-' + Crypto.MD5(data);
          delete docInfo.data._attachments[key].data;
          docInfo.data._attachments[key].digest = digest;
          saveAttachment(digest, data);
        }
      }

      docInfo.data._id = docInfo.metadata.id;
      if (docInfo.metadata.deleted) {
        docInfo.data._deleted = true;
      }
      var dataReq = txn.objectStore(BY_SEQ_STORE).put(docInfo.data);
      dataReq.onsuccess = function(e) {
        console.info(name + ': Wrote Document ', docInfo.metadata.id);
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

    function updateDoc(oldDoc, docInfo) {
      var merged = Pouch.merge(oldDoc.rev_tree,
                               docInfo.metadata.rev_tree[0], 1000);
      var inConflict = (oldDoc.deleted && docInfo.metadata.deleted) ||
        (!oldDoc.deleted && newEdits && merged.conflicts !== 'new_leaf');

      if (inConflict) {
        results.push(makeErr(Pouch.Errors.REV_CONFLICT, docInfo._bulk_seq));
        return processDocs();
      }

      docInfo.metadata.rev_tree = merged.tree;
      writeDoc(docInfo, processDocs);
    }

    function insertDoc(docInfo) {
      // Cant insert new deleted documents
      if ('was_delete' in opts && docInfo.metadata.deleted) {
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

    // right now fire and forget, needs cleaned
    function saveAttachment(digest, data) {
      if (storeAttachmentsInIDB){
        txn.objectStore(ATTACH_STORE).put({digest: digest, body: data});
      }else{
        writeAttachmentToFile(digest,data);
      }
    }
  };

  function sortByBulkSeq(a, b) {
    return a._bulk_seq - b._bulk_seq;
  }

  // First we look up the metadata in the ids database, then we fetch the
  // current revision(s) from the by sequence store
  api.get = function idb_get(id, opts, callback) {

    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }

    var txn = idb.transaction([DOC_STORE, BY_SEQ_STORE, ATTACH_STORE],
                              IDBTransaction.READ);

    if (/\//.test(id) && !/^_local/.test(id) && !/^_design/.test(id)) {
      var docId = id.split('/')[0];
      var attachId = id.split('/')[1];
      txn.objectStore(DOC_STORE).get(docId).onsuccess = function(e) {
        var metadata = e.target.result;
        var bySeq = txn.objectStore(BY_SEQ_STORE);
        bySeq.get(metadata.seq).onsuccess = function(e) {
          var digest = e.target.result._attachments[attachId].digest;
          if (storeAttachmentsInIDB){
            txn.objectStore(ATTACH_STORE).get(digest).onsuccess = function(e) {
              call(callback, null, atob(e.target.result.body));
            }
          }else{
            readAttachmentFromFile(digest, function(data) {
              call(callback, null, atob(data));
            });
          }
        };
      }
      return;
    }

    txn.objectStore(DOC_STORE).get(id).onsuccess = function(e) {
      var metadata = e.target.result;
      if (!e.target.result || (metadata.deleted && !opts.rev)) {
        return call(callback, Pouch.Errors.MISSING_DOC);
      }

      txn.objectStore(BY_SEQ_STORE).get(metadata.seq).onsuccess = function(e) {
        var doc = e.target.result;
        doc._id = metadata.id;
        doc._rev = winningRev(metadata.rev_tree[0].pos, metadata.rev_tree[0].ids);
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
            api.get(doc._id + '/' + key, function(err, data) {
              doc._attachments[key].data = btoa(data);
              if (++recv === attachments.length) {
                callback(null, doc);
              }
            });
          });
        } else {
          if (doc._attachments){
            for (var key in doc._attachments) {
              doc._attachments[key].stub = true;
            }
          }
          callback(null, doc);
        }
      };
    };
  };

  api.put = api.post = function idb_put(doc, opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }
    return api.bulkDocs({docs: [doc]}, opts, yankError(callback));
  };


  api.remove = function idb_remove(doc, opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }
    opts.was_delete = true;
    var newDoc = JSON.parse(JSON.stringify(doc));
    newDoc._deleted = true;
    return api.bulkDocs({docs: [newDoc]}, opts, yankError(callback));
  };


  api.allDocs = function idb_allDocs(opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }

    var start = 'startkey' in opts ? opts.startkey : false;
    var end = 'endkey' in opts ? opts.endkey : false;

    var descending = 'descending' in opts ? opts.descending : false;
    descending = descending ? IDBCursor.PREV : null;

    var keyRange = start && end ? IDBKeyRange.bound(start, end, false, false)
      : start ? IDBKeyRange.lowerBound(start, true)
      : end ? IDBKeyRange.upperBound(end) : false;
    var transaction = idb.transaction([DOC_STORE, BY_SEQ_STORE],
                                      IDBTransaction.READ);
    keyRange = keyRange || null;
    var oStore = transaction.objectStore(DOC_STORE);
    var oCursor = descending ? oStore.openCursor(keyRange, descending)
      : oStore.openCursor(keyRange);
    var results = [];
    oCursor.onsuccess = function(e) {
      if (!e.target.result) {
        return callback(null, {
          total_rows: results.length,
          rows: results
        });
      }
      var cursor = e.target.result;
      function allDocsInner(metadata, data) {
        if (/_local/.test(metadata.id)) {
          return cursor['continue']();
        }
        if (metadata.deleted !== true) {
          var doc = {
            id: metadata.id,
            key: metadata.id,
            value: {
              rev: winningRev(metadata.rev_tree[0].pos,
                              metadata.rev_tree[0].ids)
            }
          };
          if (opts.include_docs) {
            doc.doc = data;
            doc.doc._rev = winningRev(metadata.rev_tree[0].pos,
                                      metadata.rev_tree[0].ids);
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
    idb.transaction([DOC_STORE], IDBTransaction.READ)
      .objectStore(DOC_STORE).openCursor().onsuccess = function(e) {
        var cursor = e.target.result;
        if (!cursor) {
          return callback(null, {
            db_name: name,
            doc_count: count,
            update_seq: update_seq
          });
        }
        if (cursor.value.deleted !== true) {
          count++;
        }
        cursor['continue']();
      };
  };

  api.putAttachment = function idb_putAttachment(id, rev, doc, type, callback) {
    var docId = id.split('/')[0];
    var attachId = id.split('/')[1];
    api.get(docId, {attachments: true}, function(err, obj) {
      obj._attachments || (obj._attachments = {});
      obj._attachments[attachId] = {
        content_type: type,
        data: btoa(doc)
      }
      api.put(obj, callback);
    });
  };


  api.revsDiff = function idb_revsDiff(req, opts, callback) {
    if (opts instanceof Function) {
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

    if (opts instanceof Function) {
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

    console.info(name + ': Start Changes Feed: continuous=' + opts.continuous);

    var descending = 'descending' in opts ? opts.descending : false;
    descending = descending ? IDBCursor.PREV : null;

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

        dedupResults.map(function(c) {
          if (opts.filter && !opts.filter.apply(this, [c.doc])) {
            return;
          }
          if (!opts.include_docs) {
            delete c.doc;
          }
          call(opts.onChange, c);
        });
        return false;
      }
      var cursor = event.target.result;
      var index = txn.objectStore(DOC_STORE);
      index.get(cursor.value._id).onsuccess = function(event) {
        var metadata = event.target.result;
        if (/_local/.test(metadata.id)) {
          return cursor['continue']();
        }

        var change = {
          id: metadata.id,
          seq: cursor.key,
          changes: collectLeaves(metadata.rev_tree),
          doc: cursor.value,
        };

        change.doc._rev = winningRev(metadata.rev_tree[0].pos,
                                     metadata.rev_tree[0].ids);

        if (metadata.deleted) {
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
      };
    };

    function onTxnComplete() {
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
          console.info(name + ': Cancel Changes Feed');
          opts.cancelled = true;
          IdbPouch.Changes.removeListener(name, id);
        }
      }
    }
  };

  api.replicate = {};

  api.replicate.from = function idb_replicate_from(url, opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }
    return Pouch.replicate(url, api, opts, callback);
  };

  api.replicate.to = function idb_replicate_to(dbName, opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }
    return Pouch.replicate(api, dbName, opts, callback);
  };

  api.query = function idb_query(fun, opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }
    if (callback) {
      opts.complete = callback;
    }

    if (typeof fun === 'string') {
      var parts = fun.split('/');
      api.get('_design/' + parts[0], function(err, doc) {
        if (err) {
          call(callback, err);
        }
        new viewQuery({
          map: doc.views[parts[1]].map,
          reduce: doc.views[parts[1]].reduce
        }, idb, opts);
      });
    } else {
      new viewQuery(fun, idb, opts);
    }
  }

  // Wrapper for functions that call the bulkdocs api with a single doc,
  // if the first result is an error, return an error
  var yankError = function(callback) {
    return function(err, results) {
      if (err || results[0].error) {
        call(callback, err || results[0]);
      } else {
        call(callback, null, results[0]);
      }
    };
  };

  var viewQuery = function(fun, idb, options) {

    if (!options.complete) {
      return;
    }

    function sum(values) {
      return values.reduce(function(a, b) { return a + b; }, 0);
    }

    var txn = idb.transaction([DOC_STORE, BY_SEQ_STORE], IDBTransaction.READ);
    var objectStore = txn.objectStore(DOC_STORE);
    var results = [];
    var current;

    var emit = function(key, val) {
      var viewRow = {
        id: current._id,
        key: key,
        value: val
      }
      if (options.include_docs) {
        viewRow.doc = current.doc;
      }
      results.push(viewRow);
    };

    // We may have passed in an anonymous function that used emit in
    // the global scope, this is an ugly way to rescope it
    eval('fun.map = ' + fun.map.toString() + ';');
    if (fun.reduce) {
      eval('fun.reduce = ' + fun.reduce.toString() + ';');
    }

    var request = objectStore.openCursor();
    request.onerror = idbError(options.error);
    request.onsuccess = fetchMetadata;

    function viewComplete() {
      results.sort(function(a, b) {
        return Pouch.collate(a.key, b.key);
      });
      if (options.descending) {
        results.reverse();
      }
      if (options.reduce === false) {
        return options.complete(null, {rows: results});
      }

      var groups = [];
      results.forEach(function(e) {
        var last = groups[groups.length-1] || null;
        if (last && Pouch.collate(last.key[0][0], e.key) === 0) {
          last.key.push([e.key, e.id]);
          last.value.push(e.value);
          return;
        }
        groups.push({ key: [ [e.key,e.id] ], value: [ e.value ]});
      });

      groups.forEach(function(e) {
        e.value = fun.reduce(e.key, e.value) || null;
        e.key = e.key[0][0];
      });
      options.complete(null, {rows: groups});
    }

    function fetchDocData(cursor, metadata, e) {
      current = {doc: e.target.result, metadata: metadata};
      current.doc._rev = winningRev(current.metadata.rev_tree[0].pos,
                                    current.metadata.rev_tree[0].ids);

      if (options.complete && !current.metadata.deleted) {
        fun.map.apply(this, [current.doc]);
      }
      cursor['continue']();
    }

    function fetchMetadata(e) {
      var cursor = e.target.result;
      if (!cursor) {
        return viewComplete();
      }
      var metadata = e.target.result.value;
      var dataReq = txn.objectStore(BY_SEQ_STORE).get(metadata.seq);
      dataReq.onsuccess = fetchDocData.bind(this, cursor, metadata);
      dataReq.onerror = idbError(options.complete);
    }
  }

  // Trees are sorted by length, winning revision is the last revision
  // in the longest tree
  function winningRev(pos, tree) {
    if (!tree[1].length) {
      return pos + '-' + tree[0];
    }
    return winningRev(pos + 1, tree[1][0]);
  }

  //Functions for reading and writing an attachment in the html5 file system instead of idb
  function toArray(list) {
    return Array.prototype.slice.call(list || [], 0);
  }
  function fileErrorHandler(e) {
    console.error('File system error',e);
  }

  //Delete attachments that are no longer referenced by any existing documents
  function deleteOrphanedFiles(currentQuota){
    api.allDocs({include_docs:true},function(err, response) {
      requestFileSystem(window.PERSISTENT, currentQuota, function(fs){
      var dirReader = fs.root.createReader();
      var entries = [];
      var docRows = response.rows;

      // Call the reader.readEntries() until no more results are returned.
      var readEntries = function() {
        dirReader.readEntries (function(results) {
          if (!results.length) {
            for (var i in entries){
              var entryIsReferenced=false;
              for (var k in docRows){
                if (docRows[k].doc){
                  var aDoc = docRows[k].doc;
                  if (aDoc._attachments){
                    for (var j in aDoc._attachments){
                      if (aDoc._attachments[j].digest==entries[i].name) entryIsReferenced=true;
                    };
                  }
                  if (entryIsReferenced) break;
                }
              };
              if (!entryIsReferenced){
                entries[i].remove(function() {
                  console.info("Removed orphaned attachment: "+entries[i].name);
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
    storageInfo.queryUsageAndQuota(window.PERSISTENT, function(currentUsage, currentQuota) {
      var newQuota = currentQuota;
      if (currentQuota == 0){
        newQuota = 1000*1024*1024; //start with 1GB
      }else if ((currentUsage/currentQuota) > 0.8){
        deleteOrphanedFiles(currentQuota); //delete old attachments when we hit 80% usage
      }else if ((currentUsage/currentQuota) > 0.9){
        newQuota=2*currentQuota; //double the quota when we hit 90% usage
      }

      console.info("Current file quota: "+currentQuota+", current usage:"+currentUsage+", new quota will be: "+newQuota);

      //Ask for file quota. This does nothing if the proper quota size has already been granted.
      storageInfo.requestQuota(window.PERSISTENT, newQuota, function(grantedBytes) {
        storageInfo.queryUsageAndQuota(window.PERSISTENT, function(currentUsage, currentQuota) {
          requestFileSystem(window.PERSISTENT, currentQuota, function(fs){
            fs.root.getFile(digest, {create: true}, function(fileEntry) {
              fileEntry.createWriter(function(fileWriter) {
                fileWriter.onwriteend = function(e) {
                  console.info('Wrote attachment');
                };
                fileWriter.onerror = function(e) {
                  console.info('File write failed: ' + e.toString());
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
    storageInfo.queryUsageAndQuota(window.PERSISTENT, function(currentUsage, currentQuota) {
      requestFileSystem(window.PERSISTENT, currentQuota, function(fs){
        fs.root.getFile(digest, {}, function(fileEntry) {
          fileEntry.file(function(file) {
            var reader = new FileReader();
            reader.onloadend = function(e) {
              data = this.result;
              console.info("Read attachment");
              callback(data);
            };
            reader.readAsBinaryString(file);
          }, fileErrorHandler);
        }, fileErrorHandler);
      }, fileErrorHandler);
    }, fileErrorHandler);
  }

  return api;
};

IdbPouch.valid = function idb_valid() {
  return !!window.indexedDB;
};

IdbPouch.destroy = function idb_destroy(name, callback) {

  console.info(name + ': Delete Database');
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
