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

window.IDBDatabaseException = window.IDBDatabaseException ||
  window.webkitIDBDatabaseException;

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
    var code = event.target.errorCode;
    call(callback, {
      status: 500,
      error: event.type,
      reason: Object.keys(IDBDatabaseException)[code-1].toLowerCase()
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

    call(callback, null, api);
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

    if (!docs.length) {
      return txnComplete();
    }

    docs.sort(function(a, b) {
      return Pouch.collate(a.metadata.id, b.metadata.id);
    });

    var txn = idb.transaction([DOC_STORE, BY_SEQ_STORE, ATTACH_STORE],
                              IDBTransaction.READ_WRITE);
    txn.onerror = idbError(callback);
    txn.ontimeout = idbError(callback);
    txn.oncomplete = txnComplete;

    var keyRange = IDBKeyRange.bound(
      docs[0].metadata.id, docs[docs.length-1].metadata.id,
      false, false);

    txn.objectStore(DOC_STORE)
      .openCursor(keyRange, IDBCursor.NEXT).onsuccess = readDoc;

    function readDoc(event) {
      var cursor = event.target.result;
      // Cursor has exceeded the key range so the rest are inserts
      if (!cursor) {
        return docs.forEach(insertDoc);
      }
      var doc = docs.shift();
      if (cursor.key === doc.metadata.id) {
        updateDoc(cursor, cursor.value, doc);
      } else {
        insertDoc(doc);
      }
    }

    function txnComplete(event) {
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

    function updateDoc(cursor, oldDoc, docInfo) {
      var merged = Pouch.merge(oldDoc.rev_tree,
                               docInfo.metadata.rev_tree[0], 1000);
      var inConflict = (oldDoc.deleted && docInfo.metadata.deleted) ||
        (!oldDoc.deleted && newEdits && merged.conflicts !== 'new_leaf');

      if (inConflict) {
        results.push(makeErr(Pouch.Errors.REV_CONFLICT, docInfo._bulk_seq));
        return cursor['continue']();
      }

      docInfo.metadata.rev_tree = merged.tree;

      writeDoc(docInfo, function() {
        cursor['continue']();
      });
    }

    function insertDoc(docInfo) {
      // Cant insert new deleted documents
      if (docInfo.metadata.deleted) {
        return results.push(Pouch.Errors.MISSING_DOC);
      }
      writeDoc(docInfo);
    }

    // Insert sequence number into the error so we can sort later
    function makeErr(err, seq) {
      err._bulk_seq = seq;
      return err;
    }

    // right now fire and forget, needs cleaned
    function saveAttachment(digest, data) {
      txn.objectStore(ATTACH_STORE).put({digest: digest, body: data});
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
          txn.objectStore(ATTACH_STORE).get(digest).onsuccess = function(e) {
            call(callback, null, atob(e.target.result.body));
          };
        };
      }
      return;
    }

    txn.objectStore(DOC_STORE).get(id).onsuccess = function(e) {
      var metadata = e.target.result;
      if (!e.target.result || metadata.deleted) {
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
          doc._conflicts = collectConflicts(metadata.rev_tree);
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

    var results = [];
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
        results.map(function(c) {
          if (opts.filter && !opts.filter.apply(this, [c.doc])) {
            return;
          }
          if (!opts.include_docs) {
            delete c.doc;
          }
          call(opts.onChange, c);
        });
        return call(opts.complete, null, {results: results});
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
        results = results.filter(function(doc) {
          return doc.id !== change.id;
        });
        results.push(change);
        cursor['continue']();
      };
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


  return api;
};

IdbPouch.valid = function idb_valid() {
  return !!window.indexedDB;
};

IdbPouch.destroy = function idb_destroy(name, callback) {

  console.info(name + ': Delete Database');
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
