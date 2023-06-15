import PouchDB from 'pouchdb-lib/lib/pouchdb-node.js';
import utils from './utils.js';
import errors from './errors.js';
import * as collate from 'pouchdb-lib/lib/pouchdb-collate.js';
// explicitly include pouchdb-find so coverage captures it correctly
import find from 'pouchdb-lib/lib/pouchdb-find.js';

PouchDB.utils = utils;
PouchDB.Errors = errors;
PouchDB.collate = collate;
PouchDB.plugin(find);

export default PouchDB;
