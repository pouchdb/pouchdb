import PouchDB from './pouchdb';
import utils from './utils';
import errors from './errors';
import * as collate from 'pouchdb-collate';
// explicitly include pouchdb-find so coverage captures it correctly
import find from 'pouchdb-find';

PouchDB.utils = utils;
PouchDB.Errors = errors;
PouchDB.collate = collate;
PouchDB.plugin(find);

export default PouchDB;
