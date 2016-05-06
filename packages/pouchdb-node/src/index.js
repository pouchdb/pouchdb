import PouchDB from 'pouchdb-core';

import LevelPouch from 'pouchdb-adapter-leveldb';
import HttpPouch from 'pouchdb-adapter-http';
import mapreduce from 'pouchdb-mapreduce';

PouchDB.adapter('leveldb', LevelPouch, true);
PouchDB.adapter('http', HttpPouch);
PouchDB.adapter('https', HttpPouch);
PouchDB.plugin(mapreduce);

export default PouchDB;