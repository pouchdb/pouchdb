import localstorageAdapter from './pouchdb-adapter-localstorage.js';
import './functionName-56a2e70f.js';
import 'node:events';
import 'clone-buffer';
import { g as guardedConsole } from './guardedConsole-f54e5a40.js';
import './pouchdb-errors.js';
import 'crypto';
import './index-c5aea249.js';
import 'levelup';
import 'ltgt';
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
import 'level-codec';
import 'stream';
import 'events';
import 'buffer';
import 'util';
import 'double-ended-queue';
import './pouchdb-core.js';
import './fetch-ad491323.js';
import 'http';
import 'url';
import 'punycode';
import 'https';
import 'zlib';
import 'fetch-cookie';
import './rev-591f7bff.js';
import './stringMd5-15f53eba.js';
import './nextTick-ea093886.js';
import './clone-3530a126.js';
import './isRemote-2533b7cb.js';
import './upsert-331b6913.js';
import './once-de8350b9.js';
import './collectConflicts-ad0b7c70.js';
import './rootToLeaf-f8d0e78a.js';
import './isLocalId-d067de54.js';
import './findPathToLeaf-7e69c93c.js';
import 'pouchdb-utils.js';
import './pouchdb-changes-filter.js';
import './normalizeDdocFunctionName-ea3481cf.js';
import './matches-selector-db0b5c42.js';
import './pouchdb-collate.js';
import 'vm';
import './pouchdb-utils.js';
import './flatten-994f45c6.js';
import './scopeEval-ff3a416d.js';
import './toPromise-42fa3440.js';
import './allDocsKeysQuery-7f4fbcb9.js';
import './parseDoc-a0994e12.js';
import './latest-0521537f.js';
import './binaryStringToBlobOrBuffer-39ece35b.js';
import './typedBuffer-a8220a49.js';
import './processDocs-2980e64a.js';
import './merge-1e46cced.js';
import './revExists-12209d1c.js';
import './safeJsonStringify-a65d9a0c.js';
import 'vuvuzela';
import 'pouchdb-lib/lib/pouchdb-md5.js';
import 'localstorage-down';

// this code only runs in the browser, as its own dist/ script

if (typeof PouchDB === 'undefined') {
  guardedConsole('error', 'localstorage adapter plugin error: ' +
    'Cannot find global "PouchDB" object! ' +
    'Did you remember to include pouchdb.js?');
} else {
  PouchDB.plugin(localstorageAdapter);
}
