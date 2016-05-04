'use strict';

import { Map } from 'pouchdb-collections';

var cachedDatabases = new Map();

function createOpenDBFunction(opts) {
  // openDatabase passed in through opts (e.g. for node-websql)
  if (typeof opts.websql !== 'undefined') {
    return function openDB(opts) {
      return opts.websql(opts.name, opts.version, opts.description, opts.size);
    };
  }
  if (typeof sqlitePlugin !== 'undefined') {
    // The SQLite Plugin started deviating pretty heavily from the
    // standard openDatabase() function, as they started adding more features.
    // It's better to just use their "new" format and pass in a big ol'
    // options object.
    return sqlitePlugin.openDatabase.bind(sqlitePlugin);
  }

  if (typeof openDatabase !== 'undefined') {
    return function openDB(opts) {
      // Traditional WebSQL API
      return openDatabase(opts.name, opts.version, opts.description, opts.size);
    };
  }
}

function openDBSafely(openDBFunction, opts) {
  try {
    return {
      db: openDBFunction(opts)
    };
  } catch (err) {
    return {
      error: err
    };
  }
}

function openDB(opts) {
  var cachedResult = cachedDatabases.get(opts.name);
  if (!cachedResult) {
    var openDBFun = createOpenDBFunction(opts);
    cachedResult = openDBSafely(openDBFun, opts);
    cachedDatabases.set(opts.name, cachedResult);
    if (cachedResult.db) {
      cachedResult.db._sqlitePlugin = typeof sqlitePlugin !== 'undefined';
    }
  }
  return cachedResult;
}

export default openDB;