import IndexeddbPouchPlugin from './pouchdb-adapter-indexeddb.js';
import './functionName-706c6c65.js';
import 'node:events';
import { g as guardedConsole } from './guardedConsole-f54e5a40.js';
import './pouchdb-errors.js';
import 'crypto';
import './pouchdb-utils.js';
import './bulkGetShim-df36314d.js';
import './toPromise-1031f2f4.js';
import './clone-7eeb6295.js';
import './nextTick-ea093886.js';
import './parseUri-6d6043cb.js';
import './flatten-994f45c6.js';
import './rev-fc9bde4f.js';
import './stringMd5-15f53eba.js';
import './isRemote-f9121da9.js';
import './normalizeDdocFunctionName-ea3481cf.js';
import './scopeEval-ff3a416d.js';
import './upsert-331b6913.js';
import './readAsBinaryString-06e911ba.js';
import './latest-0521537f.js';
import './rootToLeaf-f8d0e78a.js';
import './binaryStringToBlobOrBuffer-39ece35b.js';
import './typedBuffer-a8220a49.js';
import './parseDoc-4c54e1d0.js';
import './binaryMd5-601b2421.js';
import './merge-7299d068.js';
import './collectConflicts-6afe46fc.js';
import './removeLeafFromTree-1fae4da6.js';
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
