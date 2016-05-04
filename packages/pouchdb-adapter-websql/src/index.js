import WebSqlPouchCore from 'pouchdb-adapter-websql-core';
import { extend } from 'js-extend';

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

WebSQLPouch.valid = function () {
  // SQLitePlugin leaks this global object, which we can use
  // to detect if it's installed or not. The benefit is that it's
  // declared immediately, before the 'deviceready' event has fired.
  return typeof openDatabase !== 'undefined' ||
    typeof SQLitePlugin !== 'undefined';
};

WebSQLPouch.use_prefix = true;

export default function (PouchDB) {
  PouchDB.adapter('websql', WebSQLPouch, true);
}
