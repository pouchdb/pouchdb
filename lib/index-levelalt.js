"use strict";

require('./deps/es5_shims');

var PouchDB = require('./setup');

module.exports = PouchDB;

PouchDB.ajax = require('./deps/ajax');
PouchDB.extend = require('./deps/extend');
PouchDB.utils = require('./utils');
PouchDB.Errors = require('./deps/errors');
var replicate = require('./replicate');
PouchDB.replicate = replicate.replicate;
PouchDB.sync = replicate.sync;
PouchDB.version = require('./version');
var httpAdapter = require('./adapters/http');
PouchDB.adapter('http', httpAdapter);
PouchDB.adapter('https', httpAdapter);

PouchDB.adapter('idb', require('./adapters/idb'));
PouchDB.adapter('websql', require('./adapters/websql'));
PouchDB.plugin(require('pouchdb-mapreduce'));

var ldbAdapter = require('./adapters/leveldb');
PouchDB.adapter('ldb', ldbAdapter);
PouchDB.adapter('leveldb', ldbAdapter);
PouchDB.adapter('levelalt', require('./adapters/levelalt'));
