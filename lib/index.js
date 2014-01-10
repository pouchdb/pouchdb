"use strict";

require('./deps/es5_shims');

var PouchDB = require('./setup');

module.exports = PouchDB;

PouchDB.ajax = require('./deps/ajax');
PouchDB.extend = require('./deps/extend');
PouchDB.utils = require('./utils');
PouchDB.Errors = require('./deps/errors');
PouchDB.replicate = require('./replicate').replicate;
PouchDB.version = require('./version');
var httpAdapter = require('./adapters/http');
PouchDB.adapter('http', httpAdapter);
PouchDB.adapter('https', httpAdapter);

PouchDB.adapter('idb', require('./adapters/idb'));
PouchDB.adapter('websql', require('./adapters/websql'));
PouchDB.plugin('mapreduce', require('pouchdb-mapreduce'));

if (!process.browser) {
  var ldbAdapter = require('./adapters/leveldb');
  PouchDB.adapter('ldb', ldbAdapter);
  PouchDB.adapter('leveldb', ldbAdapter);
}
