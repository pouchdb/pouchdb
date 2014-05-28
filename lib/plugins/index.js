"use strict";

var adapterConfig = require('adapter-config');
var adapterName = adapterConfig.name;
var adapter = require('./levelalt');

window.PouchDB.adapter(adapterName, adapter);
window.PouchDB.preferredAdapters.push(adapterName);
