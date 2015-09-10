'use strict';

var testUtils = require('../test-utils');
var should = testUtils.should;

module.exports = function (dbType, context) {

  describe(dbType + ': eq', function () {
    it('does eq queries', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": ["foo"]
        },
        "name": "foo-index",
        "type": "json"
      };

      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          { _id: '1', foo: 'eyo'},
          { _id: '2', foo: 'ebb'},
          { _id: '3', foo: 'eba'},
          { _id: '4', foo: 'abo'}
        ]);
      }).then(function () {
        return db.find({
          selector: {foo: "eba"},
          fields: ["_id", "foo"],
          sort: [{foo: "asc"}]
        });
      }).then(function (resp) {
        resp.should.deep.equal({
          docs: [
            {_id: '3', foo: 'eba'}
          ]
        });
      });
    });

    it('does explicit $eq queries', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": ["foo"]
        },
        "name": "foo-index",
        "type": "json"
      };

      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          { _id: '1', foo: 'eyo'},
          { _id: '2', foo: 'ebb'},
          { _id: '3', foo: 'eba'},
          { _id: '4', foo: 'abo'}
        ]);
      }).then(function () {
        return db.find({
          selector: {foo: {$eq: "eba"}},
          fields: ["_id", "foo"],
          sort: [{foo: "asc"}]
        });
      }).then(function (resp) {
        resp.should.deep.equal({
          docs: [
            { _id: '3', foo: 'eba'}
          ]
        });
      });
    });

    it('does eq queries, no fields', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": ["foo"]
        },
        "name": "foo-index",
        "type": "json"
      };

      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          { _id: '1', foo: 'eyo'},
          { _id: '2', foo: 'ebb'},
          { _id: '3', foo: 'eba'},
          { _id: '4', foo: 'abo'}
        ]);
      }).then(function () {
        return db.find({
          selector: {foo: "eba"},
          sort: [{foo: "asc"}]
        });
      }).then(function (resp) {
        should.exist(resp.docs[0]._rev);
        delete resp.docs[0]._rev;
        resp.should.deep.equal({
          docs: [
            {_id: '3', foo: 'eba'}
          ]
        });
      });
    });

    it('does eq queries, no fields or sort', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": ["foo"]
        },
        "name": "foo-index",
        "type": "json"
      };

      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          { _id: '1', foo: 'eyo'},
          { _id: '2', foo: 'ebb'},
          { _id: '3', foo: 'eba'},
          { _id: '4', foo: 'abo'}
        ]);
      }).then(function () {
        return db.find({
          selector: {foo: "eba"}
        });
      }).then(function (resp) {
        should.exist(resp.docs[0]._rev);
        delete resp.docs[0]._rev;
        resp.should.deep.equal({
          docs: [
            {_id: '3', foo: 'eba'}
          ]
        });
      });
    });

    it('does eq queries, no index name', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": ["foo"]
        }
      };

      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          { _id: '1', foo: 'eyo'},
          { _id: '2', foo: 'ebb'},
          { _id: '3', foo: 'eba'},
          { _id: '4', foo: 'abo'}
        ]);
      }).then(function () {
        return db.getIndexes();
      }).then(function (resp) {
        // this is some kind of auto-generated hash
        resp.indexes[1].ddoc.should.match(/_design\/.*/);
        var ddocName = resp.indexes[1].ddoc.split('/')[1];
        resp.indexes[1].name.should.equal(ddocName);
        delete resp.indexes[1].ddoc;
        delete resp.indexes[1].name;
        resp.should.deep.equal({
          "total_rows":2,
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
        return db.get('_design/' + ddocName);
      }).then(function (ddoc) {
        var ddocId = ddoc._id.split('/')[1];

        Object.keys(ddoc.views).should.deep.equal([ddocId]);
        delete ddoc._id;
        delete ddoc._rev;
        ddoc.views.theView = ddoc.views[ddocId];
        delete ddoc.views[ddocId];
        delete ddoc.views.theView.options.w;

        ddoc.should.deep.equal({
          "language": "query",
          "views": {
            theView: {
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

        return db.find({
          selector: {foo: "eba"}
        });
      }).then(function (resp) {
        should.exist(resp.docs[0]._rev);
        delete resp.docs[0]._rev;
        resp.should.deep.equal({
          docs: [
            {_id: '3', foo: 'eba'}
          ]
        });
      });
    });

    it('#7 does eq queries 1', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": ["foo"]
        }
      };

      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          { _id: '1', foo: 'eyo', bar: 'zxy'},
          { _id: '2', foo: 'ebb', bar: 'zxy'},
          { _id: '3', foo: 'eba', bar: 'zxz'},
          { _id: '4', foo: 'abo', bar: 'zxz'}
        ]);
      }).then(function () {
        return db.find({
          selector: {foo: {$gt: "a"}, bar: {$eq: 'zxy'}},
          fields: ["_id"],
          sort: [{foo: "asc"}]
        });
      }).then(function (resp) {
        resp.should.deep.equal({
          docs: [
            { _id: '2'},
            { _id: '1'}
          ]
        });
      });
    });

    it('#7 does eq queries 2', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": ["foo", "bar"]
        }
      };

      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          {_id: '1', foo: 'eyo', bar: 'zxy'},
          {_id: '2', foo: 'ebb', bar: 'zxy'},
          {_id: '3', foo: 'eba', bar: 'zxz'},
          {_id: '4', foo: 'abo', bar: 'zxz'}
        ]);
      }).then(function () {
        return db.find({
          selector: {foo: {$gt: "a"}, bar: {$eq: 'zxy'}},
          fields: ["_id"],
          sort: [{foo: "asc"}]
        });
      }).then(function (resp) {
        resp.should.deep.equal({
          docs: [
            {_id: '2'},
            {_id: '1'}
          ]
        });
      });
    });
  });
};
