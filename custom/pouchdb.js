'use strict';

var PouchDB = require('../lib/setup');

PouchDB.utils = require('../lib/utils');
PouchDB.Errors = require('../lib/deps/errors');
PouchDB.version = require('../lib/version');

module.exports = PouchDB;