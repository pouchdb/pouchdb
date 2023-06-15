import WebsqlPouchPlugin from 'pouchdb-adapter-websql';
import { guardedConsole } from 'pouchdb-utils';

// this code only runs in the browser, as its own dist/ script

if (typeof PouchDB === 'undefined') {
  guardedConsole('error', 'websql adapter plugin error: ' +
    'Cannot find global "PouchDB" object! ' +
    'Did you remember to include pouchdb.js?');
} else {
  PouchDB.plugin(WebsqlPouchPlugin);
}
