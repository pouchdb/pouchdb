import localstorageAdapter from './pouchdb-adapter-localstorage.js';
import 'node:events';
import './functionName-706c6c65.js';
import { g as guardedConsole } from './guardedConsole-f54e5a40.js';
import './pouchdb-errors.js';
import 'crypto';
import './index-3d81fcba.js';
import './_commonjsHelpers-24198af3.js';
import 'events';
import 'util';
import 'buffer';
import './readable-bcb7bff2.js';
import 'stream';
import 'assert';
import './pouchdb-core.js';
import './fetch-f2310cb2.js';
import 'http';
import 'url';
import 'punycode';
import 'https';
import 'zlib';
import './rev-48662a2a.js';
import './stringMd5-15f53eba.js';
import './nextTick-ea093886.js';
import './clone-7eeb6295.js';
import './isRemote-2533b7cb.js';
import './upsert-331b6913.js';
import './once-de8350b9.js';
import './collectConflicts-ad0b7c70.js';
import './rootToLeaf-f8d0e78a.js';
import './isLocalId-d067de54.js';
import './pouchdb-platform.js';
import 'node:assert';
import 'node:fs';
import 'node:buffer';
import 'node:crypto';
import 'node:stream';
import 'node:http';
import 'node:url';
import 'node:https';
import 'node:zlib';
import 'node:util';
import 'node:vm';
import 'node:path';
import 'node:os';
import './findPathToLeaf-7e69c93c.js';
import 'pouchdb-utils.js';
import './pouchdb-changes-filter.js';
import './normalizeDdocFunctionName-ea3481cf.js';
import './matches-selector-87ab4d5f.js';
import './pouchdb-collate.js';
import 'vm';
import './pouchdb-utils.js';
import './flatten-994f45c6.js';
import './scopeEval-ff3a416d.js';
import './toPromise-f6e385ee.js';
import './allDocsKeysQuery-7f4fbcb9.js';
import './parseDoc-71681539.js';
import './latest-0521537f.js';
import './binaryStringToBlobOrBuffer-39ece35b.js';
import './typedBuffer-a8220a49.js';
import './binaryMd5-601b2421.js';
import './processDocs-7c802567.js';
import './merge-1e46cced.js';
import './revExists-12209d1c.js';
import './safeJsonStringify-6520e306.js';

// this code only runs in the browser, as its own dist/ script

if (typeof PouchDB === 'undefined') {
  guardedConsole('error', 'localstorage adapter plugin error: ' +
    'Cannot find global "PouchDB" object! ' +
    'Did you remember to include pouchdb.js?');
} else {
  PouchDB.plugin(localstorageAdapter);
}
