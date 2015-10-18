'use strict';

var testUtils = require('../test-utils');
var Promise = testUtils.Promise;

module.exports = function (dbType, context) {

  describe(dbType + ': basic', function () {

    it('should create an index', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": ["foo"]
        },
        "name": "foo-index",
        "type": "json"
      };
      return new Promise(function(resolve, reject) {
        return db.createIndex(index, function (err, res) {
          if (err) {
            return reject(err);
          }
          return resolve(res);
        });
      }).then(function (response) {
        response.id.should.match(/^_design\//);
        response.name.should.equal('foo-index');
        response.result.should.equal('created');
        return new Promise(function (resolve, reject) {
          db.createIndex(index, function (err, res) {
            if (err) {
              return reject(err);
            }
            return resolve(res);
          });
        });
      }).then(function (response) {
        response.id.should.match(/^_design\//);
        response.name.should.equal('foo-index');
        response.result.should.equal('exists');
      });
    });

    it('should find existing indexes', function () {
      var db = context.db;
      return new Promise(function (resolve, reject) {
        db.getIndexes(function (err, response) {
          if (err) {
            return reject(err);
          }
          resolve(response);
        });
      }).then(function (response) {
        response.should.deep.equal({
          "total_rows": 1,
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
          "total_rows": 2,
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
  });
};
