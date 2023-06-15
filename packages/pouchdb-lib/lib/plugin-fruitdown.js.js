import FruitdownPouchPlugin from 'pouchdb-adapter-fruitdown';
import 'node:events';
import './index-15c7260a.js';
import './functionName-97119de9.js';
import { g as guardedConsole } from './guardedConsole-f54e5a40.js';
import 'crypto';
import './_commonjsHelpers-24198af3.js';
import 'buffer';

// this code only runs in the browser, as its own dist/ script

if (typeof PouchDB === 'undefined') {
  guardedConsole('error', 'fruitdown adapter plugin error: ' +
    'Cannot find global "PouchDB" object! ' +
    'Did you remember to include pouchdb.js?');
} else {
  PouchDB.plugin(FruitdownPouchPlugin);
}
