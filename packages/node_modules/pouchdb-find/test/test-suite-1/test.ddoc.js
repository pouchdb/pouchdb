'use strict';

var testUtils = require('../test-utils');
var should = testUtils.should;

module.exports = function (dbType, context) {

  describe(dbType + ': ddoc', function () {

    it('should create an index', function () {
      var db = context.db;
      var index = {
        index: {
          fields: ["foo"]
        },
        name: "foo-index",
        type: "json",
        ddoc: 'foo'
      };
      return db.createIndex(index).then(function (response) {
        response.should.deep.equal({"result": "created"});
        return db.createIndex(index);
      }).then(function (response) {
        response.should.deep.equal({result: 'exists'});
        return db.getIndexes();
      }).then(function (resp) {
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
              "ddoc": "_design/foo",
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

    it('should create an index, existing ddoc', function () {
      var db = context.db;
      var index = {
        index: {
          fields: ["foo"]
        },
        name: "foo-index",
        type: "json",
        ddoc: 'foo'
      };
      return db.put({
        _id: '_design/foo',
        "language": "query"
      }).then(function () {
        return db.createIndex(index);
      }).then(function (response) {
        response.should.deep.equal({"result": "created"});
        return db.createIndex(index);
      }).then(function (response) {
        response.should.deep.equal({result: 'exists'});
        return db.getIndexes();
      }).then(function (resp) {
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
              "ddoc": "_design/foo",
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

    it('should create an index, reused ddoc', function () {
      var db = context.db;
      var index = {
        index: {
          fields: ["foo"]
        },
        name: "foo-index",
        type: "json",
        ddoc: 'myddoc'
      };
      var index2 = {
        index: {
          fields: ['bar']
        },
        name: "bar-index",
        ddoc: 'myddoc'
      };
      return db.createIndex(index).then(function (response) {
        response.should.deep.equal({"result": "created"});
        return db.createIndex(index);
      }).then(function (response) {
        response.should.deep.equal({result: 'exists'});
        return db.createIndex(index2);
      }).then(function (response) {
        response.should.deep.equal({"result": "created"});
        return db.createIndex(index2);
      }).then(function (response) {
        response.should.deep.equal({result: 'exists'});
      }).then(function () {
        return db.getIndexes();
      }).then(function (resp) {
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
              "ddoc": "_design/myddoc",
              "name": "bar-index",
              "type": "json",
              "def": {
                "fields": [
                  {
                    "bar": "asc"
                  }
                ]
              }
            },
            {
              "ddoc": "_design/myddoc",
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

    it('Error: invalid ddoc lang', function () {
      var db = context.db;
      var index = {
        index: {
          fields: ["foo"]
        },
        name: "foo-index",
        type: "json",
        ddoc: 'foo'
      };
      return db.put({
        _id: '_design/foo'
      }).then(function () {
        return db.createIndex(index);
      }).then(function () {
        throw new Error('shouldnt be here');
      }, function (err) {
        should.exist(err);
      });
    });
  });
};