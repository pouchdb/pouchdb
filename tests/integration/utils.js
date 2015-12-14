/* jshint -W079 */
'use strict';

var testUtils = require('./utils');
var PouchDB = require('../../lib');

function uniq(list) {
  var map = {};
  list.forEach(function (item) {
    map[item] = true;
  });
  return Object.keys(map);
}

function params() {
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
}

exports.isCouchMaster = function () {
  return 'SERVER' in params() &&
    params().SERVER === 'couchdb-master';
};

exports.isSyncGateway = function () {
  return 'SERVER' in params() &&
    params().SERVER === 'sync-gateway';
};

exports.isExpressRouter = function () {
  return 'SERVER' in params() &&
    params().SERVER === 'pouchdb-express-router';
};

exports.params = params;

exports.couchHost = function () {
  if (typeof module !== 'undefined' && module.exports) {
    return process.env.COUCH_HOST || 'http://localhost:5984';
  } else if (window && window.COUCH_HOST) {
    return window.COUCH_HOST;
  } else if (window && window.cordova) {
    // magic route to localhost on android emulator,
    // cors not needed because cordova
    return 'http://10.0.2.2:5984';
  }
  // In the browser we default to the CORS server, in future will change
  return 'http://localhost:2020';
};

// Abstracts constructing a Blob object, so it also works in older
// browsers that don't support the native Blob constructor (e.g.
// old QtWebKit versions, Android < 4.4).
// Copied over from createBlob.js in PouchDB because we don't
// want to have to export this function in utils
function createBlob(parts, properties) {
  /* global BlobBuilder,MSBlobBuilder,MozBlobBuilder,WebKitBlobBuilder */
  parts = parts || [];
  properties = properties || {};
  try {
    return new Blob(parts, properties);
  } catch (e) {
    if (e.name !== "TypeError") {
      throw e;
    }
    var Builder = typeof BlobBuilder !== 'undefined' ? BlobBuilder :
                  typeof MSBlobBuilder !== 'undefined' ? MSBlobBuilder :
                  typeof MozBlobBuilder !== 'undefined' ? MozBlobBuilder :
                  WebKitBlobBuilder;
    var builder = new Builder();
    for (var i = 0; i < parts.length; i += 1) {
      builder.append(parts[i]);
    }
    return builder.getBlob(properties.type);
  }
}

exports.makeBlob = function (data, type) {
  if (typeof module !== 'undefined' && module.exports) {
    return new Buffer(data, 'binary');
  } else {
    return createBlob([data], {
      type: (type || 'text/plain')
    });
  }
};

exports.binaryStringToBlob = function (bin, type) {
  return PouchDB.utils.binaryStringToBlobOrBuffer(bin, type);
};

exports.btoa = function (arg) {
  return PouchDB.utils.btoa(arg);
};

exports.atob = function (arg) {
  return PouchDB.utils.atob(arg);
};

exports.readBlob = function (blob, callback) {
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

exports.readBlobPromise = function (blob) {
  return new PouchDB.utils.Promise(function (resolve) {
    exports.readBlob(blob, resolve);
  });
};

exports.base64Blob = function (blob, callback) {
  if (typeof module !== 'undefined' && module.exports) {
    callback(blob.toString('base64'));
  } else {
    exports.readBlob(blob, function (binary) {
      callback(PouchDB.utils.btoa(binary));
    });
  }
};

// Prefix http adapter database names with their host and
// node adapter ones with a db location
exports.adapterUrl = function (adapter, name) {
  if (adapter === 'http') {
    return exports.couchHost() + '/' + name;
  }
  return name;
};

// Delete specified databases
exports.cleanup = function (dbs, done) {
  dbs = uniq(dbs);
  var num = dbs.length;
  var finished = function() {
    if (--num === 0) {
      done();
    }
  };

  dbs.forEach(function(db) {
    new PouchDB(db).destroy(finished, finished);
  });
};

// Put doc after prevRev (so that doc is a child of prevDoc
// in rev_tree). Doc must have _rev. If prevRev is not specified
// just insert doc with correct _rev (new_edits=false!)
exports.putAfter = function (db, doc, prevRev, callback) {
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
exports.putBranch = function (db, docs, callback) {
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
        exports.putAfter(db, docs[i], prev, function (err, doc) {
          next();
        });
      } else {
        next();
      }
    });
  }
  insert(0);
};

exports.putTree = function (db, tree, callback) {
  function insert(i) {
    var branch = tree[i];
    exports.putBranch(db, branch, function () {
      if (i < tree.length - 1) {
        insert(i + 1);
      } else {
        callback();
      }
    });
  }
  insert(0);
};

exports.isCouchDB = function (cb) {
  PouchDB.ajax({url: exports.couchHost() + '/' }, function (err, res) {
    cb('couchdb' in res);
  });
};

exports.writeDocs = function (db, docs, callback, res) {
  if (!res) {
    res = [];
  }
  if (!docs.length) {
    return callback(null, res);
  }
  var doc = docs.shift();
  db.put(doc, function (err, info) {
    res.push(info);
    exports.writeDocs(db, docs, callback, res);
  });
};

// Borrowed from: http://stackoverflow.com/a/840849
exports.eliminateDuplicates = function (arr) {
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

// Promise finally util similar to Q.finally
exports.fin = function (promise, cb) {
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

exports.promisify = function (fun, context) {
  return function() {
    var args = [];
    for (var i = 0; i < arguments.length; i++) {
      args[i] = arguments[i];
    }
    return new PouchDB.utils.Promise(function (resolve, reject) {
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

exports.binaryStringToBlobOrBuffer =
  require('../../lib/deps/binary/binaryStringToBlobOrBuffer');

exports.PouchDB = PouchDB;

if (typeof process !== 'undefined' && !process.browser) {

  // we're in Node rather than the browser
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
    exports.PouchDB = PouchDB.defaults(defaults);
  } else if (process.env.AUTO_COMPACTION) {
    exports.PouchDB = PouchDB.defaults({auto_compaction: true});
  } else {
    exports.PouchDB = PouchDB;
  }
  if (typeof process !== 'undefined') {
    var testDir = process.env.TESTS_DIR ? process.env.TESTS_DIR : './tmp';
    testDir = testDir.slice(-1) === '/' ? testDir : testDir + '/';
    exports.PouchDB.prefix = testDir + global.PouchDB.prefix;
    require('../../lib/adapters/leveldb').use_prefix = true;
  }
} else {
  // we are in the browser
  // use query parameter pluginFile if present,
  // eg: test.html?pluginFile=memory.pouchdb.js
  var preferredAdapters = window.location.search.match(/[?&]adapters=([^&]+)/);

  var pluginAdapters = {
    memory: require('../../lib/plugins/memory'),
    fruitdown: require('../../lib/plugins/fruitdown'),
    localstorage: require('../../lib/plugins/localstorage')
  };

  if (preferredAdapters) {
    preferredAdapters = preferredAdapters[1].split(',');
    preferredAdapters.forEach(function (adapter) {
      if (adapter === 'memory') {
        require('../../lib/plugins/memory');
      } else if (adapter === 'fruitdown') {
        require('../../lib/plugins/fruitdown');
      } else if (adapter === 'localstorage') {
        require('../../lib/plugins/localstorage');
      }
    });
    PouchDB.preferredAdapters = preferredAdapters;
  }
}
