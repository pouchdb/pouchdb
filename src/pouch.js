(function() {

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

  var root = this;
  var pouch = {};

  if (typeof exports !== 'undefined') {
    exports.pouch = pouch;
  } else {
    root.pouch = pouch;
  }

  // IndexedDB requires a versioned database structure, this is going to make
  // it hard to dynamically create object stores if we needed to for things
  // like views
  var POUCH_VERSION = 1;

  // Cache for open databases
  var pouchCache = {};

  // The object stores created for each database
  // DOC_STORE stores the document meta data, its revision history and state
  var DOC_STORE = 'document-store';
  // BY_SEQ_STORE stores a particular version of a document, keyed by its
  // sequence id
  var BY_SEQ_STORE = 'by-sequence';


  // Pretty dumb name for a function, just wraps callback calls so we dont
  // to if (callback) callback() everywhere
  var call = function() {
    var fun = arguments[0];
    var args = Array.prototype.slice.call(arguments);
    args.shift();
    if (typeof fun === typeof Function) {
      fun.apply(this, args);
    }
  };

  // Preprocess documents, parse their revisions, assign an id and a
  // revision for new writes that are missing them, etc
  // I am fairly certain we shouldnt be throwing errors here
  var parseDoc = function(doc, newEdits) {
    if (newEdits) {
      if (!doc._id) {
        doc._id = Math.uuid();
      }
      var newRevId = Math.uuid(32, 16);
      if (doc._rev) {
        var revInfo = /^(\d+)-(.+)$/.exec(doc._rev);
        if (!revInfo) {
          throw "invalid value for property '_rev'";
        }
        doc._revisions = {
          start: parseInt(revInfo[1], 10) + 1,
          ids: [newRevId, revInfo[2]]
        };
      } else {
        doc._revisions = {
          start : 1,
          ids : [newRevId]
      };
      }
    } else {
      if (!doc._revisions) {
        throw "missing property '_revisions'";
      }
      if (!isFinite(doc._revisions.start)) {
        throw "property '_revisions.start' must be a number";
      }
      if (Array.isArray(doc._revisions) && doc._revisions.length > 0) {
        throw "property '_revisions.id' must be a non-empty array";
      }
    }
    doc._id = decodeURIComponent(doc._id);
    doc._rev = [doc._revisions.start, doc._revisions.ids[0]].join('-');
    return Object.keys(doc).reduce(function(acc, key) {
      if (/^_/.test(key))
        acc.metadata[key.slice(1)] = doc[key];
      else
        acc.data[key] = doc[key];
      return acc;
    }, {metadata : {}, data : {}});
  };


  var compareRevs = function(a, b) {
    // Sort by id
    if (a.id !== b.id) {
      return (a.id < b.id ? -1 : 1);
    }
    // Then by deleted
    if (a.deleted ^ b.deleted) {
      return (a.deleted ? -1 : 1);
    }
    // Then by rev id
    if (a.revisions.start === b.revisions.start) {
      return (a.revisions.ids < b.revisions.ids ? -1 : 1);
    }
    // Then by depth of edits
    return (a.revisions.start < b.revisions.start ? -1 : 1);
  };


  // This opens a database, creating it if needed and returns the api
  // used to access the database
  var makePouch = function(db) {

    // Wrapper for functions that call the bulkdocs api with a single doc,
    // if the first result is an error, return an error
    var singularErr = function(callback) {
      return function(err, results) {
        if (err || results[0].error) {
          call(callback, err || results[0]);
        } else {
          call(callback, null, results[0]);
        }
      };
    };

    // Now we create the PouchDB interface
    var pouch = {update_seq: 0};

    // First we look up the metadata in the ids database, then we fetch the
    // current revision(s) from the by sequence store
    pouch.get = function(id, opts, callback) {
      if (opts instanceof Function) {
        callback = opts;
        opts = {};
      }

      var req = db.transaction([DOC_STORE], IDBTransaction.READ)
        .objectStore(DOC_STORE).get(id);

      req.onsuccess = function(e) {
        var metadata = e.target.result;
        if (!e.target.result || metadata.deleted) {
          return call(callback, {
            error: true,
            message: "Document does not exist"
          });
        }

        var nreq = db.transaction([BY_SEQ_STORE], IDBTransaction.READ)
          .objectStore(BY_SEQ_STORE).get(metadata.seq);
        nreq.onsuccess = function(e) {
          var doc = e.target.result;
          doc._id = metadata.id;
          doc._rev = metadata.rev;
          callback(null, doc);
        }
      }
    };

    pouch.remove = function(doc, opts, callback) {
      if (opts instanceof Function) {
        callback = opts;
        opts = {};
      }
      doc._deleted = true;
      return pouch.bulkDocs({docs: [doc]}, opts, singularErr(callback));
    };

    pouch.put = pouch.post = function(doc, opts, callback) {
      if (opts instanceof Function) {
        callback = opts;
        opts = {};
      }
      pouch.bulkDocs({docs: [doc]}, opts, singularErr(callback));
    };

    pouch.bulkDocs = function(req, opts, callback) {
      if (opts instanceof Function) {
        callback = opts;
        opts = {};
      }

      var newEdits = 'new_edits' in opts ? opts._new_edits : true;

      // Parse and sort the docs
      var docInfos = req.docs.map(function(doc) {
        return parseDoc(doc, newEdits);
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

      var txn = db.transaction([DOC_STORE, BY_SEQ_STORE],
                               IDBTransaction.READ_WRITE);
      var results = [];

      txn.oncomplete = function(event) {
        call(callback, null, results);
      };

      txn.onerror = function(event) {
        if (callback) {
          var code = event.target.errorCode;
          var message = Object.keys(IDBDatabaseException)[code].toLowerCase();
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

      var cursReq = txn.objectStore(DOC_STORE)
        .openCursor(keyRange, IDBCursor.NEXT);

      cursReq.onsuccess = function(event) {
        var cursor = event.target.result;
        if (cursor) {
          // I am guessing keyRange should be sorted in the same way buckets
          // are, so we can just take the first from buckets
          var doc = buckets.shift();
          // Documents are grouped by id in buckets, which means each document
          // has an array of edits, this currently only works for single edits
          // they should probably be getting merged
          var docInfo = doc[0];
          var revisions = cursor.value.revisions.ids;
          // Currently ignoring the revision sequence number, we shouldnt do that
          if (revisions[revisions.length-1] !== docInfo.metadata.revisions.ids[1]) {
            results.push({
              error: true,
              message: 'Invalid rev'
            });
            return cursor['continue']();
          }
          var dataReq = txn.objectStore(BY_SEQ_STORE).put(docInfo.data);
          dataReq.onsuccess = function(e) {
            docInfo.metadata.seq = e.target.result;
            var metaDataReq = txn.objectStore(DOC_STORE).put(docInfo.metadata);
            metaDataReq.onsuccess = function() {
              results.push({
                id : docInfo.metadata.id,
                rev : docInfo.metadata.rev
              });
              return cursor['continue']();
            };
          };
        } else {
          // Cursor has exceeded the key range so the rest are inserts
          buckets.forEach(function(bucket) {
            // TODO: merge the bucket revs into a rev tree
            var docInfo = bucket[0];
            if (docInfo.metadata.deleted) {
              results.push({
                error: true,
                message: 'Can only delete things that exist'
              });
              return;
            }
            var dataReq = txn.objectStore(BY_SEQ_STORE).add(docInfo.data);
            dataReq.onsuccess = function(e) {
              docInfo.metadata.seq = e.target.result;
              var metaDataReq = txn.objectStore(DOC_STORE).add(docInfo.metadata);
              metaDataReq.onsuccess = function() {
                results.push({
                  id : docInfo.metadata.id,
                  rev : docInfo.metadata.rev
                });
              };
            };
          });
        }
      };
    };


    pouch.changes = function(opts) {
      if (!opts.seq) {
        opts.seq = 0;
      }
      var transaction = db.transaction(["document-store", "sequence-index"]);
      var request = transaction.objectStore('sequence-index')
        .openCursor(IDBKeyRange.lowerBound(opts.seq));
      request.onsuccess = function(event) {
        var cursor = event.target.result;
        if (!cursor) {
          if (opts.continuous) {
            pouch.changes.addListener(opts.onChange);
          }
          if (opts.complete) {
            opts.complete();
          }
        } else {
          var change_ = cursor.value;
          transaction.objectStore('document-store')
            .openCursor(IDBKeyRange.only(change_.id))
            .onsuccess = function(event) {
              var c = {
                id: change_.id,
                seq: change_.seq,
                changes: change_.changes,
                doc: event.value
              };
              opts.onChange(c);
              cursor['continue']();
            };
        }
      };
      request.onerror = function(error) {
        // Cursor is out of range
        // NOTE: What should we do with a sequence that is too high?
        if (opts.continuous) {
          pouch.changes.addListener(opts.onChange);
        }
        call(opts.complete);
      };
    };

    pouch.changes.listeners = [];
    pouch.changes.emit = function() {
      var a = arguments;
      pouch.changes.listeners.forEach(function(l) {
        l.apply(l, a);
      });
    };
    pouch.changes.addListener = function(l) {
      pouch.changes.listeners.push(l);
    };

    return pouch;
  };


  pouch.open = function(name, opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }
    name = 'pouch:' + name;

    if (name in pouchCache) {
      return call(callback, null, pouchCache[name]);
    }

    var req = indexedDB.open(name);

    req.onupgradeneeded = function(e) {
      var db = e.target.result;
      db.createObjectStore(DOC_STORE, {keyPath : 'id'})
        .createIndex('seq', 'seq', {unique : true});
      db.createObjectStore(BY_SEQ_STORE, {autoIncrement : true});
    }

    req.onsuccess = function(e) {

      var db = e.target.result;

      db.onversionchange = function() {
        db.close();
        delete pouchCache[name];
      };

      // polyfill the new onupgradeneeded api for chrome
      if (db.setVersion && Number(db.version) !== POUCH_VERSION) {
        var versionReq = db.setVersion(POUCH_VERSION);
        versionReq.onsuccess = function() {
          req.onupgradeneeded(e);
          req.onsuccess(e);
        };
        return;
      }

      pouchCache[name] = makePouch(db);
      call(callback, null, pouchCache[name]);
    };

    req.onerror = function(e) {
      call(callback, {error: 'open', reason: e.toString()});
    };
  };


  pouch.deleteDatabase = function(name, callback) {

    var req = indexedDB.deleteDatabase('pouch:' + name);

    req.onsuccess = function() {
      call(callback, null);
    };

    req.onerror = function(e) {
      call(callback, {error: 'delete', reason: e.toString()});
    };
  };

}).call(this);