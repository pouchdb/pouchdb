import PouchDB from './setup';
import ajax from 'pouchdb-ajax';
import utils from './utils';
import { errors } from 'pouchdb-errors';

// TODO: don't export these
PouchDB.ajax = ajax;
PouchDB.utils = utils;
PouchDB.Errors = errors;

// TODO: needs to be manually kept in sync with package.json
PouchDB.version = '5.4.0-prerelease';

export default PouchDB;