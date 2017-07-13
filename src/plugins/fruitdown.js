/* global PouchDB */

// this code only runs in the browser, as its own dist/ script

import FruitdownPouchPlugin from 'pouchdb-adapter-fruitdown';
import { guardedConsole } from 'pouchdb-utils';

if (typeof PouchDB === 'undefined') {
  guardedConsole('error', 'fruitdown adapter plugin error: ' +
    'Cannot find global "PouchDB" object! ' +
    'Did you remember to include pouchdb.js?');
} else {
  PouchDB.plugin(FruitdownPouchPlugin);
}