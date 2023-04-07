// this code only runs in the browser, as its own dist/ script

import IndexeddbPouchPlugin from 'pouchdb-adapter-indexeddb';


if (typeof PouchDB === 'undefined') {
  console.error('indexeddb adapter plugin error: ' +
    'Cannot find global "PouchDB" object! ' +
    'Did you remember to include pouchdb.js?');
} else {
  PouchDB.plugin(IndexeddbPouchPlugin);
}