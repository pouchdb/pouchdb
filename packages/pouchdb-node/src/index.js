import PouchDB from 'pouchdb-core';

import LevelPouch from 'pouchdb-adapter-leveldb';
import HttpPouch from 'pouchdb-adapter-http';
import mapreduce from 'pouchdb-mapreduce';
import { replicate, sync } from 'pouchdb-replication';

PouchDB.adapter('leveldb', LevelPouch, true);
PouchDB.adapter('http', HttpPouch);
PouchDB.adapter('https', HttpPouch);
PouchDB.plugin(mapreduce);
PouchDB.replicate = replicate;
PouchDB.sync = sync;

export default PouchDB;