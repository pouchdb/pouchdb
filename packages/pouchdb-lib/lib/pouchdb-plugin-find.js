import plugin from './pouchdb-find.js';
import 'node:events';
import './functionName-706c6c65.js';
import { g as guardedConsole } from './guardedConsole-f54e5a40.js';
import './pouchdb-errors.js';
import 'crypto';
import './isRemote-2533b7cb.js';
import './toPromise-f6e385ee.js';
import './clone-7eeb6295.js';
import './once-de8350b9.js';
import './fetch-f2310cb2.js';
import 'stream';
import 'http';
import 'url';
import 'punycode';
import 'https';
import 'zlib';
import './_commonjsHelpers-24198af3.js';
import 'util';
import './matches-selector-87ab4d5f.js';
import './pouchdb-collate.js';
import './nextTick-ea093886.js';
import './pouchdb-abstract-mapreduce.js';
import './flatten-994f45c6.js';
import './base64StringToBlobOrBuffer-3fd03be6.js';
import './typedBuffer-a8220a49.js';
import './upsert-331b6913.js';
import './pouchdb-crypto.js';
import './pouchdb-mapreduce-utils.js';
import 'buffer';

// this code only runs in the browser, as its own dist/ script

if (typeof PouchDB === 'undefined') {
  guardedConsole('error', 'pouchdb-find plugin error: ' +
    'Cannot find global "PouchDB" object! ' +
    'Did you remember to include pouchdb.js?');
} else {
  PouchDB.plugin(plugin);
}
