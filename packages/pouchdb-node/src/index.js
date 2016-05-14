import PouchDB from 'pouchdb-core';

import LevelPouch from 'pouchdb-adapter-leveldb';
import HttpPouch from 'pouchdb-adapter-http';
import mapreduce from 'pouchdb-mapreduce';
import replication from 'pouchdb-replication';

PouchDB.plugin(LevelPouch);
PouchDB.plugin(HttpPouch);
PouchDB.plugin(mapreduce);
PouchDB.plugin(replication);

export default PouchDB;