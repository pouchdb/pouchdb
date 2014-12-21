/*jshint expr:true */
'use strict';

var Pouch = require('pouchdb');

var helloPlugin = require('../');
Pouch.plugin(helloPlugin);

var chai = require('chai');
chai.use(require("chai-as-promised"));

var should = chai.should();
require('bluebird'); // var Promise = require('bluebird');

var cloudantPassword = require('./.cloudant-password');

var dbs;
if (process.browser) {
  dbs = 'testdb' + Math.random() +
    ',http://pouch:' + cloudantPassword +
    '@pouch.cloudant.com/testdb' + Math.round(Math.random() * 100000);
} else {
  dbs = process.env.TEST_DB;
}

dbs.split(',').forEach(function (db) {
  var dbType = /^http/.test(db) ? 'http' : 'local';
  tests(db, dbType);
});

function tests(dbName, dbType) {

  var db;

  beforeEach(function () {
    db = new Pouch(dbName);
    return db;
  });
  afterEach(function () {
    return Pouch.destroy(dbName);
  });
  describe(dbType + ' tests', function () {

    it('should create an index', function () {
      var index = {
        "index": {
          "fields": ["foo"]
        },
        "name" : "foo-index",
        "type" : "json"
      };
      return db.createIndex(index).then(function (response) {
        should.exist(response);
        response.should.deep.equal({"result":"created"});
        return db.createIndex(index);
      }).then(function (response) {
        response.should.deep.equal({ result: 'exists' });
      });
    });

  });
}
