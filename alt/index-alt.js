"use strict";

var PouchDB = require('../lib/setup');

module.exports = PouchDB;

PouchDB.ajax = require('../lib/deps/ajax');
PouchDB.extend = require('extend');
PouchDB.utils = require('../lib/utils');
PouchDB.Errors = require('../lib/deps/errors');
PouchDB.replicate = require('../lib/replicate').replicate;
PouchDB.sync = require('../lib/sync');
PouchDB.version = require('../lib/version');
var httpAdapter = require('../lib/adapters/http');
PouchDB.adapter('http', httpAdapter);
PouchDB.adapter('https', httpAdapter);

PouchDB.adapter('idb', require('../lib/adapters/idb'));
PouchDB.adapter('websql', require('../lib/adapters/websql'));
PouchDB.plugin(require('pouchdb-mapreduce'));

var ldbAdapter = require('../lib/adapters/leveldb');
PouchDB.adapter('ldb', ldbAdapter);
PouchDB.adapter('leveldb', ldbAdapter);
PouchDB.adapter('levelalt', require('./levelalt'));
