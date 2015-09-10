/*jshint expr:true */
'use strict';

var Pouch = require('pouchdb');

var thePlugin = require('../');
Pouch.plugin(thePlugin);

require('./test-utils');

var  dbs = 'testdb' + Math.random() +
  ',http://127.0.0.1:5984/testdb' + Math.round(Math.random() * 100000);

dbs.split(',').forEach(function (db) {
  var dbType = /^http/.test(db) ? 'http' : 'local';
  tests(db, dbType);
});

function tests(dbName, dbType) {

  require('./test-suite-1')(dbName, dbType, Pouch);
  require('./test-suite-2')(dbName, dbType, Pouch);

}
