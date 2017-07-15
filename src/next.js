import PouchDB from 'pouchdb-core';
import idbPouch from 'pouchdb-adapter-indexeddb';
import httpPouch from 'pouchdb-adapter-http';
import replication from 'pouchdb-replication';

export default PouchDB
  .plugin(idbPouch)
  .plugin(httpPouch)
  .plugin(replication);