/* global PouchDB */

import FruitdownPouchPlugin from 'pouchdb-adapter-fruitdown';
import { guardedConsole } from 'pouchdb-utils';

var PDB = (typeof PouchDB !== 'undefined') ? PouchDB : require('pouchdb');
if (!PDB) {
  guardedConsole('error', 'fruitdown adapter plugin error: ' +
    'Cannot find global "PouchDB" object! ' +
    'Did you remember to include pouchdb.js?');
} else {
  FruitdownPouchPlugin(PDB);
}
