import PouchDB from 'pouchdb-core';
import next from 'pouchdb-adapter-indexeddb';
import httpPouch from 'pouchdb-adapter-http';
import mapreduce from 'pouchdb-mapreduce';
import replication from 'pouchdb-replication';

export default PouchDB
  .plugin(next)
  .plugin(httpPouch)
  .plugin(replication)
  .plugin(mapreduce);
