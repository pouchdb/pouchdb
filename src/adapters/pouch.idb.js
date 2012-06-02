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

function sum(values) {
  return values.reduce(function(a, b) { return a + b; }, 0);
}

// TODO: This shouldnt be global, but embedded version lost listeners
var testListeners = {};

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

  var api = {};

  var name = opts.name;
  var req = indexedDB.open(name, POUCH_VERSION);
  var update_seq = 0;

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

    // polyfill the new onupgradeneeded api for chrome
    if (idb.setVersion && Number(idb.version) !== POUCH_VERSION) {
      var versionReq = idb.setVersion(POUCH_VERSION);
      versionReq.onsuccess = function(evt) {
        evt.target.result.oncomplete = function() {
          req.onsuccess(e);
        };
        req.onupgradeneeded(e);
      };
      return;
    }

    call(callback, null, api);
  };

  req.onerror = function(e) {
    call(callback, {error: 'open', reason: e.toString()});
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
      if (a.error || b.error) {
        return -1;
      }
      return Pouch.collate(a.metadata.id, b.metadata.id);
    });

    var results = [];

    var firstDoc;
    for (var i = 0; i < docInfos.length; i++) {
      if (docInfos[i].error) {
        results.push(docInfos[i])
      } else {
        firstDoc = docInfos[i];
        break;
      }
    }

    if (!firstDoc) {
      docInfos.sort(function(a, b) {
        return a._bulk_seq - b._bulk_seq;
      });
      docInfos.forEach(function(result) {
        delete result._bulk_seq;
      });
      return call(callback, null, docInfos);
    }

    var keyRange = IDBKeyRange.bound(
      firstDoc.metadata.id, docInfos[docInfos.length-1].metadata.id,
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

    txn.oncomplete = function(event) {

      var aresults = [];

      results.sort(function(a, b) {
        return a._bulk_seq - b._bulk_seq;
      });

      results.forEach(function(result) {
        delete result._bulk_seq;
        if (result.error) {
          aresults.push(result);
        } else {
          aresults.push({
            ok: true,
            id: result.metadata.id,
            rev: result.metadata.rev,
          });
        }

        if (result.error || /_local/.test(result.metadata.id)) {
          return;
        }

        var c = {
          id: result.metadata.id,
          seq: result.metadata.seq,
          changes: collectLeaves(result.metadata.rev_tree),
          doc: result.data
        };
        api.changes.emit(c);
      });
      call(callback, null, aresults);
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
      var dataReq = txn.objectStore(BY_SEQ_STORE).put(docInfo.data);
      dataReq.onsuccess = function(e) {
        console.info(name + ': Wrote Document ', docInfo.metadata.id);
        docInfo.metadata.seq = e.target.result;
        // We probably shouldnt even store the winning rev, just figure it
        // out on read
        docInfo.metadata.rev = winningRev(docInfo.metadata.rev_tree[0].pos,
                                          docInfo.metadata.rev_tree[0].ids);
        var metaDataReq = txn.objectStore(DOC_STORE).put(docInfo.metadata);
        metaDataReq.onsuccess = function() {
          results.push(docInfo);
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
        (!oldDoc.deleted && newEdits &&
         mergedRevisions.conflicts !== 'new_leaf');
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
            value: {rev: metadata.rev}
          };
          if (opts.include_docs) {
            doc.doc = data;
            doc.doc._rev = metadata.rev;
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
        txn = idb.transaction([DOC_STORE, BY_SEQ_STORE]);
        var req = descending
          ? txn.objectStore(BY_SEQ_STORE)
            .openCursor(IDBKeyRange.lowerBound(opts.seq, true), descending)
          : txn.objectStore(BY_SEQ_STORE)
            .openCursor(IDBKeyRange.lowerBound(opts.seq, true));
        req.onsuccess = onsuccess;
        req.onerror = onerror;
      });
    } else {
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
        if (opts.continuous) {
          api.changes.addListener(id, opts);
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
        var doc = event.target.result;
        if (/_local/.test(doc.id)) {
          return cursor['continue']();
        }
        var c = {
          id: doc.id,
          seq: cursor.key,
          changes: collectLeaves(doc.rev_tree),
          doc: cursor.value,
        };
        c.doc._rev = doc.rev;

        if (doc.deleted) {
          c.deleted = true;
        }
        if (opts.include_docs) {
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

    function onerror(error) {
      // Cursor is out of range
      // NOTE: What should we do with a sequence that is too high?
      if (opts.continuous) {
        db.changes.addListener(id, opts);
      }
      call(opts.complete);
    };

    if (opts.continuous) {
      // Possible race condition when the user cancels a continous changes feed
      // before the current changes are finished (therefore before the listener
      // is added
      return {
        cancel: function() {
          console.info('Cancel Changes Feed');
          opts.cancelled = true;
          delete testListeners[id];
        }
      }
    }
  };

  api.changes.listeners = {};

  api.changes.emit = function idb_change_emit() {
    var a = arguments;
    for (var i in testListeners) {
      // Currently using a global listener pool keys by db name, we shouldnt
      // do that
      if (i.match(name)) {
        var opts = testListeners[i];
        if (opts.filter && !opts.filter.apply(this, [a[0].doc])) {
          return;
        }
        opts.onChange.apply(opts.onChange, a);
      }
    }
  };

  api.changes.addListener = function idb_addListener(id, opts, callback) {
    testListeners[id] = opts;
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
        eval('var map = ' + doc.views[parts[1]].map);
        // TODO: reduce may not be defined, or may be predefined
        eval('var reduce = ' + doc.views[parts[1]].reduce);
        viewQuery({map: map, reduce: reduce}, idb, opts);
      });
    } else {
      viewQuery(fun, idb, opts);
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

  var viewQuery = function (fun, idb, options) {

    var txn = idb.transaction([DOC_STORE, BY_SEQ_STORE], IDBTransaction.READ);
    var objectStore = txn.objectStore(DOC_STORE);
    var request = objectStore.openCursor();
    var mapContext = {};
    var results = [];
    var current;

    emit = function(key, val) {
      var viewRow = {
        id: current._id,
        key: key,
        value: val
      }
      if (options.include_docs) {
        viewRow.doc = current.doc;
      }
      results.push(viewRow);
    }

    request.onsuccess = function (e) {
      var cursor = e.target.result;
      if (!cursor) {
        if (options.complete) {
          results.sort(function(a, b) {
            return Pouch.collate(a.key, b.key);
          });
          if (options.descending) {
            results.reverse();
          }
          if (options.reduce !== false) {

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
          } else {
            options.complete(null, {rows: results});
          }
        }
      } else {
        var metadata = e.target.result.value;
        var nreq = txn
          .objectStore(BY_SEQ_STORE).get(metadata.seq)
          .onsuccess = function(e) {
            current = {doc: e.target.result, metadata: metadata};
            current.doc._rev = current.metadata.rev;
            if (options.complete && !current.metadata.deleted) {
              fun.map.apply(mapContext, [current.doc]);
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

IdbPouch.valid = function idb_valid() {
  return !!window.indexedDB;
};

IdbPouch.destroy = function idb_destroy(name, callback) {

  console.info(name + ': Delete Database');
  var req = indexedDB.deleteDatabase(name);

  req.onsuccess = function() {
    call(callback, null);
  };

  req.onerror = function(e) {
    call(callback, {error: 'delete', reason: e.toString()});
  };
};

Pouch.adapter('idb', IdbPouch);
