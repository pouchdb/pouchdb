/*jshint expr:true */
'use strict';

var Pouch = require('pouchdb');

var thePlugin = require('../');
Pouch.plugin(thePlugin);

require('./test-utils');

var cloudantPassword = require('./.cloudant-password');

var  dbs = 'testdb' + Math.random() +
  ',http://' + cloudantPassword[0] + ':' + cloudantPassword[1] +
  '@' + cloudantPassword[2] + '/testdb' + Math.round(Math.random() * 100000);

dbs.split(',').forEach(function (db) {
  var dbType = /^http/.test(db) ? 'http' : 'local';
  tests(db, dbType);
});

function tests(dbName, dbType) {

  require('./test-suite-1')(dbName, dbType, Pouch);
  require('./test-suite-2')(dbName, dbType, Pouch);

}
