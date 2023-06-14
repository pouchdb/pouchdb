import MemoryPouchPlugin from './pouchdb-adapter-memory.js';
import './functionName-706c6c65.js';
import 'node:events';
import { g as guardedConsole } from './guardedConsole-f54e5a40.js';
import './pouchdb-errors.js';
import 'crypto';
import './index-fef66c7c.js';
import './_commonjsHelpers-24198af3.js';
import 'events';
import 'util';
import 'buffer';
import './index-a12c08e4.js';
import 'stream';
import 'assert';
import './pouchdb-core.js';
import './bulkGetShim-df36314d.js';
import './toPromise-1031f2f4.js';
import './clone-7eeb6295.js';
import './nextTick-ea093886.js';
import './rev-fc9bde4f.js';
import './stringMd5-15f53eba.js';
import './isRemote-f9121da9.js';
import './upsert-331b6913.js';
import './collectConflicts-6afe46fc.js';
import './rootToLeaf-f8d0e78a.js';
import './isLocalId-d067de54.js';
import './findPathToLeaf-7e69c93c.js';
import './pouchdb-fetch.js';
import 'http';
import 'url';
import 'punycode';
import 'https';
import 'zlib';
import './pouchdb-changes-filter.js';
import './normalizeDdocFunctionName-ea3481cf.js';
import './pouchdb-selector-core.js';
import './index-3a476dad.js';
import 'vm';
import './pouchdb-utils.js';
import './parseUri-6d6043cb.js';
import './flatten-994f45c6.js';
import './scopeEval-ff3a416d.js';
import './allDocsKeysQuery-9ff66512.js';
import './parseDoc-4c54e1d0.js';
import './latest-0521537f.js';
import './binaryStringToBlobOrBuffer-39ece35b.js';
import './typedBuffer-a8220a49.js';
import './binaryMd5-601b2421.js';
import './processDocs-3dd3facd.js';
import './merge-7299d068.js';
import './revExists-12209d1c.js';
import './pouchdb-json.js';

// this code only runs in the browser, as its own dist/ script


if (typeof PouchDB === 'undefined') {
  guardedConsole('error', 'memory adapter plugin error: ' +
    'Cannot find global "PouchDB" object! ' +
    'Did you remember to include pouchdb.js?');
} else {
  PouchDB.plugin(MemoryPouchPlugin);
}
