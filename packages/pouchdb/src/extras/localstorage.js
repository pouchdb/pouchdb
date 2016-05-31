/* global PouchDB */

import LocalStoragePouchPlugin from 'pouchdb-adapter-localstorage';
import { guardedConsole } from 'pouchdb-utils';

var PDB = (typeof PouchDB !== 'undefined') ? PouchDB : require('pouchdb');
if (!PDB) {
  guardedConsole('error', 'localstorage adapter plugin error: ' +
    'Cannot find global "PouchDB" object! ' +
    'Did you remember to include pouchdb.js?');
} else {
  LocalStoragePouchPlugin(PDB);
}
