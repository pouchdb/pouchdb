import WebSqlPouchCore from 'pouchdb-adapter-websql-core';
import { extend } from 'js-extend';
import valid from './valid';

function createOpenDBFunction(opts) {
  return function (name, version, description, size) {
    if (typeof sqlitePlugin !== 'undefined') {
      // The SQLite Plugin started deviating pretty heavily from the
      // standard openDatabase() function, as they started adding more features.
      // It's better to just use their "new" format and pass in a big ol'
      // options object. Also there are many options here that may come from
      // the PouchDB constructor, so we have to grab those.
      var sqlitePluginOpts = extend({}, opts, {
        name: name,
        version: version,
        description: description,
        size: size
      });
      return sqlitePlugin.openDatabase(sqlitePluginOpts);
    }

    // Traditional WebSQL API
    return openDatabase(name, version, description, size);
  };
}

function WebSQLPouch(opts, callback) {
  var websql = createOpenDBFunction(opts);
  var _opts = extend({
    websql: websql
  }, opts);

  WebSqlPouchCore.call(this, _opts, callback);
}

WebSQLPouch.valid = valid;

WebSQLPouch.use_prefix = true;

export default function (PouchDB) {
  PouchDB.adapter('websql', WebSQLPouch, true);
}
