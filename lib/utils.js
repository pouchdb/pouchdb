'use strict';

//
// PouchDB.utils is basically a throwback to the pre-Browserify days,
// when this was the easiest way to access global utilities from anywhere
// in the project. For code cleanliness, we're trying to remove this file,
// but for practical reasons (legacy code, test code, etc.) this is still here.
//

// TODO: only used by the integration tests, which have
// some tests that explicitly override PouchDB.utils.ajax
exports.ajax = require('./deps/ajax/prequest');

// TODO: only used by the integration tests
exports.parseUri = require('./deps/parseUri');

// TODO: only used by the integration tests
exports.uuid = require('./deps/uuid');

// TODO: used by the integration tests and elsewhere, possibly
// even in the PouchDB guide and example code
var Promise = require('./deps/promise');
exports.Promise = Promise;

// TODO: only used by the integration tests
var base64 = require('./deps/binary/base64');
exports.atob = base64.atob;
exports.btoa = base64.btoa;

// TODO: only used by the integration tests
var binToBluffer = require('./deps/binary/binaryStringToBlobOrBuffer');
exports.binaryStringToBlobOrBuffer = binToBluffer;

// TODO: pretty sure these are in widespread use by Hoodie and others,
// also in the integration tests
exports.clone = require('./deps/clone');
exports.extend = require('js-extend').extend;
