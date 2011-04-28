// BEGIN Math.uuid.js

(function( window, undefined ) {
  
/*!
Math.uuid.js (v1.4)
http://www.broofa.com
mailto:robert@broofa.com

Copyright (c) 2010 Robert Kieffer
Dual licensed under the MIT and GPL licenses.
*/

/*
 * Generate a random uuid.
 *
 * USAGE: Math.uuid(length, radix)
 *   length - the desired number of characters
 *   radix  - the number of allowable values for each character.
 *
 * EXAMPLES:
 *   // No arguments  - returns RFC4122, version 4 ID
 *   >>> Math.uuid()
 *   "92329D39-6F5C-4520-ABFC-AAB64544E172"
 * 
 *   // One argument - returns ID of the specified length
 *   >>> Math.uuid(15)     // 15 character ID (default base=62)
 *   "VcydxgltxrVZSTV"
 *
 *   // Two arguments - returns ID of the specified length, and radix. (Radix must be <= 62)
 *   >>> Math.uuid(8, 2)  // 8 character ID (base=2)
 *   "01001010"
 *   >>> Math.uuid(8, 10) // 8 character ID (base=10)
 *   "47473046"
 *   >>> Math.uuid(8, 16) // 8 character ID (base=16)
 *   "098F4D35"
 */
(function() {
  // Private array of chars to use
  var CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split(''); 

  Math.uuid = function (len, radix) {
    var chars = CHARS, uuid = [];
    radix = radix || chars.length;

    if (len) {
      // Compact form
      for (var i = 0; i < len; i++) uuid[i] = chars[0 | Math.random()*radix];
    } else {
      // rfc4122, version 4 form
      var r;

      // rfc4122 requires these characters
      uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
      uuid[14] = '4';

      // Fill in random data.  At i==19 set the high bits of clock sequence as
      // per rfc4122, sec. 4.1.5
      for (var i = 0; i < 36; i++) {
        if (!uuid[i]) {
          r = 0 | Math.random()*16;
          uuid[i] = chars[(i == 19) ? (r & 0x3) | 0x8 : r];
        }
      }
    }

    return uuid.join('');
  };

  // A more performant, but slightly bulkier, RFC4122v4 solution.  We boost performance
  // by minimizing calls to random()
  Math.uuidFast = function() {
    var chars = CHARS, uuid = new Array(36), rnd=0, r;
    for (var i = 0; i < 36; i++) {
      if (i==8 || i==13 ||  i==18 || i==23) {
        uuid[i] = '-';
      } else if (i==14) {
        uuid[i] = '4';
      } else {
        if (rnd <= 0x02) rnd = 0x2000000 + (Math.random()*0x1000000)|0;
        r = rnd & 0xf;
        rnd = rnd >> 4;
        uuid[i] = chars[(i == 19) ? (r & 0x3) | 0x8 : r];
      }
    }
    return uuid.join('');
  };

  // A more compact, but less performant, RFC4122v4 solution:
  Math.uuidCompact = function() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
      return v.toString(16);
    }).toUpperCase();
  };
})();

// END Math.uuid.js

// The spec is still in flux.
// While most of the IDB behaviors match between implementations a lot of the names still differ.
// This section tries to normalize the different objects & methods.
window.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB;
window.IDBKeyRange = window.IDBKeyRange || window.mozIDBKeyRange || window.webkitIDBKeyRange;
window.IDBTransaction = window.IDBTransaction || window.mozIDBTransaction || window.webkitIDBTransaction;
IDBKeyRange.leftBound = IDBKeyRange.leftBound || IDBKeyRange.lowerBound;
IDBKeyRange.rightBound = IDBKeyRange.rightBound || IDBKeyRange.upperBound;

var getObjectStore = function  (db, name, keypath, callback, errBack) {
  if (db.objectStoreNames.contains(name)) {
    callback(db.transaction(name).objectStore(name));
  } else {
    var version_request = db.setVersion('1');
    version_request.onsuccess = function(event) {

      var request = db.createObjectStore(name, {keyPath: keypath});
      request.onsuccess = function (e) {
        callback(e.target.result)
      }
      request.onerror = function (err) {
        if (errBack) errBack(err);
      }
    };
  }
}

var getNewSequence = function (transaction, couch, callback) {
  if (couch.seq === undefined) couch.seq = 0;
  var range = IDBKeyRange.leftBound(couch.seq);
  request = transaction.objectStore("sequence-index").openCursor(range);
  var seq = couch.seq;
  request.onsuccess = function (e) {
    var cursor = e.target.result;
    if (!cursor) {
      callback(seq + 1);
      return;
    }
    cursor.continue();
    
  }
  request.onerror = function (error) {
    // Sequence index is empty.
    callback(1);
  }
}

