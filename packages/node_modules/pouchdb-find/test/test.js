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
    this.timeout(20000);
    db = new Pouch(dbName);
    return db;
  });
  afterEach(function () {
    this.timeout(20000);
    return Pouch.destroy(dbName);
  });
  describe(dbType + ' tests', function () {
    this.timeout(100000);

    it('should create an index', function () {
      var index = {
        "index": {
          "fields": ["foo"]
        },
        "name": "foo-index",
        "type": "json"
      };
      return db.createIndex(index).then(function (response) {
        response.should.deep.equal({"result": "created"});
        return db.createIndex(index);
      }).then(function (response) {
        response.should.deep.equal({result: 'exists'});
      });
    });

    it('should find existing indexes', function () {

      return db.getIndexes().then(function (response) {
        response.should.deep.equal({
          indexes: [{
            ddoc: null,
            name: '_all_docs',
            type: 'special',
            def: {fields: [{_id: 'asc'}]}
          }]
        });
        var index = {
          "index": {
            "fields": ["foo"]
          },
          "name": "foo-index",
          "type": "json"
        };
        return db.createIndex(index);
      }).then(function () {
        return db.getIndexes();
      }).then(function (resp) {
        var ddoc = resp.indexes[1].ddoc;
        ddoc.should.match(/_design\/.+/);
        delete resp.indexes[1].ddoc;
        resp.should.deep.equal({
          "indexes": [
            {
              "ddoc": null,
              "name": "_all_docs",
              "type": "special",
              "def": {
                "fields": [
                  {
                    "_id": "asc"
                  }
                ]
              }
            },
            {
              //"ddoc": "_design/a5f4711fc9448864a13c81dc71e660b524d7410c",
              "name": "foo-index",
              "type": "json",
              "def": {
                "fields": [
                  {
                    "foo": "asc"
                  }
                ]
              }
            }
          ]
        });
      });
    });

    it('should create ddocs automatically', function () {
      var index = {
        "index": {
          "fields": ["foo"]
        },
        "name": "foo-index",
        "type": "json"
      };
      var ddocId;
      return db.createIndex(index).then(function () {
        return db.getIndexes();
      }).then(function (resp) {
        ddocId = resp.indexes[1].ddoc;
        return db.get(ddocId);
      }).then(function (ddoc) {
        ddoc._id.should.equal(ddocId);
        should.exist(ddoc._rev);
        delete ddoc._id;
        delete ddoc._rev;
        delete ddoc.views['foo-index'].options.w; // wtf is this?
        ddoc.should.deep.equal({
          "language": "query",
          "views": {
            "foo-index": {
              "map": {
                "fields": {
                  "foo": "asc"
                }
              },
              "reduce": "_count",
              "options": {
                "def": {
                  "fields": [
                    "foo"
                  ]
                }
              }
            }
          }
        });
      });
    });

    it('sorts correctly', function () {
      var index = {
        "index": {
          "fields": ["foo"]
        },
        "name": "foo-index",
        "type": "json"
      };
      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          {
            _id: '1',
            foo: 'AAA'
          }, {
            _id: '2',
            foo: 'aAA'
          }, {
            _id: '3',
            foo: 'BAA'
          }, {
            _id: '4',
            foo: 'bAA'
          }, {
            _id: '5',
            foo: '\u0000aAA'
          }, {
            _id: '6',
            foo: '\u0001AAA'
          }
        ]);
      }).then(function () {
        return db.find({
          "selector": {"foo": {"$gt": "\u0000\u0000"}},
          "fields": ["_id", "foo"],
          "sort": [{"foo": "asc"}]
        });
      }).then(function (resp) {
        // ASCII vs ICU ordering. just gonna hack this
        if (dbType === 'http') {
          resp.should.deep.equal({
            "docs": [
              { "_id": "2", "foo": "aAA"},
              { "_id": "5", "foo": "\u0000aAA"},
              { "_id": "1", "foo": "AAA"},
              { "_id": "6", "foo": "\u0001AAA"},
              { "_id": "4", "foo": "bAA"},
              { "_id": "3", "foo": "BAA"}
            ]
          });
        } else {
          resp.should.deep.equal({
            docs: [
              { _id: '5', foo: '\u0000aAA' },
              { _id: '6', foo: '\u0001AAA' },
              { _id: '1', foo: 'AAA' },
              { _id: '3', foo: 'BAA' },
              { _id: '2', foo: 'aAA' },
              { _id: '4', foo: 'bAA' }
            ]
          });
        }
      });
    });

    it('error: conflicting sort and selector', function () {
      var index = {
        "index": {
          "fields": ["foo"]
        },
        "name": "foo-index",
        "type": "json"
      };
      return db.createIndex(index).then(function () {
        return db.find({
          "selector": {"foo": {"$gt": "\u0000\u0000"}},
          "fields": ["_id", "foo"],
          "sort": [{"_id": "asc"}]
        });
      }).then(function () {
        throw new Error('shouldnt be here');
      }, function (err) {
        should.exist(err);
      });
    });

    it('error - no selector', function () {
      var index = {
        "index": {
          "fields": ["foo"]
        },
        "name": "foo-index",
        "type": "json"
      };
      return db.createIndex(index).then(function () {
        return db.find({
          "fields": ["_id", "foo"],
          "sort": [{"foo": "asc"}]
        });
      }).then(function () {
        throw new Error('shouldnt be here');
      }, function (err) {
        should.exist(err);
      });
    });

    it('error - no usable index', function () {
      var index = {
        "index": {
          "fields": ["foo"]
        },
        "name": "foo-index",
        "type": "json"
      };
      return db.createIndex(index).then(function () {
        return db.find({
          "selector": {"foo": "$exists"},
          "fields": ["_id", "foo"],
          "sort": [{"bar": "asc"}]
        });
      }).then(function () {
        throw new Error('shouldnt be here');
      }, function (err) {
        should.exist(err);
      });
    });

  });
}
