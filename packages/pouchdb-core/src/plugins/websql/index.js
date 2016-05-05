// Allows using WebSQL in Node via node-websql

import websql from '../../adapters/websql/index';

var PouchDB = require('../../lib'); // relative to ./lib/extras/websql.js
PouchDB.adapter('websql', websql, true);