import WebsqlPouchPlugin from 'pouchdb-adapter-websql';
import 'node:events';
import './functionName-706c6c65.js';
import { g as guardedConsole } from './guardedConsole-f54e5a40.js';
import './pouchdb-errors.js';
import 'crypto';
import './_commonjsHelpers-24198af3.js';
import 'buffer';

// this code only runs in the browser, as its own dist/ script

if (typeof PouchDB === 'undefined') {
  guardedConsole('error', 'websql adapter plugin error: ' +
    'Cannot find global "PouchDB" object! ' +
    'Did you remember to include pouchdb.js?');
} else {
  PouchDB.plugin(WebsqlPouchPlugin);
}
