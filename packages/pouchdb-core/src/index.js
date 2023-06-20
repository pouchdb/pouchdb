import PouchDB from './setup.js';
import pouchChangesFilter from 'pouchdb-changes-filter';

// TODO: remove from pouchdb-core (breaking)
PouchDB.plugin(pouchChangesFilter);

export default PouchDB;
