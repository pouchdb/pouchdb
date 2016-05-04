/* global PouchDB */

import MemoryPouch from 'pouchdb-adapter-memory';
var name = 'memory';

var PDB = (typeof PouchDB !== 'undefined') ? PouchDB : require('pouchdb');
if (!PDB) {
  console.error(name + ' adapter plugin error: ' +
    'Cannot find global "PouchDB" object! ' +
    'Did you remember to include pouchdb.js?');
} else {
  PDB.adapter(name, MemoryPouch, true);
}