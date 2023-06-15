import PouchDB from 'pouchdb-core';
export { default } from 'pouchdb-core';
import IDBPouch from 'pouchdb-adapter-idb';
import mapreduce from 'pouchdb-mapreduce';
import replication from 'pouchdb-replication';

PouchDB.plugin(IDBPouch)
  //.plugin(HttpPouch)
  .plugin(mapreduce)
  .plugin(replication);
