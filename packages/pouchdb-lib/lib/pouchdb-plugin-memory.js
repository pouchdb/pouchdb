import index from './pouchdb-adapter-memory.js';
import 'node:events';
import './index-15c7260a.js';
import './functionName-97119de9.js';
import { g as guardedConsole } from './guardedConsole-f54e5a40.js';
import 'crypto';
import './index-eec34a7d.js';
import './binaryMd5-601b2421-d30c2c24.js';
import './_commonjsHelpers-24198af3.js';
import 'events';
import 'util';
import 'buffer';
import './inherits-febe64f8.js';
import 'stream';
import 'assert';
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
import './pouchdb-core.js';
import './fetch-dd6d0a21.js';
import 'http';
import 'url';
import './abort-controller-b8f44fb2.js';
import 'punycode';
import 'https';
import 'zlib';
import './index-31837118.js';
import './v4-b7ee9c0c.js';
import './pick-60e95b5a.js';
import './nextTick-ea093886.js';
import './clone-9d9f421b.js';
import './invalidIdError-d6c03c27.js';
import './isRemote-2533b7cb.js';
import './upsert-331b6913.js';
import './rev-5211ac7a.js';
import './once-de8350b9.js';
import './collectConflicts-ad0b7c70.js';
import './rootToLeaf-f8d0e78a.js';
import './isLocalId-d067de54.js';
import './findPathToLeaf-7e69c93c.js';
import 'pouchdb-utils.js';
import './pouchdb-changes-filter.js';
import './normalizeDdocFunctionName-ea3481cf.js';
import './matches-selector-96146c79.js';
import './index-618b2bca.js';
import 'vm';
import './index-f8a9e0ec.js';
import './allDocsKeysQuery-7f4fbcb9.js';
import './parseDoc-67781d71.js';
import './latest-0521537f.js';
import './binaryStringToBlobOrBuffer-39ece35b.js';
import './typedBuffer-a8220a49.js';
import './processDocs-f320a035.js';
import './merge-1e46cced.js';
import './revExists-12209d1c.js';
import './safeJsonStringify-74893f3d.js';
import './index-ddf3f5c0.js';
import './changesHandler-c020580c.js';
import './filterChange-0090dde4.js';

// this code only runs in the browser, as its own dist/ script

if (typeof PouchDB === 'undefined') {
  guardedConsole('error', 'memory adapter plugin error: ' +
    'Cannot find global "PouchDB" object! ' +
    'Did you remember to include pouchdb.js?');
} else {
  PouchDB.plugin(index);
}
