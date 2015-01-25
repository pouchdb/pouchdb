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

  describe(dbType + ' tests', function () {
    this.timeout(100000);

    var context = {};

    beforeEach(function () {
      context.db = new Pouch(dbName);
      return context.db;
    });
    afterEach(function () {
      return Pouch.destroy(dbName);
    });

    require('./tests/test.basic')(dbType, context);
    require('./tests/test.basic2')(dbType, context);
    require('./tests/test.sorting')(dbType, context);
    require('./tests/test.fields')(dbType, context);
    require('./tests/test.ltgt')(dbType, context);
    require('./tests/test.eq')(dbType, context);
    require('./tests/test.deep-fields')(dbType, context);
    require('./tests/test.exists')(dbType, context);
    require('./tests/test.type')(dbType, context);
    require('./tests/test.ne')(dbType, context);
    require('./tests/test.errors')(dbType, context);

  });
}
