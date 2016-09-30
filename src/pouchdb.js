// Pull from src because pouchdb-node/pouchdb-browser themselves
// are aggressively optimized and jsnext:main would normally give us this
// aggressive bundle.
import PouchDB from 'pouchdb-node/src/index';
export default PouchDB;