import PouchDB from 'pouchdb-core';

import IDBPouch from 'pouchdb-adapter-indexeddb';
import WebSqlPouch from 'pouchdb-adapter-websql';
import HttpPouch from 'pouchdb-adapter-http';
import mapreduce from 'pouchdb-mapreduce';
import replication from 'pouchdb-replication';

PouchDB.plugin(IDBPouch);
PouchDB.plugin(WebSqlPouch);
PouchDB.plugin(HttpPouch);
PouchDB.plugin(mapreduce);
PouchDB.plugin(replication);

export default PouchDB;