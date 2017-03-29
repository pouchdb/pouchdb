/* global PouchDB */

// this code only runs in the browser, as its own dist/ script

import LocalStoragePouchPlugin from 'pouchdb-adapter-localstorage';
import { guardedConsole } from 'pouchdb-utils';

if (typeof PouchDB === 'undefined') {
  guardedConsole('error', 'localstorage adapter plugin error: ' +
    'Cannot find global "PouchDB" object! ' +
    'Did you remember to include pouchdb.js?');
} else {
  PouchDB.plugin(LocalStoragePouchPlugin);
}