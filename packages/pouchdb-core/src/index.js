import PouchDB from './setup';
import ajax from './deps/ajax/prequest';
import utils from './utils';
import { errors } from './deps/errors';
import replicate from './replicate/index';
import sync from './sync';
import httpAdapter from './adapters/http/index';
import mapreduce from './mapreduce/index';
import adapters from './adapters';

PouchDB.ajax = ajax;
PouchDB.utils = utils;
PouchDB.Errors = errors;
PouchDB.replicate = replicate.replicate;
PouchDB.sync = sync;
PouchDB.version = '__VERSION__'; // will be automatically supplied by build.sh
PouchDB.adapter('http', httpAdapter);
PouchDB.adapter('https', httpAdapter);

PouchDB.plugin(mapreduce);

Object.keys(adapters).forEach(function (adapterName) {
  PouchDB.adapter(adapterName, adapters[adapterName], true);
});

export default PouchDB;