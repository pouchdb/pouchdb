'use strict';

var PouchDB = require('./pouchdb');

var idb = require('../lib/adapters/idb');
PouchDB.adapter('idb', idb, true);