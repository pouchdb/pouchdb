// this code only runs in the browser, as its own dist/ script

import WebsqlPouchPlugin from '../../pouchdb-adapter-websql';


if (typeof PouchDB === 'undefined') {
  console.error('websql adapter plugin error: ' +
    'Cannot find global "PouchDB" object! ' +
    'Did you remember to include pouchdb.js?');
} else {
  PouchDB.plugin(WebsqlPouchPlugin);
}