


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

function getObjectStore (db, name, desc, callback, errBack) {
  if (db.objectStoreNames.contains(name)) {
    callback(db.objectStore(name));
  } else {
    var request = db.createObjectStore(name, desc);
    request.onsuccess = function (e) {
      callback(e.value)
    }
    request.onerror = function (err) {
      if (errBack) errBack(err);
    }
  }
}

function getNewSequence (transaction, couch, callback) {
  var range = moz_indexedDB.makeRightBoundKeyRange(couch.seq);
  request = transaction.objectStore("sequence-index").openCursor(range);
  var seq;
  request.onsuccess = function (e) {
    var cursor = e.result;
    if (!cursor) {
      //console.log(seq)
      callback(seq + 1)
    }
    cursor.continue();
  }
  request.onerror = function () {
    // Sequence index is empty.
    callback(1);
  }
}

var MAXINT = 999999999999999999999999999999999999;

function createCouch (options, cb) {
  if (cb) options.success = cb;
  if (!options.name) throw "name attribute is required"
  var request = moz_indexedDB.open(options.name, options.description ? options.description : "a couchdb");
  // Failure handler on getting Database
  request.onerror = function(error) {
    if (options.error) {
      if (error) options.error(error)
      else options.error("Failed to open database.")
    }
  }
  //console.log(request)
  request.onsuccess = function(event) {
    var db = event.result;
    //console.log(db);
    getObjectStore(db, 'document-store', 'Document Store.', function (documentStore) {
      //console.log(documentStore);
      getObjectStore(db, 'sequence-index', 'Sequence Index', function (sequenceIndex) {
        //console.log(sequenceIndex);
        
        // Now we create the actual CouchDB
        var couch = {
          get: function (_id, options) {
            
          }
          , post: function (doc, options) {
            if (!doc._id) doc._id = Math.uuid();
            if (couch.docToSeq[doc._id]) {
              if (!doc._rev) {
                options.error({code:413, message:"Update conflict, no revision information"});
              }
              var transaction = db.transcation(["document-store", "sequence-index"]);
              request = transaction.objectStore("document-store").openCursor(new KeyRange.only(doc._id));
              request.onsuccess = function (event) {
                var cursor = event.value;
                //console.log(cursor.value);
                throw "Write more code."
              }
            } else {
              var transaction = db.transaction(["document-store", "sequence-index"]);
              alert('before')
              getNewSequence(transaction, couch, function (seq) {
                doc._rev = Math.uuid();
                alert(seq)
                transaction.objectStore("sequence-index").add(seq, {seq:seq, id:doc._id});
                transaction.objectStore("document-store").add(doc._id, doc);
                transaction.oncomplete = function () {
                  alert('complete')
                  couch.docToSeq[doc._id] = seq;
                  couch.seq = seq;
                  if (options.success) options.success({id:doc._id, rev:doc._rev, seq:seq});
                }
              })
            }
          }
          , docToSeq : {}
        }
       

        var request = sequenceIndex.openCursor()
        request.onsuccess = function (event) {
          // Handle iterating on the sequence index to create the reverse map and validate last-seq
          options.error('I need more code');
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

