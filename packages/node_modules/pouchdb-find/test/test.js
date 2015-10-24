/*jshint expr:true */
'use strict';

var queryString = require('query-string');
var Pouch = require('pouchdb');
var thePlugin = require('../');
Pouch.plugin(thePlugin);

require('./test-utils');

var couch;
if (typeof process === 'undefined' || process.browser) {
  couch = queryString.parse(location.search).couchHost ||
    'http://127.0.0.1:5984';
} else {
  couch = process.env.COUCH_HOST || 'http://127.0.0.1:5984';
}

var  dbs = 'testdb_find,' + couch + '/testdb_find';

dbs.split(',').forEach(function (db) {
  var dbType = /^http/.test(db) ? 'http' : 'local';
  tests(db, dbType);
});

function tests(dbName, dbType) {

  require('./test-suite-1')(dbName, dbType, Pouch);
  require('./test-suite-2')(dbName, dbType, Pouch);

  if (dbType === 'local') {
    require('./test-abstract-mapreduce')(dbName, dbType, Pouch);
  }

}
