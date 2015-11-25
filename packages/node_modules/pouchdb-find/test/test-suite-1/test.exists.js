'use strict';

var testUtils = require('../test-utils');
var sortById = testUtils.sortById;

module.exports = function (dbType, context) {

  describe(dbType + ': exists', function () {

    it('does $exists queries - true', function () {
      var db = context.db;
      return db.bulkDocs([
        {_id: 'a', foo: 'bar'},
        {_id: 'b', foo: {yo: 'dude'}},
        {_id: 'c', foo: null},
        {_id: 'd'}
      ]).then(function () {
        return db.find({
          selector: {
            _id: { $gt: null},
            'foo': {'$exists': true}
          },
          fields: ['_id']
        });
      }).then(function (res) {
        res.docs.sort(sortById);
        res.docs.should.deep.equal([
          {"_id": "a"},
          {"_id": "b"},
          {"_id": "c"}
        ]);
      });
    });

    it('does $exists queries - false', function () {
      var db = context.db;
      return db.bulkDocs([
        {_id: 'a', foo: 'bar'},
        {_id: 'b', foo: {yo: 'dude'}},
        {_id: 'c', foo: null},
        {_id: 'd'}
      ]).then(function () {
        return db.find({
          selector: {
            _id: { $gt: null},
            'foo': {'$exists': false}
          },
          fields: ['_id']
        });
      }).then(function (res) {
        res.docs.sort(sortById);
        res.docs.should.deep.equal([
          {"_id": "d"}
        ]);
      });
    });

    it('does $exists queries - true/undef (multi-field)', function () {
      var db = context.db;
      return db.bulkDocs([
        {_id: 'a', foo: 'bar', bar: 'baz'},
        {_id: 'b', foo: {yo: 'dude'}},
        {_id: 'c', foo: null, bar: 'quux'},
        {_id: 'd'}
      ]).then(function () {
        return db.find({
          selector: {
            _id: { $gt: null},
            'foo': {'$exists': true}
          },
          fields: ['_id']
        });
      }).then(function (res) {
        res.docs.sort(sortById);
        res.docs.should.deep.equal([
          {"_id": "a"},
          {"_id": "b"},
          {"_id": "c"}
        ]);
      });
    });

    it('does $exists queries - $eq/true (multi-field)', function () {
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

    it('does $exists queries - $eq/false (multi-field)', function () {
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
          {_id: 'a', foo: 'bar', bar: 'baz'},
          {_id: 'b', foo: 'bar', bar: {yo: 'dude'}},
          {_id: 'c', foo: 'bar', bar: 'yo'},
          {_id: 'd', foo: 'bar'}
        ]);
      }).then(function () {
        return db.find({
          selector: {'foo': 'bar', bar: {$exists: false}},
          fields: ['_id']
        });
      }).then(function (res) {
        res.docs.sort(sortById);
        res.docs.should.deep.equal([
          {"_id": "d"}
        ]);
      });
    });

    it('does $exists queries - true/true (multi-field)', function () {
      var db = context.db;
      return db.bulkDocs([
        {_id: 'a', foo: 'bar', bar: 'baz'},
        {_id: 'b', foo: {yo: 'dude'}},
        {_id: 'c', foo: null, bar: 'quux'},
        {_id: 'd'}
      ]).then(function () {
        return db.find({
          selector: {
            _id: {$gt: null},
            foo: {'$exists': true},
            bar: {$exists: true}
          },
          fields: ['_id']
        });
      }).then(function (res) {
        res.docs.sort(sortById);
        res.docs.should.deep.equal([
          {"_id": "a"},
          {"_id": "c"}
        ]);
      });
    });

    it('does $exists queries - true/false (multi-field)', function () {
      var db = context.db;
      return db.bulkDocs([
        {_id: 'a', foo: 'bar', bar: 'baz'},
        {_id: 'b', foo: {yo: 'dude'}},
        {_id: 'c', foo: null, bar: 'quux'},
        {_id: 'd'}
      ]).then(function () {
        return db.find({
          selector: {
            _id: {$gt: null},
            foo: {'$exists': true},
            bar: {$exists: false}
          },
          fields: ['_id']
        });
      }).then(function (res) {
        res.docs.sort(sortById);
        res.docs.should.deep.equal([
          {"_id": "b"}
        ]);
      });
    });
  });
};
