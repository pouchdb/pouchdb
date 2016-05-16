import WebSqlPouch from 'pouchdb-adapter-websql';
import { extend } from 'js-extend';
import websql from 'websql';

function NodeWebSqlPouch(opts, callback) {
  var _opts = extend({
    websql: websql // pass node-websql in as our "openDatabase" function
  }, opts);

  WebSqlPouch.call(this, _opts, callback);
}

// overrides for normal WebSQL behavior in the browser
NodeWebSqlPouch.valid = function () {
  return true;
};
NodeWebSqlPouch.use_prefix = false; // no prefix necessary in Node

export default function (PouchDB) {
  PouchDB.adapter('websql', NodeWebSqlPouch, true);
}