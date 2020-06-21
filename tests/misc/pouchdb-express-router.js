'use strict';

var express = require('express');
var app = express();
var PouchDB = require('../../packages/node_modules/pouchdb');

app.use(require('pouchdb-express-router')(PouchDB));

app.listen(process.env.PORT || 3000);
