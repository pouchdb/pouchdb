'use strict';

var testUtils = require('../test-utils');
var sortById = testUtils.sortById;

module.exports = function (dbType, context) {

  describe(dbType + ': exists', function () {

    //
    // TODO: cloudant seems to have implemented these incorrectly
    //
    if (dbType === 'local') {
      it('does $exists queries - true', function () {
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
            {_id: 'a', foo: 'bar'},
            {_id: 'b', foo: {yo: 'dude'}},
            {_id: 'c', foo: null},
            {_id: 'd'}
          ]);
        }).then(function () {
          return db.find({
            selector: {'foo': {'$exists': true}},
            fields: ['_id']
          });
        }).then(function (res) {
          res.docs.sort(sortById);
          res.docs.should.deep.equal([
            {"_id": "a"},
            {"_id": "b"}
          ]);
        });
      });

      it('does $exists queries - false', function () {
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
            {_id: 'a', foo: 'bar'},
            {_id: 'b', foo: {yo: 'dude'}},
            {_id: 'c', foo: null},
            {_id: 'd'}
          ]);
        }).then(function () {
          return db.find({
            selector: {'foo': {'$exists': false}},
            fields: ['_id']
          });
        }).then(function (res) {
          res.docs.sort(sortById);
          res.docs.should.deep.equal([
            {"_id": "c"},
            {"_id": "d"},
          ]);
        });
      });

      it('does $exists queries - true/undef (multi-field)', function () {
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
            {_id: 'a', foo: 'bar', bar: 'baz'},
            {_id: 'b', foo: {yo: 'dude'}},
            {_id: 'c', foo: null, bar: 'quux'},
            {_id: 'd'}
          ]);
        }).then(function () {
          return db.find({
            selector: {'foo': {'$exists': true}},
            fields: ['_id']
          });
        }).then(function (res) {
          res.docs.sort(sortById);
          res.docs.should.deep.equal([
            {"_id": "a"},
            {"_id": "b"}
          ]);
        });
      });

      it('does $exists queries - $eq/true (multi-field)', function () {
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
            {_id: 'a', foo: 'bar', bar: 'baz'},
            {_id: 'b', foo: 'bar', bar: {yo: 'dude'}},
            {_id: 'c', foo: null, bar: 'quux'},
            {_id: 'd'}
          ]);
        }).then(function () {
          return db.find({
            selector: {'foo': 'bar', bar: {$exists: true}},
            fields: ['_id']
          });
        }).then(function (res) {
          res.docs.sort(sortById);
          res.docs.should.deep.equal([
            {"_id": "a"},
            {"_id": "b"}
          ]);
        });
      });

      // TODO: multi-field $exists is hard
      it.skip('does $exists queries - true/true (multi-field)', function () {
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
            {_id: 'a', foo: 'bar', bar: 'baz'},
            {_id: 'b', foo: {yo: 'dude'}},
            {_id: 'c', foo: null, bar: 'quux'},
            {_id: 'd'}
          ]);
        }).then(function () {
          return db.find({
            selector: {'foo': {'$exists': true}, 'bar': {$exists: true}},
            fields: ['_id']
          });
        }).then(function (res) {
          res.docs.sort(sortById);
          res.docs.should.deep.equal([
            {"_id": "a"}
          ]);
        });
      });

      // TODO: multi-field $exists is hard
      it.skip('does $exists queries - true/false (multi-field)', function () {
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
            {_id: 'a', foo: 'bar', bar: 'baz'},
            {_id: 'b', foo: {yo: 'dude'}},
            {_id: 'c', foo: null, bar: 'quux'},
            {_id: 'd'}
          ]);
        }).then(function () {
          return db.find({
            selector: {'foo': {'$exists': true}, 'bar': {$exists: false}},
            fields: ['_id']
          });
        }).then(function (res) {
          res.docs.sort(sortById);
          res.docs.should.deep.equal([
            {"_id": "b"}
          ]);
        });
      });
    }
  });
};
