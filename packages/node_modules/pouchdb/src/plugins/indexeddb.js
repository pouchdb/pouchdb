// this code only runs in the browser, as its own dist/ script

import IndexeddbPouchPlugin from 'pouchdb-adapter-indexeddb';
import { guardedConsole } from 'pouchdb-utils';

if (typeof PouchDB === 'undefined') {
  guardedConsole('error', 'indexeddb adapter plugin error: ' +
    'Cannot find global "PouchDB" object! ' +
    'Did you remember to include pouchdb.js?');
} else {
  PouchDB.plugin(IndexeddbPouchPlugin);
}
