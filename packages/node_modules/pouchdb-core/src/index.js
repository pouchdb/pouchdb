import PouchDB from './setup';
import version from './version';
import pouchChangesFilter from 'pouchdb-changes-filter';

// TODO: remove from pouchdb-core (breaking)
PouchDB.plugin(pouchChangesFilter);

PouchDB.version = version;

export default PouchDB;
