// this code only runs in the browser, as its own dist/ script

import LocalStoragePouchPlugin from 'pouchdb-adapter-localstorage';


if (typeof PouchDB === 'undefined') {
  console.error('localstorage adapter plugin error: ' +
    'Cannot find global "PouchDB" object! ' +
    'Did you remember to include pouchdb.js?');
} else {
  PouchDB.plugin(LocalStoragePouchPlugin);
}