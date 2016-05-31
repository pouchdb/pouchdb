/* global PouchDB */

import MemoryPouchPlugin from 'pouchdb-adapter-memory';
import { guardedConsole } from 'pouchdb-utils';

var PDB = (typeof PouchDB !== 'undefined') ? PouchDB : require('pouchdb');
if (!PDB) {
  guardedConsole('error', 'memory adapter plugin error: ' +
    'Cannot find global "PouchDB" object! ' +
    'Did you remember to include pouchdb.js?');
} else {
  MemoryPouchPlugin(PDB);
}
