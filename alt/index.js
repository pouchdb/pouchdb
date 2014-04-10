"use strict";

var PouchDB = require('../lib/setup');

module.exports = PouchDB;

PouchDB.ajax = require('../lib/deps/ajax');
PouchDB.utils = require('../lib/utils');
PouchDB.Errors = require('../lib/deps/errors');
var replicate = require('../lib/replicate');
PouchDB.replicate = replicate.replicate;
PouchDB.sync = replicate.sync;
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
