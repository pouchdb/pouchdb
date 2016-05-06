/* global PouchDB */

import FruitdownPouch from 'pouchdb-adapter-fruitdown';
var name = 'fruitdown';

var PDB = (typeof PouchDB !== 'undefined') ? PouchDB : require('pouchdb');
if (!PDB) {
  console.error(name + ' adapter plugin error: ' +
    'Cannot find global "PouchDB" object! ' +
    'Did you remember to include pouchdb.js?');
} else {
  PDB.adapter(name, FruitdownPouch, true);
}