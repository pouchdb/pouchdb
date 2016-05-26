import PouchDB from 'pouchdb-core';

import IDBPouch from 'pouchdb-adapter-idb';
import WebSqlPouch from 'pouchdb-adapter-websql';
import HttpPouch from 'pouchdb-adapter-http';
import mapreduce from 'pouchdb-mapreduce';
import replication from 'pouchdb-replication';

PouchDB.plugin(IDBPouch)
  .plugin(WebSqlPouch)
  .plugin(HttpPouch)
  .plugin(mapreduce)
  .plugin(replication);

export default PouchDB;
