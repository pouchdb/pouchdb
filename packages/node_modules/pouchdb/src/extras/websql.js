import WebSqlPouchPlugin from 'pouchdb-adapter-node-websql';
import { guardedConsole } from 'pouchdb-utils';

var PDB = (typeof PouchDB !== 'undefined') ? PouchDB : require('pouchdb');
if (!PDB) {
  guardedConsole('error', 'websql adapter plugin error: ' +
    'Cannot find global "PouchDB" object! ' +
    'Did you remember to include pouchdb.js?');
} else {
  WebSqlPouchPlugin(PDB);
}
