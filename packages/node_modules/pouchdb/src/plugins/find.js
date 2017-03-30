/* global PouchDB */

// this code only runs in the browser, as its own dist/ script

import FindPlugin from 'pouchdb-find';
import { guardedConsole } from 'pouchdb-utils';

if (typeof PouchDB === 'undefined') {
  guardedConsole('error', 'pouchdb-find plugin error: ' +
    'Cannot find global "PouchDB" object! ' +
    'Did you remember to include pouchdb.js?');
} else {
  PouchDB.plugin(FindPlugin);
}