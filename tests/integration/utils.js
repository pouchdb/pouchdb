/* global PouchDB */
/* jshint -W079 */
'use strict';

var testUtils = {};

function uniq(list) {
  var map = {};
  list.forEach(function (item) {
    map[item] = true;
  });
  return Object.keys(map);
}

testUtils.isCouchMaster = function () {
  return 'SERVER' in testUtils.params() &&
    testUtils.params().SERVER === 'couchdb-master';
};

testUtils.isSyncGateway = function () {
  return 'SERVER' in testUtils.params() &&
    testUtils.params().SERVER === 'sync-gateway';
};

testUtils.params = function () {
  if (typeof module !== 'undefined' && module.exports) {
    return process.env;
  }
  var paramStr = document.location.search.slice(1);
  return paramStr.split('&').reduce(function (acc, val) {
    if (!val) {
      return acc;
    }
    var tmp = val.split('=');
    acc[tmp[0]] = tmp[1] || true;
    return acc;
  }, {});
};

testUtils.couchHost = function () {
  if (typeof module !== 'undefined' && module.exports) {
    return process.env.COUCH_HOST || 'http://localhost:5984';
  } else if (window && window.COUCH_HOST) {
    return window.COUCH_HOST;
  } else if (window && window.cordova) {
    // magic route to localhost on android emulator
    return 'http://10.0.2.2:2020';
  }
  // In the browser we default to the CORS server, in future will change
  return 'http://localhost:2020';
};

testUtils.makeBlob = function (data, type) {
  if (typeof module !== 'undefined' && module.exports) {
    return new Buffer(data, 'binary');
  } else {
    return PouchDB.utils.createBlob([data], { type: type });
  }
};

testUtils.readBlob = function (blob, callback) {
  if (typeof module !== 'undefined' && module.exports) {
    callback(blob.toString('binary'));
  } else {
    var reader = new FileReader();
    reader.onloadend = function (e) {
      
      var binary = "";
      var bytes = new Uint8Array(this.result || '');
      var length = bytes.byteLength;
      
      for (var i = 0; i < length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      
      callback(binary);
    };
    reader.readAsArrayBuffer(blob);
  }
};

testUtils.base64Blob = function (blob, callback) {
  if (typeof module !== 'undefined' && module.exports) {
    callback(blob.toString('base64'));
  } else {
    testUtils.readBlob(blob, function (binary) {
      callback(PouchDB.utils.btoa(binary));
    });
  }
};

// Prefix http adapter database names with their host and
// node adapter ones with a db location
testUtils.adapterUrl = function (adapter, name) {
  if (adapter === 'http') {
    return testUtils.couchHost() + '/' + name;
  }
  return name;
};

// Delete specified databases
testUtils.cleanup = function (dbs, done) {

  dbs = uniq(dbs);
  var num = dbs.length;

  dbs.forEach(function(db) {
    new PouchDB(db).destroy(function() {
      if (--num === 0) {
        done();
      }
    });
  });
};

// Put doc after prevRev (so that doc is a child of prevDoc
// in rev_tree). Doc must have _rev. If prevRev is not specified
// just insert doc with correct _rev (new_edits=false!)
testUtils.putAfter = function (db, doc, prevRev, callback) {
  var newDoc = PouchDB.utils.extend({}, doc);
  if (!prevRev) {
    db.put(newDoc, { new_edits: false }, callback);
    return;
  }
  newDoc._revisions = {
    start: +newDoc._rev.split('-')[0],
    ids: [
      newDoc._rev.split('-')[1],
      prevRev.split('-')[1]
    ]
  };
  db.put(newDoc, { new_edits: false }, callback);
};

// docs will be inserted one after another
// starting from root
testUtils.putBranch = function (db, docs, callback) {
  function insert(i) {
    var doc = docs[i];
    var prev = i > 0 ? docs[i - 1]._rev : null;
    function next() {
      if (i < docs.length - 1) {
        insert(i + 1);
      } else {
        callback();
      }
    }
    db.get(doc._id, { rev: doc._rev }, function (err, ok) {
      if (err) {
        testUtils.putAfter(db, docs[i], prev, function (err, doc) {
          next();
        });
      } else {
        next();
      }
    });
  }
  insert(0);
};

testUtils.putTree = function (db, tree, callback) {
  function insert(i) {
    var branch = tree[i];
    testUtils.putBranch(db, branch, function () {
      if (i < tree.length - 1) {
        insert(i + 1);
      } else {
        callback();
      }
    });
  }
  insert(0);
};

testUtils.isCouchDB = function (cb) {
  PouchDB.ajax({url: testUtils.couchHost() + '/' }, function (err, res) {
    cb('couchdb' in res);
  });
};

testUtils.writeDocs = function (db, docs, callback, res) {
  if (!res) {
    res = [];
  }
  if (!docs.length) {
    return callback(null, res);
  }
  var doc = docs.shift();
  db.put(doc, function (err, info) {
    res.push(info);
    testUtils.writeDocs(db, docs, callback, res);
  });
};

// Borrowed from: http://stackoverflow.com/a/840849
testUtils.eliminateDuplicates = function (arr) {
  var i, element, len = arr.length, out = [], obj = {};
  for (i = 0; i < len; i++) {
    obj[arr[i]] = 0;
  }
  for (element in obj) {
    if (obj.hasOwnProperty(element)) {
      out.push(element);
    }
  }
  return out;
};

var testDir;
if (typeof module !== 'undefined' && module.exports) {
  global.PouchDB = require('../../lib');
  if (process.env.LEVEL_ADAPTER || process.env.LEVEL_PREFIX) {
    var defaults = {};

    if (process.env.LEVEL_ADAPTER) {
      defaults.db = require(process.env.LEVEL_ADAPTER);
      console.log('Using client-side leveldown adapter: ' +
        process.env.LEVEL_ADAPTER);
    }
    if (process.env.LEVEL_PREFIX) {
      defaults.prefix = process.env.LEVEL_PREFIX;
      console.log('Using client-side leveldown prefix: ' + defaults.prefix);
    }
    global.PouchDB = global.PouchDB.defaults(defaults);
  } else if (process.env.AUTO_COMPACTION) {
    global.PouchDB = global.PouchDB.defaults({auto_compaction: true});
  }
  if (typeof process !== 'undefined') {
    testDir = process.env.TESTS_DIR ? process.env.TESTS_DIR : './tmp';
    testDir = testDir.slice(-1) === '/' ? testDir : testDir + '/';
    global.PouchDB.prefix = testDir + global.PouchDB.prefix;
    require('../../lib/adapters/leveldb/leveldb').use_prefix = true;
    require('bluebird').onPossiblyUnhandledRejection(function (e, promise) {
      throw e;
    });
  }
  module.exports = testUtils;
}
