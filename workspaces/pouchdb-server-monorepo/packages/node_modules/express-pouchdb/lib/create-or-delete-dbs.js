'use strict';

// unified access to creating/deleting PouchDB databases,
// to re-use PouchDB objects and avoid race conditions

var Promise = require('pouchdb-promise');
var PouchMap = require('pouchdb-collections').Map;

var promiseChain = Promise.resolve();

// do all creations/deletions in a single global lock
// obviously this makes this operation slow... but hopefully you aren't
// creating and destroying a lot of databases all the time
function doSequentially(fun) {
  promiseChain = promiseChain.then(fun);
  return promiseChain;
}

function getOrCreateDB(PouchDB, dbName) {
  var map = PouchDB.__dbCacheMap;
  if (!map) {
    // cache DBs to avoid costly re-allocations
    map = PouchDB.__dbCacheMap = new PouchMap();
  }
  return doSequentially(function () {
    var db = map.get(dbName);
    if (db) {
      return db;
    }
    db = new PouchDB(dbName);
    map.set(dbName, db);
    return db;
  });
}

function deleteDB(PouchDB, dbName, opts) {
  return doSequentially(function () {
    var dbCache = PouchDB.__dbCacheMap;
    var db = dbCache && dbCache.get(dbName);
    if (!db) {
      // if the db wasn't cached, we may still need to destroy it
      // if it's saved to disk
      return PouchDB.destroy(dbName, opts);
    }
    // if this db was cached, we need to remove it from the cache immediately
    dbCache.delete(dbName);
    return db.destroy(opts);
  });
}

exports.getOrCreateDB = getOrCreateDB;
exports.deleteDB = deleteDB;