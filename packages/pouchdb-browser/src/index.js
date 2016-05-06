import PouchDB from 'pouchdb-core';

import IDBPouch from 'pouchdb-adapter-indexeddb';
import WebSqlPouch from 'pouchdb-adapter-websql';
import HttpPouch from 'pouchdb-adapter-http';
import mapreduce from 'pouchdb-mapreduce';

PouchDB.adapter('idb', IDBPouch, true);
PouchDB.adapter('websql', WebSqlPouch, true);
PouchDB.adapter('http', HttpPouch);
PouchDB.adapter('https', HttpPouch);
PouchDB.plugin(mapreduce);

export default PouchDB;