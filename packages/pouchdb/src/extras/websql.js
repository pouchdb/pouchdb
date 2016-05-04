import WebSqlPouchPlugin from 'pouchdb-adapter-node-websql';

var PDB = (typeof PouchDB !== 'undefined') ? PouchDB : require('pouchdb');
if (!PDB) {
  console.error('websql adapter plugin error: ' +
    'Cannot find global "PouchDB" object! ' +
    'Did you remember to include pouchdb.js?');
} else {
  WebSqlPouchPlugin(PDB);
}