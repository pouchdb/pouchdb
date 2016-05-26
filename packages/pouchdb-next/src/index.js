import PouchDB from 'pouchdb-core';

import IDBPouch from 'pouchdb-adapter-indexeddb';
import HttpPouch from 'pouchdb-adapter-http';
import replication from 'pouchdb-replication';

PouchDB.plugin(IDBPouch)
  .plugin(HttpPouch)
  .plugin(replication);

export default PouchDB;
