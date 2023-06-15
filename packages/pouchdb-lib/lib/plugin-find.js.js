import { p as plugin } from './index-b3add1a7.js';
import 'node:events';
import './index-15c7260a.js';
import './functionName-97119de9.js';
import { g as guardedConsole } from './guardedConsole-f54e5a40.js';
import 'crypto';
import './isRemote-2533b7cb.js';
import './toPromise-05472f25.js';
import './clone-9d9f421b.js';
import './once-de8350b9.js';
import './upsert-bb51d1b8.js';
import 'stream';
import 'http';
import 'url';
import './abort-controller-08d1ea45.js';
import 'punycode';
import './_commonjsHelpers-24198af3.js';
import 'util';
import 'https';
import 'zlib';
import './matches-selector-e1c3dac5.js';
import './index-7f131e04.js';
import './nextTick-ea093886.js';
import './index-bd745a58.js';
import './flatten-994f45c6.js';
import './base64StringToBlobOrBuffer-3fd03be6.js';
import './typedBuffer-a8220a49.js';
import './pouchdb-crypto.js';
import 'buffer';

// this code only runs in the browser, as its own dist/ script

if (typeof PouchDB === 'undefined') {
  guardedConsole('error', 'pouchdb-find plugin error: ' +
    'Cannot find global "PouchDB" object! ' +
    'Did you remember to include pouchdb.js?');
} else {
  PouchDB.plugin(plugin);
}
