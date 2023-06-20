// import directly from src rather than jsnext:main because in ths case
// the jsnext:main is actually built (lib/index*.es.js)
import PouchDB from 'pouchdb-node/src/index';
export default PouchDB;
