/* global PouchDB */

import LocalStoragePouchPlugin from 'pouchdb-adapter-localstorage';

var PDB = (typeof PouchDB !== 'undefined') ? PouchDB : require('pouchdb');
if (!PDB) {
  if(typeof console !== undefined && 'error' in console) {
    console.error('localstorage adapter plugin error: ' +
      'Cannot find global "PouchDB" object! ' +
      'Did you remember to include pouchdb.js?');
  }
} else {
  LocalStoragePouchPlugin(PDB);
}
