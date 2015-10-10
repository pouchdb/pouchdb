'use strict';

var PouchDB = require('./pouchdb');

PouchDB.ajax = require('../lib/deps/ajax/prequest');

var httpAdapter = require('../lib/adapters/http');
PouchDB.adapter('http', httpAdapter);
PouchDB.adapter('https', httpAdapter);