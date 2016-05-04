/* global PouchDB */

import MemoryPouch from 'pouchdb-adapter-memory';

var PDB = (typeof PouchDB !== 'undefined') ? PouchDB : require('pouchdb');
if (!PDB) {
  console.error('memory adapter plugin error: ' +
    'Cannot find global "PouchDB" object! ' +
    'Did you remember to include pouchdb.js?');
} else {
  PDB.adapter(name, MemoryPouch, true);
}