var viewQuery = function (objectStore, options) {
  var range;
  var request;
  if (options.startKey && options.endKey) {
    range = IDBKeyRange.bound(options.startKey, options.endKey);
  } else if (options.startKey) {
    if (options.descending) { range = IDBKeyRange.rightBound(options.startKey); }
    else { range = IDBKeyRange.leftBound(options.startKey); }
  } else if (options.endKey) {
    if (options.descending) { range = IDBKeyRange.leftBound(options.endKey); }
    else { range = range = IDBKeyRange.rightBound(options.endKey); }
  }
  if (options.descending) {
    request = objectStore.openCursor(range, "left");
  } else {
    request = objectStore.openCursor(range);
  }
  var results = [];
  request.onsuccess = function (cursor) {
    if (!cursor) {
      if (options.success) options.success(results);
    } else {
      if (options.row) options.row(cursor.target.result.value);
      if (options.success) results.push(cursor.target.results.value);
    }
  }
  request.onerror = function (error) {
    if (options.error) options.error(error);
  }
}

var makeCouch = function (db, documentStore, sequenceIndex, opts) {
  // Now we create the actual CouchDB
  var couch = {docToSeq:{}};
  
  couch.get = function (_id, options) {
    var request = db.transaction('document-store').objectStore('document-store')
                    .openCursor(IDBKeyRange.only(_id));
    request.onsuccess = function (cursor) {
      if (!cursor.target.result) {if (options.error) options.error({error:'Document does not exist'})}
      else { 
        var doc = cursor.target.result.value;
        if (doc._deleted) {
          options.error({error:"Document has been deleted."})
        } else {
          options.success(doc); 
        }
      }
    }
    request.onerror = function (error) {
      if (options.error) options.error(error);
    }
  }
  
  couch.remove = function (doc, options) {
    doc._deleted = true;
    return couch.post(doc, options);
  }
  
  couch.post = function (doc, options, transaction) {
    if (!doc._id) doc._id = Math.uuid();
    if (couch.docToSeq[doc._id]) {
      if (!doc._rev) {
        options.error({code:413, message:"Update conflict, no revision information"});
      }
      if (!transaction) {
        transaction = db.transaction(["document-store", "sequence-index"], IDBTransaction.READ_WRITE);
        var bulk = false;
      } else {var bulk = true}

      var request = transaction.objectStore("document-store")
        .openCursor(IDBKeyRange.only(doc._id));
      request.onsuccess = function (event) {
        var prevDocCursor = event.target.result;
        var prev = event.target.result.value;
        if (prev._rev !== doc._rev) {
          options.error("Conflict error, revision does not match.")
          return;
        }
        getNewSequence(transaction, couch, function (seq) {
          var rev = Math.uuid();  
          var request = transaction.objectStore("sequence-index")
            .openCursor(IDBKeyRange.only(couch.docToSeq[doc._id]));
          request.onsuccess = function (event) {
            var oldSequence = event.target.result.value;
            if (oldSequence.changes) {
              oldSequence.changes[event.target.result.key] = prev
            } else {
              oldSequence.changes = {};
              oldSequence.changes[event.target.result.key] = prev;
            }
            transaction.objectStore("sequence-index").add({seq:seq, id:doc._id, rev:rev, 
                                                           changes:oldSequence.changes});
            event.target.source.delete(event.target.result.key);
            doc._rev = rev;
            prevDocCursor.update(doc);
            if (!bulk) {
              transaction.oncomplete = function () {
                couch.docToSeq[doc._id] = seq;
                couch.seq = seq;
                if (options.success) options.success({id:doc._id, rev:doc._rev, seq:seq, doc:doc});
                couch.changes.emit({id:doc._id, rev:doc._rev, seq:seq, doc:doc});
              }
            } else {
              options.success({id:doc._id, rev:doc._rev, seq:seq, doc:doc})
            }
            
          }
          request.onerror = function (err) {
            if (options.error) options.error("Could not open sequence index")
          }
        })
      }
      request.onerror = function (err) {
        if (options.error) options.error("Could not find document in object store.")
      }
    } else {
      
      if (!transaction) {
        transaction = db.transaction(["document-store", "sequence-index"], IDBTransaction.READ_WRITE);
        var bulk = false;
      } else {var bulk = true}
      
      getNewSequence(transaction, couch, function (seq) {
        doc._rev = Math.uuid();
        transaction.objectStore("sequence-index").add({seq:seq, id:doc._id, rev:doc._rev});
        transaction.objectStore("document-store").add(doc);
        if (!bulk) {
          transaction.oncomplete = function () {
            couch.docToSeq[doc._id] = seq;
            couch.seq = seq;
            if (options.success) options.success({id:doc._id, rev:doc._rev, seq:seq, doc:doc});
            couch.changes.emit({id:doc._id, rev:doc._rev, seq:seq, doc:doc});
          }
        } else {
          options.success({id:doc._id, rev:doc._rev, seq:seq, doc:doc});
        }
      })
    }
  }
  
  couch.changes = function (options) {
    if (!options.seq) options.seq = 0;
    var transaction = db.transaction(["document-store", "sequence-index"]);
    var request = transaction.objectStore('sequence-index')
      .openCursor(IDBKeyRange.leftBound(options.seq));
    request.onsuccess = function (event) {
      var cursor = event.target.result;
      if (!cursor) {
        if (options.continuous) {
          couch.changes.addListener(options.onChange);
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
          }
      }
    }
    request.onerror = function (error) {
      // Cursor is out of range
      // NOTE: What should we do with a sequence that is too high?
      if (options.continuous) {
        couch.changes.addListener(options.onChange);
      }
      if (options.complete) {
        options.complete();
      }
    }
  }
  
  couch.bulk = function (docs, options) {
    var transaction = db.transaction(["document-store", "sequence-index"], IDBTransaction.READ_WRITE);
    var oldSeq = couch.seq;
    var infos = []
    var i = 0;
    var doWrite = function () {
      if (i >= docs.length) {                
        transaction.oncomplete = function () {
          infos.forEach(function (info) {
            if (!info.error) couch.docToSeq[info.id] = info.seq
          })
          options.success(infos);
        }
        return;
      }
      couch.post(docs[i], {
        success : function (info) {
          couch.seq += 1;
          i += 1;
          infos.push(info);
          doWrite();
        }
        , error : function (error) {
          if (options.ensureFullCommit) {
            transaction.abort();
            couch.seq = oldSeq;
            options.error(error);
            return;
          }
          infos.push({id:doc[i]._id, error:"conflict", reason:error});
          i += 1;
          doWrite();
        }
      }, transaction);
      
    };
    doWrite();
  }
  
  couch.changes.listeners = [];
  couch.changes.emit = function () {
    var a = arguments;
    couch.changes.listeners.forEach(function (l) {l.apply(l, a)});
  }
  couch.changes.addListener = function (l) { couch.changes.listeners.push(l); }
  
  var request = sequenceIndex.openCursor();
  var seq;
  request.onsuccess = function (e) {
    // Handle iterating on the sequence index to create the reverse map and validate last-seq
    var cursor = e.target.result;
    if (!cursor) {
      couch.seq = seq;
      opts.success(couch)
      return;
    }
    seq = cursor.key
    couch.docToSeq[cursor.value['id']] = seq;
    cursor.continue();
  }
  request.onerror = function (event) {
    opts.error({error:"Couldn't iterate over the by-sequence index."});
  }
}

