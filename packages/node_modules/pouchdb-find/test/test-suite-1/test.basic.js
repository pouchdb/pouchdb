'use strict';

var testUtils = require('../test-utils');
var should = testUtils.should;

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
      return db.createIndex(index).then(function (response) {
        response.should.deep.equal({"result": "created"});
        return db.createIndex(index);
      }).then(function (response) {
        response.should.deep.equal({result: 'exists'});
      });
    });

    it('should not recognize duplicate indexes', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": ["foo"]
        },
        "name": "foo-index",
        "type": "json"
      };
      var index2 = {
        "index": {
          "fields": ["foo"]
        },
        "name": "bar-index",
        "type": "json"
      };

      return db.createIndex(index).then(function (response) {
        response.should.deep.equal({"result": "created"});
        return db.createIndex(index2);
      }).then(function (response) {
        response.should.deep.equal({result: 'created'});
        return db.getIndexes();
      }).then(function (res) {
        res.indexes.should.have.length(3);
        var ddoc1 = res.indexes[1].ddoc;
        var ddoc2 = res.indexes[2].ddoc;
        ddoc1.should.not.equal(ddoc2,
          'essentially duplicate indexes are not md5summed to the' +
          'same ddoc');
      });
    });

    it('should find existing indexes', function () {
      var db = context.db;
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
      var db = context.db;
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

    it('should create ddocs automatically 2', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": [{"foo": "asc"}]
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
                    {"foo": "asc"}
                  ]
                }
              }
            }
          }
        });
      });
    });

    it('should create ddocs automatically 3', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": [
            {"foo": "asc"},
            "bar"
          ]
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
                  "foo": "asc",
                  "bar": "asc"
                }
              },
              "reduce": "_count",
              "options": {
                "def": {
                  "fields": [
                    {"foo": "asc"},
                    "bar"
                  ]
                }
              }
            }
          }
        });
      });
    });

    it('deletes indexes', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": ["foo"]
        },
        "name": "foo-index",
        "type": "json"
      };

      return db.createIndex(index).then(function () {
        return db.getIndexes();
      }).then(function (resp) {
        return db.deleteIndex(resp.indexes[1]);
      }).then(function (resp) {
        resp.should.deep.equal({ok: true});
        return db.getIndexes();
      }).then(function (resp) {
        resp.should.deep.equal({"indexes":[
          {"ddoc":null,"name":"_all_docs","type":"special","def":{"fields":[{"_id":"asc"}]}}
        ]});
      });
    });

  });
};
