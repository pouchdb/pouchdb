// this code only runs in the browser, as its own dist/ script

import MemoryPouchPlugin from 'pouchdb-adapter-memory';


if (typeof PouchDB === 'undefined') {
  console.error('memory adapter plugin error: ' +
    'Cannot find global "PouchDB" object! ' +
    'Did you remember to include pouchdb.js?');
} else {
  PouchDB.plugin(MemoryPouchPlugin);
}