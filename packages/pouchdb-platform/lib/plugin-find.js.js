import plugin from './pouchdb-find.js';
import './functionName-56a2e70f.js';
import 'node:events';
import 'clone-buffer';
import { g as guardedConsole } from './guardedConsole-f54e5a40.js';
import './pouchdb-errors.js';
import 'crypto';
import './isRemote-2533b7cb.js';
import './toPromise-42fa3440.js';
import './clone-3530a126.js';
import './once-de8350b9.js';
import './fetch-ad491323.js';
import 'stream';
import 'http';
import 'url';
import 'punycode';
import 'https';
import 'zlib';
import 'fetch-cookie';
import './matches-selector-02a28973.js';
import './index-7f131e04.js';
import './nextTick-ea093886.js';
import './pouchdb-abstract-mapreduce.js';
import './flatten-994f45c6.js';
import './base64StringToBlobOrBuffer-3fd03be6.js';
import './typedBuffer-a8220a49.js';
import './upsert-331b6913.js';
import './pouchdb-crypto.js';
import './pouchdb-mapreduce-utils.js';

// this code only runs in the browser, as its own dist/ script

if (typeof PouchDB === 'undefined') {
  guardedConsole('error', 'pouchdb-find plugin error: ' +
    'Cannot find global "PouchDB" object! ' +
    'Did you remember to include pouchdb.js?');
} else {
  PouchDB.plugin(plugin);
}
