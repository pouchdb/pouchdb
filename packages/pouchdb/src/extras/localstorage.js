/* global PouchDB */

import LocalStoragePouch from 'pouchdb-adapter-localstorage';
var name = 'localstorage';

var PDB = (typeof PouchDB !== 'undefined') ? PouchDB : require('pouchdb');
if (!PDB) {
  console.error(name + ' adapter plugin error: ' +
    'Cannot find global "PouchDB" object! ' +
    'Did you remember to include pouchdb.js?');
} else {
  PDB.adapter(name, LocalStoragePouch, true);
}