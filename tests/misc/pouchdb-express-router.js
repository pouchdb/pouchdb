'use strict';

var DB_FILES_DIR = './tmp';

var fs = require('node:fs');
var express = require('express');
var app = express();
var PouchDB = require('../../packages/pouchdb').defaults({
  prefix: DB_FILES_DIR
});


if (!fs.existsSync(DB_FILES_DIR)) {
  fs.mkdirSync(DB_FILES_DIR);
}
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", req.headers.origin);
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Max-Age", "1000000000");
  if ('OPTIONS' == req.method) {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(require('pouchdb-express-router')(PouchDB));

app.listen(process.env.PORT || 3000);
