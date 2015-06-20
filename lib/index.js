"use strict";

var PouchDB = require('./setup');

module.exports = PouchDB;

PouchDB.ajax = require('./pouch-request');
PouchDB.utils = require('./utils');
PouchDB.Errors = require('./deps/errors');
PouchDB.replicate = require('./replicate').replicate;
PouchDB.sync = require('./sync');
PouchDB.version = require('./version');
var httpAdapter = require('./adapters/http');
PouchDB.adapter('http', httpAdapter);
PouchDB.adapter('https', httpAdapter);

PouchDB.adapter('idb', require('./adapters/idb'), true);
PouchDB.adapter('websql', require('./adapters/websql'), true);
PouchDB.plugin(require('./mapreduce'));

if (!process.browser) {
  var ldbAdapter = require('./adapters/leveldb');
  PouchDB.adapter('leveldb', ldbAdapter, true);
}
