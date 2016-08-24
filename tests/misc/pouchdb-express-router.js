'use strict';

var express = require('express');
var app = express();
var PouchDB = require('../../');

app.use(require('pouchdb-express-router')(PouchDB));

app.listen(3000);
