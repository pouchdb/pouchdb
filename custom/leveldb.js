'use strict';

var PouchDB = require('./pouchdb');

var level = require('../lib/adapters/leveldb');
PouchDB.adapter('leveldb', level, true);