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

/**
*
*  MD5 (Message-Digest Algorithm)
*
*  For original source see http://www.webtoolkit.info/
*  Download: 15.02.2009 from http://www.webtoolkit.info/javascript-md5.html
*
*  Licensed under CC-BY 2.0 License
*  (http://creativecommons.org/licenses/by/2.0/uk/)
*
**/

var Crypto = {};
(function() {
  Crypto.MD5 = function(string) {

    function RotateLeft(lValue, iShiftBits) {
      return (lValue<<iShiftBits) | (lValue>>>(32-iShiftBits));
    }

    function AddUnsigned(lX,lY) {
      var lX4,lY4,lX8,lY8,lResult;
      lX8 = (lX & 0x80000000);
      lY8 = (lY & 0x80000000);
      lX4 = (lX & 0x40000000);
      lY4 = (lY & 0x40000000);
      lResult = (lX & 0x3FFFFFFF)+(lY & 0x3FFFFFFF);
      if (lX4 & lY4) {
        return (lResult ^ 0x80000000 ^ lX8 ^ lY8);
      }
      if (lX4 | lY4) {
        if (lResult & 0x40000000) {
          return (lResult ^ 0xC0000000 ^ lX8 ^ lY8);
        } else {
          return (lResult ^ 0x40000000 ^ lX8 ^ lY8);
        }
      } else {
        return (lResult ^ lX8 ^ lY8);
      }
    }

    function F(x,y,z) { return (x & y) | ((~x) & z); }
    function G(x,y,z) { return (x & z) | (y & (~z)); }
    function H(x,y,z) { return (x ^ y ^ z); }
    function I(x,y,z) { return (y ^ (x | (~z))); }

    function FF(a,b,c,d,x,s,ac) {
      a = AddUnsigned(a, AddUnsigned(AddUnsigned(F(b, c, d), x), ac));
      return AddUnsigned(RotateLeft(a, s), b);
    };

    function GG(a,b,c,d,x,s,ac) {
      a = AddUnsigned(a, AddUnsigned(AddUnsigned(G(b, c, d), x), ac));
      return AddUnsigned(RotateLeft(a, s), b);
    };

    function HH(a,b,c,d,x,s,ac) {
      a = AddUnsigned(a, AddUnsigned(AddUnsigned(H(b, c, d), x), ac));
      return AddUnsigned(RotateLeft(a, s), b);
    };

    function II(a,b,c,d,x,s,ac) {
      a = AddUnsigned(a, AddUnsigned(AddUnsigned(I(b, c, d), x), ac));
      return AddUnsigned(RotateLeft(a, s), b);
    };

    function ConvertToWordArray(string) {
      var lWordCount;
      var lMessageLength = string.length;
      var lNumberOfWords_temp1=lMessageLength + 8;
      var lNumberOfWords_temp2=(lNumberOfWords_temp1-(lNumberOfWords_temp1 % 64))/64;
      var lNumberOfWords = (lNumberOfWords_temp2+1)*16;
      var lWordArray=Array(lNumberOfWords-1);
      var lBytePosition = 0;
      var lByteCount = 0;
      while ( lByteCount < lMessageLength ) {
        lWordCount = (lByteCount-(lByteCount % 4))/4;
        lBytePosition = (lByteCount % 4)*8;
        lWordArray[lWordCount] = (lWordArray[lWordCount] | (string.charCodeAt(lByteCount)<<lBytePosition));
        lByteCount++;
      }
      lWordCount = (lByteCount-(lByteCount % 4))/4;
      lBytePosition = (lByteCount % 4)*8;
      lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80<<lBytePosition);
      lWordArray[lNumberOfWords-2] = lMessageLength<<3;
      lWordArray[lNumberOfWords-1] = lMessageLength>>>29;
      return lWordArray;
    };

    function WordToHex(lValue) {
      var WordToHexValue="",WordToHexValue_temp="",lByte,lCount;
      for (lCount = 0;lCount<=3;lCount++) {
        lByte = (lValue>>>(lCount*8)) & 255;
        WordToHexValue_temp = "0" + lByte.toString(16);
        WordToHexValue = WordToHexValue + WordToHexValue_temp.substr(WordToHexValue_temp.length-2,2);
      }
      return WordToHexValue;
    };

    //**	function Utf8Encode(string) removed. Aready defined in pidcrypt_utils.js

    var x=Array();
    var k,AA,BB,CC,DD,a,b,c,d;
    var S11=7, S12=12, S13=17, S14=22;
    var S21=5, S22=9 , S23=14, S24=20;
    var S31=4, S32=11, S33=16, S34=23;
    var S41=6, S42=10, S43=15, S44=21;

    //	string = Utf8Encode(string); #function call removed

    x = ConvertToWordArray(string);

    a = 0x67452301; b = 0xEFCDAB89; c = 0x98BADCFE; d = 0x10325476;

    for (k=0;k<x.length;k+=16) {
      AA=a; BB=b; CC=c; DD=d;
      a=FF(a,b,c,d,x[k+0], S11,0xD76AA478);
      d=FF(d,a,b,c,x[k+1], S12,0xE8C7B756);
      c=FF(c,d,a,b,x[k+2], S13,0x242070DB);
      b=FF(b,c,d,a,x[k+3], S14,0xC1BDCEEE);
      a=FF(a,b,c,d,x[k+4], S11,0xF57C0FAF);
      d=FF(d,a,b,c,x[k+5], S12,0x4787C62A);
      c=FF(c,d,a,b,x[k+6], S13,0xA8304613);
      b=FF(b,c,d,a,x[k+7], S14,0xFD469501);
      a=FF(a,b,c,d,x[k+8], S11,0x698098D8);
      d=FF(d,a,b,c,x[k+9], S12,0x8B44F7AF);
      c=FF(c,d,a,b,x[k+10],S13,0xFFFF5BB1);
      b=FF(b,c,d,a,x[k+11],S14,0x895CD7BE);
      a=FF(a,b,c,d,x[k+12],S11,0x6B901122);
      d=FF(d,a,b,c,x[k+13],S12,0xFD987193);
      c=FF(c,d,a,b,x[k+14],S13,0xA679438E);
      b=FF(b,c,d,a,x[k+15],S14,0x49B40821);
      a=GG(a,b,c,d,x[k+1], S21,0xF61E2562);
      d=GG(d,a,b,c,x[k+6], S22,0xC040B340);
      c=GG(c,d,a,b,x[k+11],S23,0x265E5A51);
      b=GG(b,c,d,a,x[k+0], S24,0xE9B6C7AA);
      a=GG(a,b,c,d,x[k+5], S21,0xD62F105D);
      d=GG(d,a,b,c,x[k+10],S22,0x2441453);
      c=GG(c,d,a,b,x[k+15],S23,0xD8A1E681);
      b=GG(b,c,d,a,x[k+4], S24,0xE7D3FBC8);
      a=GG(a,b,c,d,x[k+9], S21,0x21E1CDE6);
      d=GG(d,a,b,c,x[k+14],S22,0xC33707D6);
      c=GG(c,d,a,b,x[k+3], S23,0xF4D50D87);
      b=GG(b,c,d,a,x[k+8], S24,0x455A14ED);
      a=GG(a,b,c,d,x[k+13],S21,0xA9E3E905);
      d=GG(d,a,b,c,x[k+2], S22,0xFCEFA3F8);
      c=GG(c,d,a,b,x[k+7], S23,0x676F02D9);
      b=GG(b,c,d,a,x[k+12],S24,0x8D2A4C8A);
      a=HH(a,b,c,d,x[k+5], S31,0xFFFA3942);
      d=HH(d,a,b,c,x[k+8], S32,0x8771F681);
      c=HH(c,d,a,b,x[k+11],S33,0x6D9D6122);
      b=HH(b,c,d,a,x[k+14],S34,0xFDE5380C);
      a=HH(a,b,c,d,x[k+1], S31,0xA4BEEA44);
      d=HH(d,a,b,c,x[k+4], S32,0x4BDECFA9);
      c=HH(c,d,a,b,x[k+7], S33,0xF6BB4B60);
      b=HH(b,c,d,a,x[k+10],S34,0xBEBFBC70);
      a=HH(a,b,c,d,x[k+13],S31,0x289B7EC6);
      d=HH(d,a,b,c,x[k+0], S32,0xEAA127FA);
      c=HH(c,d,a,b,x[k+3], S33,0xD4EF3085);
      b=HH(b,c,d,a,x[k+6], S34,0x4881D05);
      a=HH(a,b,c,d,x[k+9], S31,0xD9D4D039);
      d=HH(d,a,b,c,x[k+12],S32,0xE6DB99E5);
      c=HH(c,d,a,b,x[k+15],S33,0x1FA27CF8);
      b=HH(b,c,d,a,x[k+2], S34,0xC4AC5665);
      a=II(a,b,c,d,x[k+0], S41,0xF4292244);
      d=II(d,a,b,c,x[k+7], S42,0x432AFF97);
      c=II(c,d,a,b,x[k+14],S43,0xAB9423A7);
      b=II(b,c,d,a,x[k+5], S44,0xFC93A039);
      a=II(a,b,c,d,x[k+12],S41,0x655B59C3);
      d=II(d,a,b,c,x[k+3], S42,0x8F0CCC92);
      c=II(c,d,a,b,x[k+10],S43,0xFFEFF47D);
      b=II(b,c,d,a,x[k+1], S44,0x85845DD1);
      a=II(a,b,c,d,x[k+8], S41,0x6FA87E4F);
      d=II(d,a,b,c,x[k+15],S42,0xFE2CE6E0);
      c=II(c,d,a,b,x[k+6], S43,0xA3014314);
      b=II(b,c,d,a,x[k+13],S44,0x4E0811A1);
      a=II(a,b,c,d,x[k+4], S41,0xF7537E82);
      d=II(d,a,b,c,x[k+11],S42,0xBD3AF235);
      c=II(c,d,a,b,x[k+2], S43,0x2AD7D2BB);
      b=II(b,c,d,a,x[k+9], S44,0xEB86D391);
      a=AddUnsigned(a,AA);
      b=AddUnsigned(b,BB);
      c=AddUnsigned(c,CC);
      d=AddUnsigned(d,DD);
    }
    var temp = WordToHex(a)+WordToHex(b)+WordToHex(c)+WordToHex(d);
    return temp.toLowerCase();
  }
})();

