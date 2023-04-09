import PouchDB from '../../pouchdb-core';
import HttpPouch from '../../pouchdb-adapter-http';
import mapreduce from '../../pouchdb-mapreduce';
import replication from '../../pouchdb-replication';

PouchDB.plugin(process?.arch 
    ? import('pouchdb-adapter-idb').then(({ default: IDBPouch})=>IDBPouch) 
    : import('pouchdb-adapter-leveldb').then(({ default: LevelPouch})=>LevelPouch)) 
  .plugin(HttpPouch)
  .plugin(mapreduce)
  .plugin(replication);

export default PouchDB;