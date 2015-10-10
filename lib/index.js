"use strict";

var PouchDB = require('../custom/pouchdb');

require('./adapters');
require('../custom/replication');
require('../custom/http');
require('../custom/mapreduce');

module.exports = PouchDB;