// END Crypto.md5.js

// Begin request *requires jQuery*

var ajax = function (options, callback) {
  options.success = function (obj) {
    callback(null, obj);
  }
  options.error = function (err) {
    if (err) callback(err);
    else callback(true);
  }
  options.dataType = 'json';
  options.contentType = 'application/json'
  $.ajax(options)
}

// End request

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
    var newRevId = Math.uuid(32, 16);
    if (doc._rev) {
      var revInfo = /^(\d+)-(.+)$/.exec(doc._rev);
      if (!revInfo) throw "invalid value for property '_rev'";
      doc._revisions = {
        start : parseInt(revInfo[1]) + 1
      , ids : [newRevId, revInfo[2]]
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
}

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
}

var viewQuery = function (objectStore, options) {
  var range;
  var request;
  if (options.startKey && options.endKey) {
    range = IDBKeyRange.bound(options.startKey, options.endKey);
  } else if (options.startKey) {
    if (options.descending) { range = IDBKeyRange.upperBound(options.startKey); }
    else { range = IDBKeyRange.lowerBound(options.startKey); }
  } else if (options.endKey) {
    if (options.descending) { range = IDBKeyRange.lowerBound(options.endKey); }
    else { range = range = IDBKeyRange.upperBound(options.endKey); }
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

var makePouch = function (db) {
  // Now we create the PouchDB interface
  var pouch = {update_seq: 0};

  pouch.get = function (id, options, callback) {
    options.error('not implemented');
  }

  pouch.remove = function (id, options) {
    doc._deleted = true;
    return pouch.bulkDocs(doc, options);
  }

  pouch.put = pouch.post = function (doc, options, callback) {
    if (options instanceof Function) {
      callback = options;
      options = {};
    }
    options = options || {};

    if (!doc._id) doc._id = Math.uuid();
    pouch.bulkDocs({docs : [doc]}, options, function (err, results) {
      if (err) {
        if (callback) callback(err);
      } else {
        if (callback) callback(null, results[0]);
      }
    });
  }

  pouch.bulkDocs = function (req, options, callback) {
    if (options instanceof Function) {
      callback = options;
      options = {};
    }
    options = options || {};

    var docs = req.docs;
    if (!docs) {
      if (callback) callback(null, []);
      return;
    }

    var newEdits = 'new_edits' in options ? options._new_edits : true;

    // Parse and sort the docs
    var docInfos = docs.map(function (doc) {
      return parseDoc(doc, newEdits);
    });
    docInfos.sort(function (a, b) {return compareRevs(a.metadata, b.metadata)});

    var keyRange = IDBKeyRange.bound(
      docInfos[0].metadata.id, docInfos[docInfos.length-1].metadata.id,
      false, false);

    var buckets = docInfos.reduce(function (acc, docInfo) {
      if (docInfo.metadata._id == acc[0][0].metadata._id)
        acc[0].push(docInfo);
      else
        acc.unshift([docInfo]);
      return acc;
    }, [[docInfos.shift()]]);

    var txn = db.transaction(['ids', 'revs'], IDBTransaction.READ_WRITE)
      , results = [];

    txn.oncomplete = function (event) {
      if (callback) callback(null, results);
    };

    txn.onerror = function (event) {
      if (callback) {
        var code = event.target.errorCode;
        var message = Object.keys(IDBDatabaseException)[code].toLowerCase();
        callback({
          error : event.type
        , reason : message
        });
      }
    }

    txn.ontimeout = function (event) {
      if (callback) {
        var code = event.target.errorCode;
        var message = Object.keys(IDBDatabaseException)[code].toLowerCase();
        callback({
          error : event.type
        , reason : message
        });
      }
    }

    var cursReq = txn.objectStore('ids').openCursor(keyRange, IDBCursor.NEXT)
    cursReq.onsuccess = function (event) {
      var cursor = event.target.result;
      if (cursor) {
        // TODO: Accumulate a bucket by merging rev trees
        console.log("Document updating needs implementing ASAP!!");
        cursor.continue();
      } else {
        // Cursor has exceeded the key range so the rest are inserts
        buckets.forEach(function (bucket) {
          // TODO: merge the bucket revs into a rev tree
          var docInfo = bucket[0];
          var dataRequest = txn.objectStore('revs').add(docInfo.data)
          dataRequest.onsuccess = function (event) {
            docInfo.metadata.seq = event.target.result;
            var metaDataRequest = txn.objectStore('ids').add(docInfo.metadata)
            metaDataRequest.onsuccess = function (event) {
              results.push({
                id : docInfo.metadata.id
              , rev : docInfo.metadata.rev
              });
            };
          };
        });
      }
    }
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
          }
      }
    }
    request.onerror = function (error) {
      // Cursor is out of range
      // NOTE: What should we do with a sequence that is too high?
      if (options.continuous) {
        pouch.changes.addListener(options.onChange);
      }
      if (options.complete) {
        options.complete();
      }
    }
  }

  pouch.changes.listeners = [];
  pouch.changes.emit = function () {
    var a = arguments;
    pouch.changes.listeners.forEach(function (l) {l.apply(l, a)});
  }
  pouch.changes.addListener = function (l) { pouch.changes.listeners.push(l); }

  pouch.replicate = {}
  pouch.replicate.from = function (options) {
    var c = []; // Change list
    if (options.url[options.url.length - 1] !== '/') options.url += '/';
    ajax({url:options.url+'_changes?style=all_docs&include_docs=true'}, function (e, resp) {
      if (e) {
        if (options.error) options.error(e);
      }
      var transaction = db.transaction(["document-store", "sequence-index"], IDBTransaction.READ_WRITE);
      var pending = resp.results.length;
      resp.results.forEach(function (r) {

        var writeDoc = function (r) {
          pouch.post(r.doc,
            { newEdits:false
            , success: function (changeset) {
                pending--;
                c.changeset = changeset;
                c.push(r);
                if (pending === 0) options.success(c);
              }
            , error: function (e) {
                pending--;
                r.error = e;
                c.push(r);
                if (pending === 0) options.success(c);
              }
            }
          , transaction
          );
        }
        pouch.get(r.id,
          { success: function (doc) {
              // The document exists
              if (doc._rev === r.changes[0].rev) return; // Do nothing if we already have the change
              else {
                var oldseq = parseInt(doc._rev.split('-')[0])
                  , newseq = parseInt(r.changes[0].rev.split('-')[0])
                  ;
                if (oldseq > newseq) {
                  return; // Should we do something nicer here?
                } else {
                  writeDoc(r);
                }
              }
            }
          , error : function (e) {
              // doc does not exist, write it
              writeDoc(r);
            }
          }, transaction);
      })
    })
  }

  return pouch;
}


