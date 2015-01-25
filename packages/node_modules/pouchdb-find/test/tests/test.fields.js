'use strict';

var testUtils = require('../test-utils');
var sortById = testUtils.sortById;

module.exports = function (dbType, context) {

  describe(dbType + ': fields', function () {

    it('does 2-field queries', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": ["foo", "bar"]
        },
        "name": "foo-index",
        "type": "json"
      };
      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          { _id: '1', foo: 'a', bar: 'a'},
          { _id: '2', foo: 'b', bar: 'b'},
          { _id: '3', foo: 'a', bar: 'a'},
          { _id: '4', foo: 'c', bar: 'a'},
          { _id: '5', foo: 'b', bar: 'a'},
          { _id: '6', foo: 'a', bar: 'b'}
        ]);
      }).then(function () {
        return db.find({
          "selector": {
            "foo": {"$eq": "b"},
            "bar": {"$eq": "b"}
          },
          "fields": ["_id", "foo"]
        });
      }).then(function (resp) {
        resp.should.deep.equal({
          "docs": [
            { "_id": "2", "foo": "b"}
          ]
        });
      });
    });

    it('does 2-field queries eq/gte', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": ["foo", "bar"]
        },
        "name": "foo-index",
        "type": "json"
      };
      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          { _id: '1', foo: 'a', bar: 'a'},
          { _id: '2', foo: 'a', bar: 'b'},
          { _id: '3', foo: 'a', bar: 'c'},
          { _id: '4', foo: 'b', bar: 'a'},
          { _id: '5', foo: 'b', bar: 'b'},
          { _id: '6', foo: 'c', bar: 'a'}
        ]);
      }).then(function () {
        return db.find({
          "selector": {
            "foo": {"$eq": "a"},
            "bar": {"$gte": "b"}
          },
          "fields": ["_id"]
        });
      }).then(function (resp) {
        resp.docs.sort(sortById);
        resp.docs.should.deep.equal([
          { _id: '2' },
          { _id: '3' }
        ]);
      });
    });

    it('does 2-field queries gte/gte', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": ["foo", "bar"]
        },
        "name": "foo-index",
        "type": "json"
      };
      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          { _id: '1', foo: 'a', bar: 'a'},
          { _id: '2', foo: 'a', bar: 'b'},
          { _id: '3', foo: 'a', bar: 'c'},
          { _id: '4', foo: 'b', bar: 'a'},
          { _id: '5', foo: 'b', bar: 'b'},
          { _id: '6', foo: 'c', bar: 'a'}
        ]);
      }).then(function () {
        return db.find({
          "selector": {
            "foo": {"$gte": "b"},
            "bar": {"$gte": "a"}
          },
          "fields": ["_id"]
        });
      }).then(function (resp) {
        resp.docs.sort(sortById);
        resp.docs.should.deep.equal([
          { _id: '4' },
          { _id: '5' },
          { _id: '6' }
        ]);
      });
    });

    it('does 2-field queries gte/lte', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": ["foo", "bar"]
        },
        "name": "foo-index",
        "type": "json"
      };
      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          { _id: '1', foo: 'a', bar: 'a'},
          { _id: '2', foo: 'a', bar: 'b'},
          { _id: '3', foo: 'a', bar: 'c'},
          { _id: '4', foo: 'b', bar: 'a'},
          { _id: '5', foo: 'b', bar: 'b'},
          { _id: '6', foo: 'c', bar: 'a'}
        ]);
      }).then(function () {
        return db.find({
          "selector": {
            "foo": {"$gte": "b"},
            "bar": {"$lte": "b"}
          },
          "fields": ["_id"]
        });
      }).then(function (resp) {
        resp.docs.sort(sortById);
        resp.docs.should.deep.equal([
          { _id: '4' },
          { _id: '5' },
          { _id: '6' }
        ]);
      });
    });

    it('does 3-field queries eq/eq/eq 3-field index', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": ["foo", "bar", "baz"]
        },
        "name": "foo-index",
        "type": "json"
      };
      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          { _id: '1', foo: 'a', bar: 'a', baz: 'z'},
          { _id: '2', foo: 'a', bar: 'b', baz: 'z'},
          { _id: '3', foo: 'a', bar: 'c', baz: 'z'},
          { _id: '4', foo: 'b', bar: 'a', baz: 'z'},
          { _id: '5', foo: 'b', bar: 'b', baz: 'z'},
          { _id: '6', foo: 'c', bar: 'a', baz: 'z'}
        ]);
      }).then(function () {
        return db.find({
          "selector": {
            foo: 'b',
            bar: 'b',
            baz: 'z'
          },
          "fields": ["_id"]
        });
      }).then(function (resp) {
        resp.docs.sort(sortById);
        resp.docs.should.deep.equal([
          { _id: '5' }
        ]);
      });
    });

    it('does 1-field queries eq/eq 2-field index', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": ["foo", "bar"]
        },
        "name": "foo-index",
        "type": "json"
      };
      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          { _id: '1', foo: 'a', bar: 'a', baz: 'z'},
          { _id: '2', foo: 'a', bar: 'b', baz: 'z'},
          { _id: '3', foo: 'a', bar: 'c', baz: 'z'},
          { _id: '4', foo: 'b', bar: 'a', baz: 'z'},
          { _id: '5', foo: 'b', bar: 'b', baz: 'z'},
          { _id: '6', foo: 'c', bar: 'a', baz: 'z'}
        ]);
      }).then(function () {
        return db.find({
          "selector": {
            foo: 'b'
          },
          "fields": ["_id"]
        });
      }).then(function (resp) {
        resp.docs.sort(sortById);
        resp.docs.should.deep.equal([
          { _id: '4' },
          { _id: '5' }
        ]);
      });
    });

    it('does 2-field queries eq/eq 3-field index', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": ["foo", "bar", "baz"]
        },
        "name": "foo-index",
        "type": "json"
      };
      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          { _id: '1', foo: 'a', bar: 'a', baz: 'z'},
          { _id: '2', foo: 'a', bar: 'b', baz: 'z'},
          { _id: '3', foo: 'a', bar: 'c', baz: 'z'},
          { _id: '4', foo: 'b', bar: 'a', baz: 'z'},
          { _id: '5', foo: 'b', bar: 'b', baz: 'z'},
          { _id: '6', foo: 'c', bar: 'a', baz: 'z'}
        ]);
      }).then(function () {
        return db.find({
          "selector": {
            foo: 'b',
            bar: 'b'
          },
          "fields": ["_id"]
        });
      }).then(function (resp) {
        resp.docs.sort(sortById);
        resp.docs.should.deep.equal([
          { _id: '5' }
        ]);
      });
    });
  });
};