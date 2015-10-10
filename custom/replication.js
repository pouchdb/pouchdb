'use strict';

var PouchDB = require('./pouchdb');

PouchDB.replicate = require('../lib/replicate').replicate;
PouchDB.sync = require('../lib/sync');