import IndexeddbPouchPlugin from './pouchdb-adapter-indexeddb.js';
import 'node:events';
import './index-15c7260a.js';
import './functionName-97119de9.js';
import { g as guardedConsole } from './guardedConsole-f54e5a40.js';
import 'crypto';
import './changesHandler-c020580c.js';
import './pick-60e95b5a.js';
import './nextTick-ea093886.js';
import './index-f8a9e0ec.js';
import './v4-b7ee9c0c.js';
import './readAsBinaryString-06e911ba.js';
import './latest-0521537f.js';
import './rootToLeaf-f8d0e78a.js';
import './binaryStringToBlobOrBuffer-39ece35b.js';
import './typedBuffer-a8220a49.js';
import './parseDoc-67781d71.js';
import './rev-5211ac7a.js';
import './invalidIdError-d6c03c27.js';
import './binaryMd5-601b2421.js';
import './merge-1e46cced.js';
import './collectConflicts-ad0b7c70.js';
import './filterChange-0090dde4.js';
import './removeLeafFromTree-af761a97.js';
import './clone-9d9f421b.js';
import './_commonjsHelpers-24198af3.js';
import 'buffer';

// this code only runs in the browser, as its own dist/ script

if (typeof PouchDB === 'undefined') {
  guardedConsole('error', 'indexeddb adapter plugin error: ' +
    'Cannot find global "PouchDB" object! ' +
    'Did you remember to include pouchdb.js?');
} else {
  PouchDB.plugin(IndexeddbPouchPlugin);
}
