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

  var junkSeed = 0;
  var api = {};

  var req = indexedDB.open(opts.name, POUCH_VERSION);
  var name = opts.name;
  var update_seq = 0;

  var idb;

  req.onupgradeneeded = function(e) {
    var db = e.target.result;
    db.createObjectStore(DOC_STORE, {keyPath : 'id'})
      .createIndex('seq', 'seq', {unique : true});
    // We are giving a _junk key because firefox really doesnt like
    // writing without a key
    db.createObjectStore(BY_SEQ_STORE, {keyPath: '_junk', autoIncrement : true});
    db.createObjectStore(ATTACH_STORE, {keyPath: 'digest'});
  };

  req.onsuccess = function(e) {

    idb = e.target.result;

    idb.onversionchange = function() {
      idb.close();
    };

    // polyfill the new onupgradeneeded api for chrome
    if (idb.setVersion && Number(idb.version) !== POUCH_VERSION) {
      var versionReq = idb.setVersion(POUCH_VERSION);
      versionReq.onsuccess = function() {
        req.onupgradeneeded(e);
        req.onsuccess(e);
      };
      return;
    }

    call(callback, null, api);
  };

  req.onerror = function(e) {
    call(callback, {error: 'open', reason: e.toString()});
  };


  api.destroy = function(name, callback) {

    var req = indexedDB.deleteDatabase(name);

    req.onsuccess = function() {
      call(callback, null);
    };

    req.onerror = function(e) {
      call(callback, {error: 'delete', reason: e.toString()});
    };
  };

  api.valid = function() {
    return true;
  };

  // Each database needs a unique id so that we can store the sequence
  // checkpoint without having other databases confuse itself, since
  // localstorage is per host this shouldnt conflict, if localstorage
  // gets wiped it isnt fatal, replications will just start from scratch
  api.id = function() {
    var id = localJSON.get(name + '_id', null);
    if (id === null) {
      id = Math.uuid();
      localJSON.set(name + '_id', id);
    }
    return id;
  };

  api.init = function(opts, callback) {
  };

  api.bulkDocs = function(req, opts, callback) {

    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }

    if (!req.docs) {
      return call(callback, Pouch.Errors.MISSING_BULK_DOCS);
    }

    var newEdits = 'new_edits' in opts ? opts.new_edits : true;
    // We dont want to modify the users variables in place, JSON is kinda
    // nasty for a deep clone though

    var docs = JSON.parse(JSON.stringify(req.docs));

    // Parse and sort the docs
    var docInfos = docs.map(function(doc, i) {
      var newDoc = parseDoc(doc, newEdits);
      // We want to ensure the order of the processing and return of the docs,
      // so we give them a sequence number
      newDoc._bulk_seq = i;
      return newDoc;
    });

    docInfos.sort(function(a, b) {
      return compareRevs(a.metadata, b.metadata);
    });

    var keyRange = IDBKeyRange.bound(
      docInfos[0].metadata.id, docInfos[docInfos.length-1].metadata.id,
      false, false);

    // This groups edits to the same document together
    var buckets = docInfos.reduce(function(acc, docInfo) {
      if (docInfo.metadata.id === acc[0][0].metadata.id) {
        acc[0].push(docInfo);
      } else {
        acc.unshift([docInfo]);
      }
      return acc;
    }, [[docInfos.shift()]]);

    //The reduce screws up the array ordering
    buckets.reverse();
    buckets.forEach(function(bucket) {
      bucket.sort(function(a, b) { return a._bulk_seq - b._bulk_seq; });
    });

    var txn = idb.transaction([DOC_STORE, BY_SEQ_STORE, ATTACH_STORE],
                                   IDBTransaction.READ_WRITE);
    var results = [];

    txn.oncomplete = function(event) {
      results.sort(function(a, b) {
        return a._bulk_seq - b._bulk_seq;
      });

      results.forEach(function(result) {
        delete result._bulk_seq;
        if (/_local/.test(result.id)) {
          return;
        }
        api.changes.emit(result);
      });
      call(callback, null, results);
    };

    txn.onerror = function(event) {
      if (callback) {
        var code = event.target.errorCode;
        var message = Object.keys(IDBDatabaseException)[code-1].toLowerCase();
        callback({
          error : event.type,
          reason : message
        });
      }
    };

    txn.ontimeout = function(event) {
      if (callback) {
        var code = event.target.errorCode;
        var message = Object.keys(IDBDatabaseException)[code].toLowerCase();
        callback({
          error : event.type,
          reason : message
        });
      }
    };

    // right now fire and forget, needs cleaned
    function saveAttachment(digest, data) {
      txn.objectStore(ATTACH_STORE).put({digest: digest, body: data});
    }

    function winningRev(pos, tree) {
      if (!tree[1].length) {
        return pos + '-' + tree[0];
      }
      return winningRev(pos + 1, tree[1][0]);
    }

    var writeDoc = function(docInfo, callback) {

      for (var key in docInfo.data._attachments) {
        if (!docInfo.data._attachments[key].stub) {
          docInfo.data._attachments[key].stub = true;
          var data = docInfo.data._attachments[key].data;
          var digest = 'md5-' + Crypto.MD5(data);
          delete docInfo.data._attachments[key].data;
          docInfo.data._attachments[key].digest = digest;
          saveAttachment(digest, data);
        }
      }
      // The doc will need to refer back to its meta data document
      docInfo.data._id = docInfo.metadata.id;
      if (docInfo.metadata.deleted) {
        docInfo.data._deleted = true;
      }
      docInfo.data._junk = new Date().getTime() + (++junkSeed);
      var dataReq = txn.objectStore(BY_SEQ_STORE).put(docInfo.data);
      dataReq.onsuccess = function(e) {
        docInfo.metadata.seq = e.target.result;
        // We probably shouldnt even store the winning rev, just figure it
        // out on read
        docInfo.metadata.rev = winningRev(docInfo.metadata.rev_tree[0].pos,
                                          docInfo.metadata.rev_tree[0].ids);
        var metaDataReq = txn.objectStore(DOC_STORE).put(docInfo.metadata);
        metaDataReq.onsuccess = function() {
          results.push({
            ok: true,
            id: docInfo.metadata.id,
            rev: docInfo.metadata.rev,
            _bulk_seq: docInfo._bulk_seq
          });
          call(callback);
        };
      };
    };

    var makeErr = function(err, seq) {
      err._bulk_seq = seq;
      return err;
    };

    var cursReq = txn.objectStore(DOC_STORE)
      .openCursor(keyRange, IDBCursor.NEXT);

    var update = function(cursor, oldDoc, docInfo, callback) {
      var mergedRevisions = Pouch.merge(oldDoc.rev_tree,
                                        docInfo.metadata.rev_tree[0], 1000);
      var inConflict = (oldDoc.deleted && docInfo.metadata.deleted) ||
        (!oldDoc.deleted && newEdits && mergedRevisions.conflicts !== 'new_leaf');
      if (inConflict) {
        results.push(makeErr(Pouch.Errors.REV_CONFLICT, docInfo._bulk_seq));
        call(callback);
        return cursor['continue']();
      }

      docInfo.metadata.rev_tree = mergedRevisions.tree;

      writeDoc(docInfo, function() {
        cursor['continue']();
        call(callback);
      });
    };

    var insert = function(docInfo, callback) {
      if (docInfo.metadata.deleted) {
        results.push(Pouch.Errors.MISSING_DOC);
        return;
      }
      writeDoc(docInfo, function() {
        call(callback);
      });
    };

    // If we receive multiple items in bulkdocs with the same id, we process the
    // first but mark rest as conflicts until can think of a sensible reason
    // to not do so
    var markConflicts = function(docs) {
      for (var i = 1; i < docs.length; i++) {
        results.push(makeErr(Pouch.Errors.REV_CONFLICT, docs[i]._bulk_seq));
      }
    };

    cursReq.onsuccess = function(event) {
      var cursor = event.target.result;
      if (cursor && buckets.length) {
        var bucket = buckets.shift();
        if (cursor.key === bucket[0].metadata.id) {
          update(cursor, cursor.value, bucket[0], function() {
            markConflicts(bucket);
          });
        } else {
          insert(bucket[0], function() {
            markConflicts(bucket);
          });
        }
      } else {
        // Cursor has exceeded the key range so the rest are inserts
        buckets.forEach(function(bucket) {
          insert(bucket[0], function() {
            markConflicts(bucket);
          });
        });
      }
    };
  };

  // First we look up the metadata in the ids database, then we fetch the
  // current revision(s) from the by sequence store
  api.get = function(id, opts, callback) {

    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }

    if (/\//.test(id) && !/^_local/.test(id)) {
      var docId = id.split('/')[0];
      var attachId = id.split('/')[1];
      var req = idb.transaction([DOC_STORE], IDBTransaction.READ)
        .objectStore(DOC_STORE).get(docId)
        .onsuccess = function(e) {
          var metadata = e.target.result;
          var nreq = idb.transaction([BY_SEQ_STORE], IDBTransaction.READ)
            .objectStore(BY_SEQ_STORE).get(metadata.seq)
            .onsuccess = function(e) {
              var digest = e.target.result._attachments[attachId].digest;
              var req = idb.transaction([ATTACH_STORE], IDBTransaction.READ)
                .objectStore(ATTACH_STORE).get(digest)
                .onsuccess = function(e) {
                  call(callback, null, atob(e.target.result.body));
                };
            };
        }
      return;
    }

    var req = idb.transaction([DOC_STORE], IDBTransaction.READ)
      .objectStore(DOC_STORE).get(id);

    req.onsuccess = function(e) {
      var metadata = e.target.result;
      if (!e.target.result || metadata.deleted) {
        return call(callback, Pouch.Errors.MISSING_DOC);
      }

      var nreq = idb.transaction([BY_SEQ_STORE], IDBTransaction.READ)
        .objectStore(BY_SEQ_STORE).get(metadata.seq);
      nreq.onsuccess = function(e) {
        var doc = e.target.result;
        delete doc._junk;
        doc._id = metadata.id;
        doc._rev = metadata.rev;
        if (opts.revs) {
          var path = arrayFirst(rootToLeaf(metadata.rev_tree), function(arr) {
            return arr.ids.indexOf(metadata.rev.split('-')[1]) !== -1;
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
        callback(null, doc);
      };
    };
  };

  api.put = api.post = function(doc, opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }
    return api.bulkDocs({docs: [doc]}, opts, yankError(callback));
  };


  api.remove = function(doc, opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }
    var newDoc = JSON.parse(JSON.stringify(doc));
    newDoc._deleted = true;
    return api.bulkDocs({docs: [newDoc]}, opts, yankError(callback));
  };


  api.allDocs = function(opts, callback) {
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
    var transaction = idb.transaction([DOC_STORE, BY_SEQ_STORE], IDBTransaction.READ);
    var oStore = transaction.objectStore(DOC_STORE);
    var oCursor = keyRange ? oStore.openCursor(keyRange, descending)
      : oStore.openCursor(null, descending);
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
            value: {rev: metadata.rev}
          };
          if (opts.include_docs) {
            doc.doc = data;
            doc.doc._rev = metadata.rev;
            delete doc.doc._junk;
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
  api.info = function(callback) {
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

  api.putAttachment = function(id, rev, doc, type, callback) {
    var docId = id.split('/')[0];
    var attachId = id.split('/')[1];
    api.get(docId, function(err, obj) {
      obj._attachments[attachId] = {
        content_type: type,
        data: btoa(doc)
      }
      api.put(obj, callback);
    });
  };


  api.revsDiff = function(req, opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }
    var ids = Object.keys(req);
    var count = 0;
    var missing = {};

    function readDoc(err, doc, id) {
      req[id].map(function(revId) {
        if (!doc || doc._revs_info.every(function(x) { return x.rev !== revId; })) {
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



  api.changes = function(opts, callback) {
    if (opts instanceof Function) {
      opts = {complete: opts};
    }
    if (callback) {
      opts.complete = callback;
    }
    if (!opts.seq) {
      opts.seq = 0;
    }
    var descending = 'descending' in opts ? opts.descending : false;
    descending = descending ? IDBCursor.PREV : null;

    var results = [];
    var transaction = idb.transaction([DOC_STORE, BY_SEQ_STORE]);
    var request = transaction.objectStore(BY_SEQ_STORE)
      .openCursor(IDBKeyRange.lowerBound(opts.seq), descending);
    request.onsuccess = function(event) {
      if (!event.target.result) {
        if (opts.continuous) {
          api.changes.addListener(opts.onChange);
        }
        results.map(function(c) {
          call(opts.onChange, c);
        });
        return call(opts.complete, null, {results: results});
      }
      var cursor = event.target.result;
      var index = transaction.objectStore(DOC_STORE);
      index.get(cursor.value._id).onsuccess = function(event) {
        var doc = event.target.result;
        if (/_local/.test(doc.id)) {
          return cursor['continue']();
        }
        var c = {
          id: doc.id,
          seq: cursor.key,
          changes: collectLeaves(doc.rev_tree)
        };
        if (doc.deleted) {
          c.deleted = true;
        }
        if (opts.include_docs) {
          c.doc = cursor.value;
          c.doc._rev = c.changes[0].rev;
          if (opts.conflicts) {
            c.doc._conflicts = collectConflicts(doc.rev_tree);
          }
        }
        // Dedupe the changes feed
        results = results.filter(function(doc) {
          return doc.id !== c.id;
        });
        results.push(c);
        cursor['continue']();
      };
    };
    request.onerror = function(error) {
      // Cursor is out of range
      // NOTE: What should we do with a sequence that is too high?
      if (opts.continuous) {
        db.changes.addListener(opts.onChange);
      }
      call(opts.complete);
    };
  };

  api.changes.listeners = [];

  api.changes.emit = function() {
    var a = arguments;
    api.changes.listeners.forEach(function(l) {
      l.apply(l, a);
    });
  };
  api.changes.addListener = function(l) {
    api.changes.listeners.push(l);
  };

  api.replicate = {};

  api.replicate.from = function(url, opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }
    Pouch.replicate(url, api, callback);
  };

  api.replicate.to = function(dbName, opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }
    Pouch.replicate(api, dbName, callback);
  };

  api.query = function(fun, reduce, opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }
    if (callback) {
      opts.complete = callback;
    }

    viewQuery(fun, idb, opts);
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

  var viewQuery = function (fun, idb, options) {

    var txn = idb.transaction([DOC_STORE, BY_SEQ_STORE], IDBTransaction.READ);
    var objectStore = txn.objectStore(DOC_STORE);
    var request = objectStore.openCursor();
    var mapContext = {};
    var results = [];
    var current;

    emit = function(key, val) {
      results.push({
        id: current._id,
        key: key,
        value: val
      });
    }

    request.onsuccess = function (e) {
      var cursor = e.target.result;
      if (!cursor) {
        if (options.complete) {
          results.sort(function(a, b) { return Pouch.collate(a.key, b.key); });
          if (options.descending) {
            results.reverse();
          }
          options.complete(null, {rows: results});
        }
      } else {
        var nreq = txn
          .objectStore(BY_SEQ_STORE).get(e.target.result.value.seq)
          .onsuccess = function(e) {
            current = e.target.result;
            if (options.complete) {
              fun.apply(mapContext, [current]);
            }
            cursor['continue']();
          };
      }
    }

    request.onerror = function (error) {
      if (options.error) {
        options.error(error);
      }
    }
  }

  return api;

};

IdbPouch.valid = function() {
  return true;
};

IdbPouch.destroy = function(name, callback) {
  var req = indexedDB.deleteDatabase(name);

  req.onsuccess = function() {
    call(callback, null);
  };

  req.onerror = function(e) {
    call(callback, {error: 'delete', reason: e.toString()});
  };
};

Pouch.adapter('idb', IdbPouch);