import localstorageAdapter from './pouchdb-adapter-localstorage.js';
import 'node:events';
import './index-15c7260a.js';
import './functionName-97119de9.js';
import { g as guardedConsole } from './guardedConsole-f54e5a40.js';
import 'crypto';
import './index-aa99f286.js';
import './_commonjsHelpers-24198af3.js';
import 'events';
import 'util';
import 'buffer';
import './inherits-febe64f8.js';
import 'stream';
import 'assert';
import './index-977ff4f9.js';
import './pouchdb-core.js';
import './upsert-bb51d1b8.js';
import 'http';
import 'url';
import './abort-controller-08d1ea45.js';
import 'punycode';
import 'https';
import 'zlib';
import './v4-b7ee9c0c.js';
import './pick-60e95b5a.js';
import './nextTick-ea093886.js';
import './clone-9d9f421b.js';
import './rev-75d26c01.js';
import './isRemote-2533b7cb.js';
import './once-de8350b9.js';
import './collectConflicts-ad0b7c70.js';
import './rootToLeaf-f8d0e78a.js';
import './isLocalId-d067de54.js';
import './findPathToLeaf-7e69c93c.js';
import 'pouchdb-utils.js';
import './pouchdb-changes-filter.js';
import './normalizeDdocFunctionName-ea3481cf.js';
import './matches-selector-e1c3dac5.js';
import './index-7f131e04.js';
import 'vm';
import './index-f8a9e0ec.js';
import './allDocsKeysQuery-9ff66512.js';
import './binaryStringToBlobOrBuffer-3ba36433.js';
import './typedBuffer-a8220a49.js';
import './latest-0521537f.js';
import './binaryMd5-601b2421.js';
import './processDocs-62433f84.js';
import './merge-1e46cced.js';
import './revExists-12209d1c.js';
import './safeJsonStringify-6520e306.js';
import './changesHandler-c020580c.js';
import './filterChange-0090dde4.js';
import './index-f7cc900c.js';

// this code only runs in the browser, as its own dist/ script

if (typeof PouchDB === 'undefined') {
  guardedConsole('error', 'localstorage adapter plugin error: ' +
    'Cannot find global "PouchDB" object! ' +
    'Did you remember to include pouchdb.js?');
} else {
  PouchDB.plugin(localstorageAdapter);
}
