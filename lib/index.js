"use strict";

import PouchDB from './setup';
import ajax from './deps/ajax/prequest';
import utils from './utils';
import errors from './deps/errors';
import replicate from './replicate/index';
import sync from './sync';
import version from './version';

PouchDB.ajax = ajax;
PouchDB.utils = utils;
PouchDB.Errors = errors;
PouchDB.replicate = replicate.replicate;
PouchDB.sync = sync;
PouchDB.version = version;
import httpAdapter from './adapters/http/index';
PouchDB.adapter('http', httpAdapter);
PouchDB.adapter('https', httpAdapter);

import mapreduce from './mapreduce/index';
PouchDB.plugin(mapreduce);

import adapters from './adapters';

Object.keys(adapters).forEach(function (adapterName) {
  PouchDB.adapter(adapterName, adapters[adapterName], true);
});

export default PouchDB;