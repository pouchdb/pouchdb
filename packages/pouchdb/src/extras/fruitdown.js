/* global PouchDB */

import FruitdownPouchPlugin from 'pouchdb-adapter-fruitdown';

var PDB = (typeof PouchDB !== 'undefined') ? PouchDB : require('pouchdb');
if (!PDB) {
  if(typeof console !== undefined && 'error' in console) {
    console.error('fruitdown adapter plugin error: ' +
      'Cannot find global "PouchDB" object! ' +
      'Did you remember to include pouchdb.js?');
  }
} else {
  FruitdownPouchPlugin(PDB);
}
