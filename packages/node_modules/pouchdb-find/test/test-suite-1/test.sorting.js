'use strict';

var testUtils = require('../test-utils');
var should = testUtils.should;

module.exports = function (dbType, context) {
  describe(dbType + ': sorting', function () {

    it('sorts correctly - just _id', function () {
      var db = context.db;
      return db.bulkDocs([
        {_id: 'a', foo: 'a'},
        {_id: 'b', foo: 'b'}
      ]).then(function () {
        return db.find({
          "selector": {"_id": {$gte: "a"}},
          "fields": ["_id", "foo"],
          "sort": [{"_id": "asc"}]
        });
      }).then(function (resp) {
        resp.should.deep.equal({
          "docs": [
            {"_id": "a", "foo": "a"},
            {"_id": "b", "foo": "b"}
          ]
        });
      });
    });

    it('sorts correctly - just _id desc', function () {
      var db = context.db;
      return db.bulkDocs([
        {_id: 'a', foo: 'a'},
        {_id: 'b', foo: 'b'}
      ]).then(function () {
        return db.find({
          "selector": {"_id": {$gte: "a"}},
          "fields": ["_id", "foo"],
          "sort": [{"_id": "desc"}]
        });
      }).then(function (resp) {
        resp.should.deep.equal({
          "docs": [
            {"_id": "b", "foo": "b"},
            {"_id": "a", "foo": "a"}
          ]
        });
      });
    });

    it('sorts correctly - foo desc', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": [{"foo": "desc"}]
        },
        "name": "foo-index",
        "type": "json"
      };
      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          {_id: 'a', foo: 'b'},
          {_id: 'b', foo: 'a'},
          {_id: 'c', foo: 'c'},
          {_id: '0', foo: 'd'}
        ]);
      }).then(function () {
        return db.find({
          "selector": {"foo": {$lte: "d"}},
          "fields": ["foo"]
        });
      }).then(function (resp) {
        resp.should.deep.equal({
          "docs": [
            {"foo": "a"},
            {"foo": "b"},
            {"foo": "c"},
            {"foo": "d"}
          ]
        });
      });
    });

    it('sorts correctly - foo desc 2', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": [{"foo": "desc"}]
        },
        "name": "foo-index",
        "type": "json"
      };
      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          {_id: 'a', foo: 'b'},
          {_id: 'b', foo: 'a'},
          {_id: 'c', foo: 'c'},
          {_id: '0', foo: 'd'}
        ]);
      }).then(function () {
        return db.find({
          "selector": {"foo": {$lte: "d"}},
          "fields": ["foo"],
          "sort": [{foo: "desc"}]
        });
      }).then(function (resp) {
        resp.should.deep.equal({
          "docs": [
            {"foo": "d"},
            {"foo": "c"},
            {"foo": "b"},
            {"foo": "a"}
          ]
        });
      });
    });

    it('sorts correctly - complex', function () {
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
          { _id: '1', foo: 'AAA'},
          { _id: '2', foo: 'aAA' },
          { _id: '3', foo: 'BAA'},
          { _id: '4', foo: 'bAA'},
          { _id: '5', foo: '\u0000aAA'},
          { _id: '6', foo: '\u0001AAA'}
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


    it('supported mixed sort', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": [
            "foo",
            "bar"
          ]
        },
        "name": "foo-index",
        "type": "json"
      };
      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          {_id: 'a1', foo: 'a', bar: '1'},
          {_id: 'a2', foo: 'a', bar: '2'},
          {_id: 'b1', foo: 'b', bar: '1'}
        ]);
      }).then(function () {
        return db.find({
          selector: {foo: {$gte: 'a'}}
        });
      }).then(function (res) {
        res.docs.forEach(function (doc) {
          should.exist(doc._rev);
          delete doc._rev;
        });
        res.should.deep.equal({
          "docs": [
            {
              "_id": "a1",
              "foo": "a",
              "bar": "1"
            },
            {
              "_id": "a2",
              "foo": "a",
              "bar": "2"
            },
            {
              "_id": "b1",
              "foo": "b",
              "bar": "1"
            }
          ]
        });
      });
    });

    it('supported mixed sort 2', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": [
            "foo",
            "bar"
          ]
        },
        "name": "foo-index",
        "type": "json"
      };
      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          {_id: 'a1', foo: 'a', bar: '1'},
          {_id: 'a2', foo: 'a', bar: '2'},
          {_id: 'b1', foo: 'b', bar: '1'}
        ]);
      }).then(function () {
        return db.find({
          selector: {foo: {$gte: 'b'}}
        });
      }).then(function (res) {
        res.docs.forEach(function (doc) {
          should.exist(doc._rev);
          delete doc._rev;
        });
        res.should.deep.equal({
          "docs": [
            {
              "_id": "b1",
              "foo": "b",
              "bar": "1"
            }
          ]
        });
      });
    });

    it('sort error, not an array', function () {
      var db = context.db;

      return db.createIndex({
        index: {
          fields: ['foo']
        }
      }).then(function () {
        return db.bulkDocs([
          {_id: '1', foo: 1},
          {_id: '2', foo: 2},
          {_id: '3', foo: 3},
          {_id: '4', foo: 4}
        ]);
      }).then(function () {
        return db.find({
          selector: {foo: {$eq: 1}},
          sort: {}
        }).then(function () {
          throw new Error('expected an error');
        }, function (err) {
          should.exist(err);
        });
      });
    });

  });
};
