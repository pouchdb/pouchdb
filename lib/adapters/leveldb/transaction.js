'use strict';

// similar to an idb or websql transaction object
// designed to be passed around. basically just caches
// things in-memory and then does a big batch() operation
// when you're done

var utils = require('../../utils');

function getCacheFor(transaction, store) {
  var prefix = store.prefix();
  var cache = transaction._cache;
  var subCache = cache.get(prefix);
  if (!subCache) {
    subCache = new utils.Map();
    cache.set(prefix, subCache);
  }
  return subCache;
}

function LevelTransaction() {
  this._batch = [];
  this._cache = new utils.Map();
}

LevelTransaction.prototype.get = function (store, key, callback) {
  var cache = getCacheFor(this, store);
  var exists = cache.get(key);
  if (exists) {
    return process.nextTick(function () {
      callback(null, exists);
    });
  } else if (exists === null) { // deleted marker
    return process.nextTick(function () {
      callback({name: 'NotFoundError'});
    });
  }
  store.get(key, function (err, res) {
    if (err) {
      if (err.name === 'NotFoundError') {
        cache.set(key, null);
      }
      return callback(err);
    }
    cache.set(key, res);
    callback(null, res);
  });
};

LevelTransaction.prototype.batch = function (batch) {
  for (var i = 0, len = batch.length; i < len; i++) {
    var operation = batch[i];

    var cache = getCacheFor(this, operation.prefix);

    if (operation.type === 'put') {
      cache.set(operation.key, operation.value);
    } else {
      cache.set(operation.key, null);
    }
  }
  this._batch = this._batch.concat(batch);
};

LevelTransaction.prototype.execute = function (db, callback) {

  var keys = new utils.Set();
  var uniqBatches = [];

  // remove duplicates; last one wins
  for (var i = this._batch.length - 1; i >= 0; i--) {
    var operation = this._batch[i];
    var lookupKey = operation.prefix.prefix() + '\xff' + operation.key;
    if (keys.has(lookupKey)) {
      continue;
    }
    keys.add(lookupKey);
    uniqBatches.push(operation);
  }

  db.batch(uniqBatches, callback);
};

module.exports = LevelTransaction;