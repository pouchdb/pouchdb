"use strict";

import PouchDB from './setup';

export default  PouchDB;

PouchDB.ajax = require('./deps/ajax/prequest');
PouchDB.utils = require('./utils');
PouchDB.Errors = require('./deps/errors');
PouchDB.replicate = require('./replicate').replicate;
PouchDB.sync = require('./sync');
PouchDB.version = require('./version');
import httpAdapter from './adapters/http/index';
PouchDB.adapter('http', httpAdapter);
PouchDB.adapter('https', httpAdapter);

PouchDB.plugin(require('./mapreduce/index'));

import adapters from './adapters';

Object.keys(adapters).forEach(function (adapterName) {
  PouchDB.adapter(adapterName, adapters[adapterName], true);
});
