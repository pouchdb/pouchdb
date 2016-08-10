import WebSqlPouchCore from 'pouchdb-adapter-websql-core';
import { extend } from 'js-extend';
import valid from './valid';

function openDB(name, version, description, size) {
  // Traditional WebSQL API
  return openDatabase(name, version, description, size);
}

function WebSQLPouch(opts, callback) {
  var _opts = extend({
    websql: openDB
  }, opts);

  WebSqlPouchCore.call(this, _opts, callback);
}

WebSQLPouch.valid = valid;

WebSQLPouch.use_prefix = true;

export default function (PouchDB) {
  PouchDB.adapter('websql', WebSQLPouch, true);
}
