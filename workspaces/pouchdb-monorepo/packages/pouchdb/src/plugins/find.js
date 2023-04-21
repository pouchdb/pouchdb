// this code only runs in the browser, as its own dist/ script

import FindPlugin from '../../pouchdb-find';


if (typeof PouchDB === 'undefined') {
  console.error('pouchdb-find plugin error: ' +
    'Cannot find global "PouchDB" object! ' +
    'Did you remember to include pouchdb.js?');
} else {
  PouchDB.plugin(FindPlugin);
}