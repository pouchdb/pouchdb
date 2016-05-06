import WebSqlPouch from 'pouchdb-adapter-node-websql';
var name = 'websql';

var PDB = (typeof PouchDB !== 'undefined') ? PouchDB : require('pouchdb');
if (!PDB) {
  console.error(name + ' adapter plugin error: ' +
    'Cannot find global "PouchDB" object! ' +
    'Did you remember to include pouchdb.js?');
} else {
  PDB.adapter(name, WebSqlPouch, true);
}