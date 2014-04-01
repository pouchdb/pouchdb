"use strict";

var PouchDB = require("./constructor");
var utils = require('./utils');
var upsert = require('./deps/upsert');
var EventEmitter = require('events').EventEmitter;
PouchDB.adapters = {};

PouchDB.prefix = '_pouch_';

var eventEmitter = new EventEmitter();

var eventEmitterMethods = [
  'on',
  'addListener',
  'emit',
  'listeners',
  'once',
  'removeAllListeners',
  'removeListener',
  'setMaxListeners'
];

var preferredAdapters = ['levelalt', 'idb', 'leveldb', 'websql'];

eventEmitterMethods.forEach(function (method) {
  PouchDB[method] = eventEmitter[method].bind(eventEmitter);
});
PouchDB.setMaxListeners(0);
PouchDB.parseAdapter = function (name, opts) {
  var match = name.match(/([a-z\-]*):\/\/(.*)/);
  var adapter, adapterName;
  if (match) {
    // the http adapter expects the fully qualified name
    name = /http(s?)/.test(match[1]) ? match[1] + '://' + match[2] : match[2];
    adapter = match[1];
    if (!PouchDB.adapters[adapter].valid()) {
      throw 'Invalid adapter';
    }
    return {name: name, adapter: match[1]};
  }

  // check for browsers that have been upgraded from websql-only to websql+idb
  var skipIdb = 'idb' in PouchDB.adapters && 'websql' in PouchDB.adapters &&
    utils.hasLocalStorage() &&
    global.localStorage['_pouch__websqldb_' + PouchDB.prefix + name];

  if (typeof opts !== 'undefined' && opts.db) {
    adapterName = 'leveldb';
  } else {
    for (var i = 0; i < preferredAdapters.length; ++i) {
      adapterName = preferredAdapters[i];
      if (adapterName in PouchDB.adapters) {
        if (skipIdb && adapterName === 'idb') {
          continue; // keep using websql to avoid user data loss
        }
        break;
      }
    }
  }

  if (adapterName) {
    adapter = PouchDB.adapters[adapterName];
    var use_prefix = 'use_prefix' in adapter ? adapter.use_prefix : true;

    return {
      name: use_prefix ? PouchDB.prefix + name : name,
      adapter: adapterName
    };
  }

  throw 'No valid adapter found';
};

var destroyQueue = [];
var destroyInProgress = false;

function destroyNext() {
  if (destroyInProgress || !destroyQueue.length) {
    return;
  }
  destroyInProgress = true;
  var task = destroyQueue.shift();
  function callback(err, resp) {
    task.callback(err, resp);
    destroyInProgress = false;
    destroyNext();
  }
  new PouchDB(task.name, {adapter : task.adapter}, function (err, db) {
    if (err) {
      return callback(err);
    }
    db.destroy(task.opts, callback);
  });
}

PouchDB.destroy = utils.toPromise(function (name, opts, callback) {
  if (typeof opts === 'function' || typeof opts === 'undefined') {
    callback = opts;
    opts = {};
  }

  if (typeof name === 'object') {
    opts = name;
    name = undefined;
  }

  var backend = PouchDB.parseAdapter(opts.name || name, opts);
  var dbName = backend.name;

  var adapter = PouchDB.adapters[backend.adapter];

  var usePrefix = 'use_prefix' in adapter ? adapter.use_prefix : true;

  var trueDbName = usePrefix ?
    dbName.replace(new RegExp('^' + PouchDB.prefix), '') : dbName;

  destroyQueue.push({
    name : trueDbName,
    adapter : backend.adapter,
    opts : opts,
    callback : callback
  });
  destroyNext();
});

PouchDB.registerDependentDatabase = utils.toPromise(function (db, dependentDb, callback) {
  if (db.type() === 'http') {
    return callback(null);
  }
  dependentDb.info(function (err, dependentDbInfo) {
    if (err) {
      return callback(err);
    }
    function diffFun(doc) {
      doc.dependentDbs = doc.dependentDbs || {};
      doc.dependentDbs[dependentDbInfo.db_name] = true;
      return doc;
    }
    upsert(db, '_local/dependentDbs', diffFun, function (err) {
      if (err) {
        return callback(err);
      }
      return callback(null);
    });
  });
});

PouchDB.allDbs = utils.toPromise(function (callback) {
  var err = new Error('allDbs method removed');
  err.stats = '400';
  callback(err);
});
PouchDB.adapter = function (id, obj) {
  if (obj.valid()) {
    PouchDB.adapters[id] = obj;
  }
};

PouchDB.plugin = function (obj) {
  Object.keys(obj).forEach(function (id) {
    PouchDB.prototype[id] = obj[id];
  });
};

module.exports = PouchDB;