window.createCouch = function (options, cb) {
  if (cb) options.success = cb;
  if (!options.name) throw "name attribute is required"
  var request = indexedDB.open(options.name);
  // Failure handler on getting Database
  request.onerror = function(error) {
    if (options.error) options.error("Failed to open database.");
  }

  request.onsuccess = function(event) {
    var db = event.target.result;
    getObjectStore(db, 'document-store', '_id', function (documentStore) {
      getObjectStore(db, 'sequence-index', 'seq', function (sequenceIndex) {
        makeCouch(db, documentStore, sequenceIndex, options);
      }, function () {if (options.error) {options.error('Could not open sequence index.')}})
    }, function () {if (options.error) {options.error('Could not open document store.')}})
  }
}

window.removeCouch = function (options) {
  var request = indexedDB.open(options.name);
  request.onsuccess = function (event) {
    var db = event.target.result;
    var successes = 0;
    var l = db.objectStoreNames.length;
    for (var i=0;i<db.objectStoreNames.length;i+=1) {
      db.objectStoreNames[i]
      var version_request = db.setVersion('1');
      version_request.onsuccess = function(event) {
        var r = db.deleteObjectStore(db.objectStoreNames[i]);
      
        r.onsuccess = function (event) {
          successes += 1; 
          if (successes === l) options.success();
        }
        r.onerror = function () { options.error("Failed to remove "+db.objectStoreNames[i]); }
      }
    }
  } 
  request.onerror = function () {
    options.error("No such database "+options.name);
  }
}

})(window);
