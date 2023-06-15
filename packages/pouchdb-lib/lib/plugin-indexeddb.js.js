import IndexeddbPouchPlugin from './pouchdb-adapter-indexeddb.js';
import './functionName-56a2e70f.js';
import 'node:events';
import 'clone-buffer';
import { g as guardedConsole } from './guardedConsole-f54e5a40.js';
import './pouchdb-errors.js';
import 'crypto';
import './pouchdb-utils.js';
import './rev-591f7bff.js';
import './stringMd5-15f53eba.js';
import './nextTick-ea093886.js';
import './clone-3530a126.js';
import './flatten-994f45c6.js';
import './isRemote-2533b7cb.js';
import './normalizeDdocFunctionName-ea3481cf.js';
import './once-de8350b9.js';
import './scopeEval-ff3a416d.js';
import './toPromise-42fa3440.js';
import './upsert-331b6913.js';
import './readAsBinaryString-06e911ba.js';
import './latest-0521537f.js';
import './rootToLeaf-f8d0e78a.js';
import './binaryStringToBlobOrBuffer-39ece35b.js';
import './typedBuffer-a8220a49.js';
import './parseDoc-a0994e12.js';
import './binaryMd5-601b2421.js';
import './merge-1e46cced.js';
import './collectConflicts-ad0b7c70.js';
import './removeLeafFromTree-913b121c.js';

// this code only runs in the browser, as its own dist/ script

if (typeof PouchDB === 'undefined') {
  guardedConsole('error', 'indexeddb adapter plugin error: ' +
    'Cannot find global "PouchDB" object! ' +
    'Did you remember to include pouchdb.js?');
} else {
  PouchDB.plugin(IndexeddbPouchPlugin);
}
