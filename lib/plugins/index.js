"use strict";

var adapterConfig = require('adapter-config');
var adapterName = adapterConfig.name;
var adapter = require('./levelalt');
var PouchDB = global.PouchDB || require('pouchdb');
PouchDB.adapter(adapterName, adapter);
PouchDB.preferredAdapters.push(adapterName);
