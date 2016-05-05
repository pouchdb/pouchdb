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
import { atob as atob, btoa as btoa } from './deps/binary/base64';

// TODO: required by tests
import {createError } from './deps/errors';

// TODO: only used by the integration tests
import binToBluffer from './deps/binary/binaryStringToBlobOrBuffer';

// TODO: pretty sure these are in widespread use by Hoodie and others,
// also in the integration tests
import clone from './deps/clone';
import jsExtend from 'js-extend';
var extend = jsExtend.extend;

export default {
  ajax: ajax,
  parseUri: parseUri,
  uuid: uuid,
  Promise: Promise,
  atob: atob,
  btoa: btoa,
  binaryStringToBlobOrBuffer: binToBluffer,
  clone: clone,
  extend: extend,
  createError: createError
};