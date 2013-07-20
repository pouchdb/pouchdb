/*globals extend: false, Buffer: false, Pouch: true */
"use strict";

var PERSIST_DATABASES = false;

function cleanupAllDbs() {

  var deleted = 0;
  var adapters = Object.keys(Pouch.adapters).filter(function(adapter) {
    return adapter !== 'http' && adapter !== 'https';
  });

  function finished() {
    // Restart text execution
    start();
  }

  function dbDeleted() {
    deleted++;
    if (deleted === adapters.length) {
      finished();
    }
  }

  if (!adapters.length) {
    finished();
  }

  // Remove old allDbs to prevent DOM exception
  adapters.forEach(function(adapter) {
    if (adapter === "http" || adapter === "https") {
      return;
    }
    Pouch.destroy(Pouch.allDBName(adapter), dbDeleted);
  });
}

function cleanupTestDatabases() {

  if (PERSIST_DATABASES) {
    return;
  }

  // Stop the tests from executing
  stop();

  var dbCount;
  var deleted = 0;

  function finished() {
    cleanupAllDbs();
  }

  function dbDeleted() {
    if (++deleted === dbCount) {
      finished();
    }
  }

  Pouch.allDbs(function(err, dbs) {
    if (!dbs.length) {
      finished();
    }
    dbCount = dbs.length;
    dbs.forEach(function(db) {
      Pouch.destroy(db, dbDeleted);
    });
  });
}

function uuid() {
  var S4 = function() {
    return Math.floor(Math.random() * 0x10000).toString(16);
  };

  return (
    S4() + S4() + "-" +
      S4() + "-" +
      S4() + "-" +
      S4() + "-" +
      S4() + S4() + S4()
  );
}

function makeDocs(start, end, templateDoc) {
  var templateDocSrc = templateDoc ? JSON.stringify(templateDoc) : "{}";
  if (end === undefined) {
    end = start;
    start = 0;
  }
  var docs = [];
  for (var i = start; i < end; i++) {
    /*jshint evil:true */
    var newDoc = eval("(" + templateDocSrc + ")");
    newDoc._id = (i).toString();
    newDoc.integer = i;
    newDoc.string = (i).toString();
    docs.push(newDoc);
  }
  return docs;
}

function makeBlob(data, type) {
  if (typeof module !== 'undefined' && module.exports) {
    return new Buffer(data);
  } else {
    return new Blob([data], {type: type});
  }
}

function readBlob(blob, callback) {
  if (typeof module !== 'undefined' && module.exports) {
    callback(blob.toString());
  } else {
    var reader = new FileReader();
    reader.onloadend = function(e) {
      callback(this.result);
    };
    reader.readAsBinaryString(blob);
  }
}

function base64Blob(blob, callback) {
  if (typeof module !== 'undefined' && module.exports) {
    callback(blob.toString('base64'));
  } else {
    var reader = new FileReader();
    reader.onloadend = function(e) {
      var base64 = this.result.replace(/data:.*;base64,/, '');
      callback(base64);
    };
    reader.readAsDataURL(blob);
  }
}

function openTestAsyncDB(name) {
  return new Pouch(name, function(err,db) {
    if (err) {
      console.error(err);
      ok(false, 'failed to open database');
      return start();
    }
  });
}

function openTestDB(name, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  new Pouch(name, opts, function(err, db) {
    if (err) {
      console.error(err);
      ok(false, 'failed to open database');
      return start();
    }
    callback.apply(this, arguments);
  });
}

function initTestDB(name, opts, callback) {
  // ignore errors, the database might not exist
  Pouch.destroy(name, function(err) {
    if (err && err.status !== 404 && err.statusText !== 'timeout') {
      console.error(err);
      ok(false, 'failed to open database');
      return start();
    }
    openTestDB(name, opts, callback);
  });
}

function initDBPair(local, remote, callback) {
  initTestDB(local, function(err, localDb) {
    initTestDB(remote, function(err, remoteDb) {
      callback(localDb, remoteDb);
    });
  });
}

var testId = uuid();

function generateAdapterUrl(id) {
  var opt = id.split('-');
  if (opt[0] === 'local') {
    return 'testdb_' + testId + '_' + opt[1];
  }
  if (opt[0] === 'http') {
    var host = (typeof module !== 'undefined' && module.exports) ?
      process.env.COUCH_HOST || 'http://localhost:5984/' :
      'http://localhost:2020/';
    return host + 'testdb_' + testId + '_' + opt[1];
  }
}

// Put doc after prevRev (so that doc is a child of prevDoc
// in rev_tree). Doc must have _rev. If prevRev is not specified
// just insert doc with correct _rev (new_edits=false!)
function putAfter(db, doc, prevRev, callback){
  var newDoc = extend({}, doc);
  if (!prevRev) {
    db.put(newDoc, {new_edits: false}, callback);
    return;
  }
  newDoc._revisions = {
    start: +newDoc._rev.split('-')[0],
    ids: [
      newDoc._rev.split('-')[1],
      prevRev.split('-')[1]
    ]
  };
  db.put(newDoc, {new_edits: false}, callback);
}

// docs will be inserted one after another
// starting from root
var putBranch = function(db, docs, callback) {
  function insert(i) {
    var doc = docs[i];
    var prev = i > 0 ? docs[i-1]._rev : null;
    function next() {
      if (i < docs.length - 1) {
        insert(i+1);
      } else {
        callback();
      }
    }
    db.get(doc._id, {rev: doc._rev}, function(err, ok){
      if(err){
        putAfter(db, docs[i], prev, function(err, doc) {
          next();
        });
      }else{
        next();
      }
    });
  }
  insert(0);
};


var putTree = function(db, tree, callback) {
  function insert(i) {
    var branch = tree[i];
    putBranch(db, branch, function() {
      if (i < tree.length - 1) {
        insert(i+1);
      } else {
        callback();
      }
    });
  }
  insert(0);
};

var writeDocs = function(db, docs, callback, res) {
  if (!res) {
    res = [];
  }
  if (!docs.length) {
    return callback(null, res);
  }
  var doc = docs.shift();
  db.put(doc, function(err, doc) {
    ok(doc.ok, 'docwrite returned ok');
    res.push(doc);
    writeDocs(db, docs, callback, res);
  });
};


// Borrowed from: http://stackoverflow.com/a/840849
function eliminateDuplicates(arr) {
  var i, element,
      len = arr.length,
      out = [],
      obj = {};

  for (i=0; i<len; i++) {
    obj[arr[i]]=0;
  }

  for (element in obj) {
    out.push(element);
  }

  return out;
}

if (typeof module !== 'undefined' && module.exports) {
  Pouch = require('../src/pouch.js');
  module.exports = {
    uuid: uuid,
    makeDocs: makeDocs,
    makeBlob: makeBlob,
    readBlob: readBlob,
    base64Blob: base64Blob,
    initTestDB: initTestDB,
    initDBPair: initDBPair,
    openTestDB: openTestDB,
    openTestAsyncDB: openTestAsyncDB,
    generateAdapterUrl: generateAdapterUrl,
    putAfter: putAfter,
    putBranch: putBranch,
    putTree: putTree,
    writeDocs: writeDocs,
    cleanupTestDatabases: cleanupTestDatabases,
    PERSIST_DATABASES: PERSIST_DATABASES,
    eliminateDuplicates: eliminateDuplicates
  };
}
