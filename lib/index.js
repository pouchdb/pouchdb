"use strict";

var PouchDB = require('./setup');

module.exports = PouchDB;

PouchDB.ajax = require('./deps/ajax/prequest');
PouchDB.utils = require('./utils');
PouchDB.Errors = require('./deps/errors');
PouchDB.replicate = require('./replicate').replicate;
PouchDB.sync = require('./sync');
PouchDB.version = require('./version');
var httpAdapter = require('./adapters/http');
PouchDB.adapter('http', httpAdapter);
PouchDB.adapter('https', httpAdapter);

PouchDB.plugin(require('./mapreduce'));

var adapters = require('./adapters');

Object.keys(adapters).forEach(function (adapterName) {
  PouchDB.adapter(adapterName, adapters[adapterName], true);
});
