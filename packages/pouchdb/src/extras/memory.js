/* global PouchDB */

import MemoryPouchPlugin from 'pouchdb-adapter-memory';

var PDB = (typeof PouchDB !== 'undefined') ? PouchDB : require('pouchdb');
if (!PDB) {
  if(typeof console !== undefined && 'error' in console) {
    console.error('memory adapter plugin error: ' +
      'Cannot find global "PouchDB" object! ' +
      'Did you remember to include pouchdb.js?');
  }
} else {
  MemoryPouchPlugin(PDB);
}
