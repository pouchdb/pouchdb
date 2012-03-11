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

  // Enumerate errors, add the status code so we can reflect the HTTP api
  // in future
  var Errors = {
    MISSING_DOC: {
      status: 404,
      error: 'not_found',
      reason: 'missing'
    },
    REV_CONFLICT: {
      status: 409,
      error: 'conflict',
      reason: 'Document update conflict'
    }
  };

  var ajax = function (options, callback) {
    options.success = function (obj) {
      callback(null, obj);
    };
    options.error = function (err) {
      if (err) callback(err);
      else callback(true);
    };
    options.dataType = 'json';
    options.contentType = 'application/json';
    $.ajax(options);
  };

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
  var makePouch = function(idb) {

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
    var db = {update_seq: 0};

    // First we look up the metadata in the ids database, then we fetch the
    // current revision(s) from the by sequence store
    db.get = function(id, opts, callback) {
      if (opts instanceof Function) {
        callback = opts;
        opts = {};
      }

      var req = idb.transaction([DOC_STORE], IDBTransaction.READ)
        .objectStore(DOC_STORE).get(id);

      req.onsuccess = function(e) {
        var metadata = e.target.result;
        if (!e.target.result || metadata.deleted) {
          return call(callback, Errors.MISSING_DOC);
        }

        var nreq = idb.transaction([BY_SEQ_STORE], IDBTransaction.READ)
          .objectStore(BY_SEQ_STORE).get(metadata.seq);
        nreq.onsuccess = function(e) {
          var doc = e.target.result;
          doc._id = metadata.id;
          doc._rev = metadata.rev;
          if (opts.revs_info) {
            doc._revs_info = metadata.revisions.ids.map(function(rev, i) {
              // we dont compact, so it kinda has to be, but need to properly
              // check in future
              return {rev: (i + 1) + '-' + rev, status: 'available'};
            });
          }
          callback(null, doc);
        };
      };
    };

    db.remove = function(doc, opts, callback) {
      if (opts instanceof Function) {
        callback = opts;
        opts = {};
      }
      doc._deleted = true;
      return db.bulkDocs({docs: [doc]}, opts, singularErr(callback));
    };

    db.put = db.post = function(doc, opts, callback) {
      if (opts instanceof Function) {
        callback = opts;
        opts = {};
      }
      return db.bulkDocs({docs: [doc]}, opts, singularErr(callback));
    };

    db.bulkDocs = function(req, opts, callback) {
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

      var txn = idb.transaction([DOC_STORE, BY_SEQ_STORE],
                               IDBTransaction.READ_WRITE);
      var results = [];

      txn.oncomplete = function(event) {
        results.forEach(function(result) {
          db.changes.emit(result);
        });
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

      var writeDoc = function(docInfo, callback) {
        var dataReq = txn.objectStore(BY_SEQ_STORE).put(docInfo.data);
        dataReq.onsuccess = function(e) {
          docInfo.metadata.seq = e.target.result;
          var metaDataReq = txn.objectStore(DOC_STORE).put(docInfo.metadata);
          metaDataReq.onsuccess = function() {
            results.push({
              id : docInfo.metadata.id,
              rev : docInfo.metadata.rev
            });
            call(callback);
          };
        };
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
          var revs = cursor.value.revisions.ids;
          // Currently ignoring the revision sequence number, we shouldnt do that
          if (revs[0] !== docInfo.metadata.revisions.ids[1]) {
            results.push(Errors.REV_CONFLICT);
            return cursor['continue']();
          }
          // Start of rev merging, for now we just keep a linear history
          // of revisions
          revs.shift();
          revs.forEach(function(rev) {
            docInfo.metadata.revisions.ids.push(rev);
          });
          writeDoc(docInfo, function() {
            cursor['continue']();
          });
        } else {
          // Cursor has exceeded the key range so the rest are inserts
          buckets.forEach(function(bucket) {
            // TODO: merge the bucket revs into a rev tree
            var docInfo = bucket[0];
            if (docInfo.metadata.deleted) {
              results.push(Errors.MISSING_DOC);
              return;
            }
            writeDoc(docInfo);
          });
        }
      };
    };


    db.changes = function(opts) {
      if (!opts.seq) {
        opts.seq = 0;
      }
      var transaction = idb.transaction([DOC_STORE, BY_SEQ_STORE]);
      var request = transaction.objectStore(BY_SEQ_STORE)
        .openCursor(IDBKeyRange.lowerBound(opts.seq));
      request.onsuccess = function(event) {
        var cursor = event.target.result;
        if (!cursor) {
          if (opts.continuous) {
            db.changes.addListener(opts.onChange);
          }
          if (opts.complete) {
            opts.complete();
          }
        } else {
          var index = transaction.objectStore(DOC_STORE).index('seq');
          index.get(cursor.key).onsuccess = function(event) {
            var doc = event.target.result;
            var c = {
              id: doc.id,
              seq: cursor.key,
              changes: doc.revisions.ids
            };
            if (opts.include_doc) {
              c.doc = cursor.value;
            }
            opts.onChange(c);
            cursor['continue']();
          };
        }
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

    db.changes.listeners = [];
    db.changes.emit = function() {
      var a = arguments;
      db.changes.listeners.forEach(function(l) {
        l.apply(l, a);
      });
    };
    db.changes.addListener = function(l) {
      db.changes.listeners.push(l);
    };

    db.replicate = {};

    db.replicate.from = function (url, opts, callback) {
      if (opts instanceof Function) {
        callback = opts;
        opts = {};
      }

      var c = [];
      var ajaxOpts = {url: url+'_changes?style=all_docs&include_docs=true'};

      ajax(ajaxOpts, function(e, resp) {
        if (e) {
          return call(callback, {error: 'borked'});
        }
        var pending = resp.results.length;

        resp.results.forEach(function(r) {

          var writeDoc = function(r) {
            db.post(r.doc, {newEdits: false}, function(err, changeset) {
              pending--;
              if (err) {
                pending--;
                r.error = e;
                c.push(r);
              } else {
                c.changeset = changeset;
                c.push(r);
              }
              if (pending === 0) {
                call(callback, null, c);
              }
            });
          };
          db.get(r.id, function(err, doc) {
            if (err) {
              return writeDoc(r);
            }
            if (doc._rev === r.changes[0].rev) {
              return;
            } else {
              var oldseq = parseInt(doc._rev.split('-')[0], 10);
              var newseq = parseInt(r.changes[0].rev.split('-')[0], 10);
              if (oldseq <= newseq) {
                writeDoc(r);
              }
            }
          });
        });
      });
    };

    return db;
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
    };

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