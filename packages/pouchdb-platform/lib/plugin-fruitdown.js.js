import FruitdownPouchPlugin from 'pouchdb-adapter-fruitdown';
import './functionName-56a2e70f.js';
import 'node:events';
import 'clone-buffer';
import { g as guardedConsole } from './guardedConsole-f54e5a40.js';
import './pouchdb-errors.js';
import 'crypto';

// this code only runs in the browser, as its own dist/ script

if (typeof PouchDB === 'undefined') {
  guardedConsole('error', 'fruitdown adapter plugin error: ' +
    'Cannot find global "PouchDB" object! ' +
    'Did you remember to include pouchdb.js?');
} else {
  PouchDB.plugin(FruitdownPouchPlugin);
}
