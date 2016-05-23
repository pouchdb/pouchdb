import WebSqlPouchCore from 'pouchdb-adapter-websql-core';
import { extend } from 'js-extend';
import valid from './valid';

function websql(optsOrName, version, description, size) {
  if (typeof sqlitePlugin !== 'undefined') {
    // The SQLite Plugin started deviating pretty heavily from the
    // standard openDatabase() function, as they started adding more features.
    // It's better to just use their "new" format and pass in a big ol'
    // options object.
    return sqlitePlugin.openDatabase(optsOrName);
  }

  // Traditional WebSQL API
  return openDatabase(optsOrName, version, description, size);
}

function WebSQLPouch(opts, callback) {
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
