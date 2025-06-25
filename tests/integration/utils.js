'use strict';

var testUtils = Object.create(require('../common-utils'));

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

testUtils.isChrome = function () {
  return (typeof window !== 'undefined') && window.navigator &&
      /Google Inc/.test(window.navigator.vendor);
};

testUtils.isSafari = function () {
  return (typeof process === 'undefined' || process.browser) &&
      /Safari/.test(window.navigator.userAgent) &&
      !/Chrome/.test(window.navigator.userAgent);
};

testUtils.adapterType = function () {
  return testUtils.adapters().indexOf('http') < 0 ? 'local' : 'http';
};

testUtils.readBlob = function (blob, callback) {
  if (testUtils.isNode()) {
    callback(blob.toString('binary'));
  } else {
    var reader = new FileReader();
    reader.onloadend = function () {

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

testUtils.readBlobPromise = function (blob) {
  return new Promise(function (resolve) {
    testUtils.readBlob(blob, resolve);
  });
};

testUtils.base64Blob = function (blob, callback) {
  if (testUtils.isNode()) {
    callback(blob.toString('base64'));
  } else {
    testUtils.readBlob(blob, function (binary) {
      callback(testUtils.btoa(binary));
    });
  }
};

// Prefix http adapter database names with their host and
// node adapter ones with a db location
testUtils.adapterUrl = function (adapter, name) {

  // CouchDB master has problems with cycling databases rapidly
  // so give tests separate names
  name += '_' + Date.now();

  if (adapter === 'http') {
    return testUtils.couchHost() + '/' + name;
  }
  return name;
};

// Delete specified databases
testUtils.cleanup = function (dbs, done) {
  dbs = uniq(dbs);
  var num = dbs.length;
  var finished = function () {
    if (--num === 0) {
      done();
    }
  };

  dbs.forEach(function (db) {
    new PouchDB(db).destroy(finished, finished);
  });
};

// Put doc after prevRev (so that doc is a child of prevDoc
// in rev_tree). Doc must have _rev. If prevRev is not specified
// just insert doc with correct _rev (new_edits=false!)
testUtils.putAfter = function (db, doc, prevRev, callback) {
  var newDoc = testUtils.assign({}, doc);
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
    db.get(doc._id, { rev: doc._rev }, function (err) {
      if (err) {
        testUtils.putAfter(db, docs[i], prev, function () {
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

function parseHostWithCreds(host) {
  var { origin, pathname, username, password } = new URL(host);
  var url = `${origin}${pathname}`;
  var options = {};
  if (username || password) {
    options.headers = {};
    options.headers['Authorization'] = 'Basic: ' + testUtils.btoa(`${username}:${password}`);
  }
  return { url, options };
}

testUtils.isCouchDB = function (cb) {
  var {url, options} = parseHostWithCreds(testUtils.couchHost());
  PouchDB.fetch(url, options).then(function (response) {
    return response.json();
  }).then(function (res) {
    cb('couchdb' in res || 'express-pouchdb' in res);
  });
};

testUtils.getServerType = async () => {
  const knownServers = [
    'couchdb',
    'express-pouchdb',
    'pouchdb-express-router',
  ];

  const { url, options } = parseHostWithCreds(testUtils.couchHost());
  const res = await PouchDB.fetch(url, options);
  const body = await res.json();

  for (const known of knownServers) {
    if (body[known]) {
      return known;
    }
  }

  throw new Error(`Could not find a known server type in response: ${JSON.stringify(res)}`);
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
    if (Object.hasOwnProperty.call(obj, element)) {
      out.push(element);
    }
  }
  return out;
};

// Promise finally util similar to Q.finally
testUtils.fin = function (promise, cb) {
  return promise.then(function (res) {
    var promise2 = cb();
    if (typeof promise2.then === 'function') {
      return promise2.then(function () {
        return res;
      });
    }
    return res;
  }, function (reason) {
    var promise2 = cb();
    if (typeof promise2.then === 'function') {
      return promise2.then(function () {
        throw reason;
      });
    }
    throw reason;
  });
};

testUtils.promisify = function (fun, context) {
  return function () {
    var args = [];
    for (var i = 0; i < arguments.length; i++) {
      args[i] = arguments[i];
    }
    return new Promise(function (resolve, reject) {
      args.push(function (err, res) {
        if (err) {
          return reject(err);
        }
        return resolve(res);
      });
      fun.apply(context, args);
    });
  };
};

// We need to use pouchdb-for-coverage here to ensure that e.g pouchdb-utils
// and pouchdb-ajax don't get pulled in, because then our coverage tests
// would complain that we're not using the "whole" thing.
var PouchForCoverage = require('../../packages/node_modules/pouchdb-for-coverage');
var pouchUtils = PouchForCoverage.utils;
testUtils.binaryStringToBlob = pouchUtils.binaryStringToBlobOrBuffer;
testUtils.btoa = pouchUtils.btoa;
testUtils.atob = pouchUtils.atob;
testUtils.ajax = PouchForCoverage.ajax;
testUtils.uuid = pouchUtils.uuid;
testUtils.rev = pouchUtils.rev;
testUtils.errors = PouchForCoverage.Errors;
testUtils.assign = pouchUtils.assign;
testUtils.generateReplicationId = pouchUtils.generateReplicationId;

testUtils.makeBlob = function (data, type) {
  if (testUtils.isNode()) {
    // "global.Buffer" is to avoid Browserify pulling this in
    return global.Buffer.from(data, 'binary');
  } else {
    return pouchUtils.blob([data], {
      type: (type || 'text/plain')
    });
  }
};

testUtils.getUnHandledRejectionEventName = function () {
  return typeof window !== 'undefined' ? 'unhandledrejection' :
    'unhandledRejection';
};

testUtils.addGlobalEventListener = function (eventName, listener) {
  // The window test has to go first because the process test will pass
  // in the browser's test environment
  if (typeof window !== 'undefined' && window.addEventListener) {
    return window.addEventListener(eventName, listener);
  }

  if (typeof process !== 'undefined') {
    return process.on(eventName, listener);
  }

  return null;
};

testUtils.addUnhandledRejectionListener = function (listener) {
  return testUtils.addGlobalEventListener(
    testUtils.getUnHandledRejectionEventName(), listener);
};

testUtils.removeGlobalEventListener = function (eventName, listener) {
  if (typeof process !== 'undefined') {
    return process.removeListener(eventName, listener);
  }

  if (typeof window !== 'undefined' && window.removeEventListener) {
    return window.removeEventListener(eventName, listener);
  }

  return null;
};

testUtils.removeUnhandledRejectionListener = function (listener) {
  return testUtils.removeGlobalEventListener(
    testUtils.getUnHandledRejectionEventName(), listener);
};

testUtils.sortById = function (a, b) {
  return a._id < b._id ? -1 : 1;
};

if (testUtils.isNode()) {
  module.exports = testUtils;
} else {
  window.testUtils = testUtils;
}
