// The spec is still in flux.
// While most of the IDB behaviors match between implementations a lot of the names still differ.
// This section tries to normalize the different objects & methods.
window.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB;
window.IDBCursor = window.IDBCursor || window.webkitIDBCursor;
window.IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange;
window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction;
window.IDBDatabaseException = window.IDBDatabaseException || window.webkitIDBDatabaseException;

var parseDoc = function (doc, newEdits) {
  if (newEdits) {
    if (!doc._id) {
      doc._id = Math.uuid();
    }
    var newRevId = Math.uuid(32, 16);
    if (doc._rev) {
      var revInfo = /^(\d+)-(.+)$/.exec(doc._rev);
      if (!revInfo) throw "invalid value for property '_rev'";
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
    if (!doc._revisions) throw "missing property '_revisions'";
    if (!isFinite(doc._revisions.start))
      throw "property '_revisions.start' must be a number";
    if (Array.isArray(doc._revisions) && doc._revisions.length > 0)
      throw "property '_revisions.id' must be a non-empty array";
  }
  doc._id = decodeURIComponent(doc._id);
  doc._rev = [doc._revisions.start, doc._revisions.ids[0]].join('-');
  return Object.keys(doc).reduce(function (acc, key) {
    if (/^_/.test(key))
      acc.metadata[key.slice(1)] = doc[key];
    else
      acc.data[key] = doc[key];
    return acc;
  }, {metadata : {}, data : {}});
};


var compareRevs = function (a, b) {
  if (a.id == b.id) { // Sort by id
    if (a.deleted ^ b.deleted) {
      return (a.deleted ? -1 : 1); // Then by deleted
    } else {
      if (a.revisions.start == b.revisions.start) // Then by depth of edits
        return (a.revisions.ids < b.revisions.ids ? -1 : 1); // Then by rev id
      else
        return (a.revisions.start < b.revisions.start ? -1 : 1);
    }
  } else {
    return (a.id < b.id ? -1 : 1);
  }
};


var makePouch = function (db) {

  // Now we create the PouchDB interface
  var pouch = {update_seq: 0};

  pouch.get = function (id, options, callback) {
    if (options instanceof Function) {
      callback = options;
      options = {};
    }
    var req = db.transaction(['ids'], IDBTransaction.READ).objectStore('ids').get(id);
    var notexists = function() {
      callback({
        error: true,
        message: "Document does not exist"
      });
    };
    req.onsuccess = function(e) {
      if (!e.target.result) {
        notexists();
      } else {
        var metadata = e.target.result;
        if (metadata.deleted) {
          return notexists();
        }
        var nreq = db.transaction(['revs'], IDBTransaction.READ)
          .objectStore('revs').get(metadata.seq);
        nreq.onsuccess = function(e) {
          var doc = e.target.result;
          doc._id = metadata.id;
          doc._rev = metadata.rev;
          callback(null, doc);
        }
      }
    }

  };

  pouch.remove = function (doc, options, callback) {
    if (options instanceof Function) {
      callback = options;
      options = {};
    }
    options = options || {};
    doc._deleted = true;
    return pouch.bulkDocs({docs: [doc]}, options, function(err, results) {
      if (err || results[0].error) {
        if (callback) callback(err || results[0]);
      } else {
        if (callback) callback(null, results[0]);
      }
    });
  };

  pouch.put = pouch.post = function (doc, options, callback) {
    if (options instanceof Function) {
      callback = options;
      options = {};
    }
    options = options || {};
    pouch.bulkDocs({docs : [doc]}, options, function (err, results) {
      if (err || results[0].error) {
        if (callback) callback(err || results[0].error);
      } else {
        if (callback) callback(null, results[0]);
      }
    });
  };

  pouch.bulkDocs = function (req, options, callback) {
    if (options instanceof Function) {
      callback = options;
      options = {};
    }
    options = options || {};

    var newEdits = 'new_edits' in options ? options._new_edits : true;

    // Parse and sort the docs
    var docInfos = req.docs.map(function (doc) {
      return parseDoc(doc, newEdits);
    });

    docInfos.sort(function (a, b) {
      return compareRevs(a.metadata, b.metadata);
    });

    var keyRange = IDBKeyRange.bound(
      docInfos[0].metadata.id, docInfos[docInfos.length-1].metadata.id,
      false, false);

    // This groups edits to the same document together
    var buckets = docInfos.reduce(function (acc, docInfo) {
      if (docInfo.metadata.id === acc[0][0].metadata.id) {
        acc[0].push(docInfo);
      } else {
        acc.unshift([docInfo]);
      }
      return acc;
    }, [[docInfos.shift()]]);

    var txn = db.transaction(['ids', 'revs'], IDBTransaction.READ_WRITE);
    var results = [];

    txn.oncomplete = function (event) {
      if (callback) {
        callback(null, results);
      }
    };

    txn.onerror = function (event) {
      if (callback) {
        var code = event.target.errorCode;
        var message = Object.keys(IDBDatabaseException)[code].toLowerCase();
        callback({
          error : event.type,
          reason : message
        });
      }
    };

    txn.ontimeout = function (event) {
      if (callback) {
        var code = event.target.errorCode;
        var message = Object.keys(IDBDatabaseException)[code].toLowerCase();
        callback({
          error : event.type,
          reason : message
        });
      }
    };

    var cursReq = txn.objectStore('ids').openCursor(keyRange, IDBCursor.NEXT);

    cursReq.onsuccess = function (event) {
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
        if (revisions[revisions.length - 1] !==  docInfo.metadata.revisions.ids[1]) {
          results.push({
            error: true,
            message: 'Invalid rev'
          });
          return cursor.continue();
        }
        var dataRequest = txn.objectStore('revs').put(docInfo.data);
        dataRequest.onsuccess = function (event) {
          docInfo.metadata.seq = event.target.result;
          var metaDataRequest = txn.objectStore('ids').put(docInfo.metadata);
          metaDataRequest.onsuccess = function (event) {
            results.push({
              id : docInfo.metadata.id,
              rev : docInfo.metadata.rev
            });
            cursor.continue();
          };
        };
      } else {
        // Cursor has exceeded the key range so the rest are inserts
        buckets.forEach(function (bucket) {
          // TODO: merge the bucket revs into a rev tree
          var docInfo = bucket[0];
          if (docInfo.metadata.deleted) {
            results.push({
              error: true,
              message: 'Can only delete things that exist'
            });
            return;
          }
          var dataRequest = txn.objectStore('revs').add(docInfo.data);
          dataRequest.onsuccess = function (event) {
            docInfo.metadata.seq = event.target.result;
            var metaDataRequest = txn.objectStore('ids').add(docInfo.metadata);
            metaDataRequest.onsuccess = function (event) {
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


  pouch.changes = function (options) {
    if (!options.seq) options.seq = 0;
    var transaction = db.transaction(["document-store", "sequence-index"]);
    var request = transaction.objectStore('sequence-index')
      .openCursor(IDBKeyRange.lowerBound(options.seq));
    request.onsuccess = function (event) {
      var cursor = event.target.result;
      if (!cursor) {
        if (options.continuous) {
          pouch.changes.addListener(options.onChange);
        }
        if (options.complete) {
          options.complete();
        }
      } else {
        var change_ = cursor.value;
        transaction.objectStore('document-store')
          .openCursor(IDBKeyRange.only(change_.id))
          .onsuccess = function (event) {
            var c = {id:change_.id, seq:change_.seq, changes:change_.changes, doc:event.value};
            options.onChange(c);
            cursor.continue();
          };
      }
    };
    request.onerror = function (error) {
      // Cursor is out of range
      // NOTE: What should we do with a sequence that is too high?
      if (options.continuous) {
        pouch.changes.addListener(options.onChange);
      }
      if (options.complete) {
        options.complete();
      }
    };
  };

  pouch.changes.listeners = [];
  pouch.changes.emit = function () {
    var a = arguments;
    pouch.changes.listeners.forEach(function (l) {
      l.apply(l, a);
    });
  };
  pouch.changes.addListener = function (l) {
    pouch.changes.listeners.push(l);
  };

  return pouch;
};


var POUCH_VERSION = 1;
var pouchCache = {};

pouch = {};
pouch.open = function (name, options, callback) {
  if (options instanceof Function) {
    callback = options;
    options = {};
  }
  options = options || {};

  name = 'pouch:' + name;
  if (name in pouchCache) {
    if (callback) {
      callback(null, pouchCache[name]);
    }
    return;
  }

  var request = indexedDB.open(name);

  request.onupgradeneeded = function(event) {
    var db = event.target.result;
    db.createObjectStore('ids', {keyPath : 'id'})
      .createIndex('seq', 'seq', {unique : true});
    db.createObjectStore('revs', {autoIncrement : true});
  }

  request.onsuccess = function(event) {

    var db = event.target.result;

    db.onversionchange = function(event) {
      console.log("Closing!");
      db.close();
      delete pouchCache[name];
    };

    // polyfill the new onupgradeneeded api for chrome
    if(db.setVersion && Number(db.version) !== POUCH_VERSION) {
      var versionRequest = db.setVersion(POUCH_VERSION);
      versionRequest.onsuccess = function () {
        request.onupgradeneeded(event);
        request.onsuccess(event);
      };
      return;
    }

    pouchCache[name] = makePouch(db);
    if (callback)
      callback(null, pouchCache[name]);
  };

  request.onerror = function(event) {
    if (callback) {
      callback({
        error : 'open',
        reason : error.toString()
      });
    }
  };
};

pouch.deleteDatabase = function (name, callback) {

  var request = indexedDB.deleteDatabase('pouch:' + name);

  request.onsuccess = function (event) {
    callback(null);
  };

  request.onerror = function (event) {
    callback({
      error: 'delete',
      reason: event.toString
    });
  };
};