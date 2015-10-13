'use strict';

//
// PouchDB.utils is basically a throwback to the pre-Browserify days,
// when this was the easiest way to access global utilities from anywhere
// in the project. For code cleanliness, we're trying to remove this file,
// but for practical reasons (legacy code, test code, etc.) this is still here.
//

// TODO: only used by the integration tests, which have
// some tests that explicitly override PouchDB.utils.ajax
import ajax from './deps/ajax/prequest';

// TODO: only used by the integration tests
import parseUri from './deps/parseUri';

// TODO: only used by the integration tests
import uuid from './deps/uuid';

// TODO: used by the integration tests and elsewhere, possibly
// even in the PouchDB guide and example code
import Promise from './deps/promise';

// TODO: only used by the integration tests
import base64 from './deps/binary/base64';
var atob = base64.atob;
var btoa = base64.btoa;

// TODO: only used by the integration tests
import binToBluffer from './deps/binary/binaryStringToBlobOrBuffer';
var binaryStringToBlobOrBuffer = binToBluffer;

// TODO: pretty sure these are in widespread use by Hoodie and others,
// also in the integration tests
import clone from './deps/clone';
import extend from './deps/extend';

export default {
  ajax,
  parseUri,
  uuid,
  Promise,
  atob,
  btoa,
  binaryStringToBlobOrBuffer,
  clone,
  extend
};