const POUCH_VERSION = 1;
var pouchCache = {};
pouch = {};
pouch.open = function (name, options, callback) {
  if (options instanceof Function) {
    callback = options;
    options = {};
  }
  options = options || {};

  var name = 'pouch:' + name;
  if (name in pouchCache) {
    if (callback) callback(null, pouchCache[name]);
    return;
  }

  var request = indexedDB.open(name);

  request.onsuccess = function(event) {
    var db = event.target.result;
    pouchCache[name] = makePouch(db);

    db.onversionchange = function(event) {
      console.log("Closing!");
      db.close();
      delete pouchCache[name];
    };

    if (!db.version) {
      var versionRequest = db.setVersion('1');
      versionRequest.onsuccess = function (event) {
        db.createObjectStore('ids', {keyPath : 'id'})
          .createIndex('seq', 'seq', {unique : true});
        db.createObjectStore('revs', {autoIncrement : true});
        if (callback)
          callback(null, pouchCache[name]);
      }
      versionRequest.onblocked = function (event) {
        if (callback) {
          callback({
            error : 'open'
          , reason : 'upgrade needed but blocked by another process'
          });
        }
      };
    } else {
      if (callback)
        callback(null, pouchCache[name]);
    }
  };

  request.onerror = function(event) {
    if (callback) {
      callback({
        error : 'open'
      , reason : error.toString()
      });
    }
  }
}

pouch.deleteDatabase = function (name) {
  var name = 'pouch:' + name;
  var request = indexedDB.deleteDatabase(name);

  request.onsuccess = function (event) {
    options.success({ok : true});
  };

  request.onerror = function (event) {
    options.error({error : 'delete', reason : event.toString});
  }
}

})(window);
