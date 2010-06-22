// BEGIN Math.uuid.js

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

function getObjectStore (db, name, keypath, callback, errBack) {
  if (db.objectStoreNames.contains(name)) {
    callback(db.objectStore(name));
  } else {
    var request = db.createObjectStore(name, keypath);
    request.onsuccess = function (e) {
      callback(e.result)
    }
    request.onerror = function (err) {
      if (errBack) errBack(err);
    }
  }
}

function getNewSequence (transaction, couch, callback) {
  if (couch.seq === undefined) couch.seq = 0;
  var range = moz_indexedDB.makeLeftBoundKeyRange(couch.seq);
  request = transaction.objectStore("sequence-index").openCursor(range);
  var seq = couch.seq;
  request.onsuccess = function (e) {
    var cursor = e.result;
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

function createCouch (options, cb) {
  if (cb) options.success = cb;
  if (!options.name) throw "name attribute is required"
  var request = moz_indexedDB.open(options.name, options.description ? options.description : "a couchdb");
  // Failure handler on getting Database
  request.onerror = function(error) {
    if (options.error) options.error("Failed to open database.");
  }

  request.onsuccess = function(event) {
    var db = event.result;
    getObjectStore(db, 'document-store', '_id', function (documentStore) {
      getObjectStore(db, 'sequence-index', 'seq', function (sequenceIndex) {
        // Now we create the actual CouchDB
        var couch = {
          get: function (_id, options) {
            
          }
          , post: function (doc, options, transaction) {
            if (!doc._id) doc._id = Math.uuid();
            if (couch.docToSeq[doc._id]) {
              if (!doc._rev) {
                options.error({code:413, message:"Update conflict, no revision information"});
              }
              if (!transaction) {
                transaction = db.transaction(["document-store", "sequence-index"],
                                             Components.interfaces.nsIIDBTransaction.READ_WRITE);
                var bulk = false;
              } else {var bulk = true}

              request = transaction.objectStore("document-store")
                .openCursor(moz_indexedDB.makeSingleKeyRange(doc._id));
              request.onsuccess = function (event) {
                var prevDocCursor = event.result;
                var prev = event.result.value;
                if (prev._rev !== doc._rev) {
                  options.error("Conflict error, revision does not match.")
                  return;
                }
                getNewSequence(transaction, couch, function (seq) {
                  var rev = Math.uuid();  
                  request = transaction.objectStore("sequence-index")
                    .openCursor(moz_indexedDB.makeSingleKeyRange(couch.docToSeq[doc._id]));
                  request.onsuccess = function (event) {
                    var oldSequence = event.result.value;
                    if (oldSequence.changes) {
                      oldSequence.changes[event.result.key] = prev
                    } else {
                      oldSequence.changes = {};
                      oldSequence.changes[event.result.key] = prev;
                    }
                    transaction.objectStore("sequence-index").add({seq:seq, id:doc._id, rev:rev, 
                                                                   changes:oldSequence.changes});
                    event.result.remove();
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
                transaction = db.transaction(["document-store", "sequence-index"],
                                             Components.interfaces.nsIIDBTransaction.READ_WRITE);
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
          , docToSeq : {}
          , changes : function (options) {
            if (!options.seq) options.seq = 0;
            var transaction = db.transaction(["document-store", "sequence-index"]);
            var request = transaction.objectStore('sequence-index')
              .openCursor(moz_indexedDB.makeLeftBoundKeyRange(options.seq));
            request.onsuccess = function (event) {
              var cursor = event.result;
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
                  .openCursor(moz_indexedDB.makeSingleKeyRange(change_.id))
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
          , bulk: function (docs, options) {
            var transaction = db.transaction(["document-store", "sequence-index"],
                                             Components.interfaces.nsIIDBTransaction.READ_WRITE);
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
          var cursor = e.result;
          if (!cursor) {
            couch.seq = seq;
            options.success(couch)
            return;
          }
          seq = cursor.key
          couch.docToSeq[cursor.value['id']] = seq;
          cursor.continue();
        }
        request.onerror = function (event) {
          // Assume the database is just empty because the error code is broken
          couch.seq = 0;
          options.success(couch);
        }
        
        
      }, function () {if (options.error) {options.error('Could not open sequence index.')}})
    }, function () {if (options.error) {options.error('Could not open document store.')}})
  }
}

function removeCouch (options) {
  var request = moz_indexedDB.open(options.name, options.description ? options.description : "a couchdb");
  request.onsuccess = function (event) {
    var db = event.result;
    var successes = 0;
    var l = db.objectStoreNames.length;
    for (var i=0;i<db.objectStoreNames.length;i+=1) {
      var r = db.removeObjectStore(db.objectStoreNames[i]);
      r.onsuccess = function (event) {
        successes += 1; 
        if (successes === l) options.success();
      }
      r.onerror = function () { options.error("Failed to remove "+db.objectStoreNames[i]); }
    }
  } 
  request.onerror = function () {
    options.error("No such database "+options.name);
  }
}
