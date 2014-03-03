"use strict";

require('es5-shim');

var PouchDB = module.exports = require("./index");

PouchDB.adapter('websql', require('./adapters/websql'));