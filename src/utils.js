'use strict';

//
// PouchDB.utils is basically a throwback to the pre-Browserify days,
// when this was the easiest way to access global utilities from anywhere
// in the project. For code cleanliness, we're trying to remove this file,
// but for practical reasons (legacy code, test code, etc.) this is still here.
//

// TODO: only used by the integration tests, which have
// some tests that explicitly override PouchDB.utils.ajax
var ajax = require('./deps/ajax/prequest');

// TODO: only used by the integration tests
var parseUri = require('./deps/parseUri');

// TODO: only used by the integration tests
var uuid = require('./deps/uuid');

// TODO: used by the integration tests and elsewhere, possibly
// even in the PouchDB guide and example code
import Promise from './deps/promise';
var Promise = Promise;

// TODO: only used by the integration tests
import { atob as atob, btoa as btoa } from './deps/binary/base64';

// TODO: only used by the integration tests
import binToBluffer from './deps/binary/binaryStringToBlobOrBuffer';
var binaryStringToBlobOrBuffer = binToBluffer;

// TODO: pretty sure these are in widespread use by Hoodie and others,
// also in the integration tests
var clone = require('./deps/clone');
var extend = require('js-extend').extend;

export default {
  ajax: ajax,
  parseUri: parseUri,
  uuid: uuid,
  Promise: Promise,
  atob: atob,
  btoa: btoa,
  binaryStringToBlobOrBuffer: binaryStringToBlobOrBuffer,
  clone: clone,
  extend: extend
};