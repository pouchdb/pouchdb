import PouchDB from './setup';
import ajax from 'pouchdb-ajax';
import utils from './utils';
import { errors } from 'pouchdb-errors';
import replicate from './replicate/index';
import sync from './sync';

PouchDB.ajax = ajax;
PouchDB.utils = utils;
PouchDB.Errors = errors;
PouchDB.replicate = replicate.replicate;
PouchDB.sync = sync;
PouchDB.version = '__VERSION__'; // will be automatically supplied by build.sh

export default PouchDB;