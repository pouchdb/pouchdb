'use strict';

var PouchDB = require('./pouchdb');

var websql = require('../lib/adapters/websql');
PouchDB.adapter('websql', websql, true);