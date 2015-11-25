'use strict';

var testUtils = require('../test-utils');
var sortById = testUtils.sortById;

module.exports = function (dbType, context) {

  describe(dbType + ': $type', function () {

    beforeEach(function () {
      var db = context.db;
      return db.bulkDocs([
        {_id: 'a', foo: 'bar'},
        {_id: 'b', foo: 1},
        {_id: 'c', foo: null},
        {_id: 'd', foo: []},
        {_id: 'e', foo: {}},
        {_id: 'f', foo: false}
      ]);
    });

    it('does null', function () {
      var db = context.db;
      return db.find({
        selector: {
          _id: {$gt: null},
          'foo': {$type: 'null'}
        },
        fields: ['_id']
      }).then(function (res) {
        res.docs.sort(sortById);
        res.docs.should.deep.equal([{_id: 'c'}]);
      });
    });

    it('does boolean', function () {
      var db = context.db;
      return db.find({
        selector: {
          _id: {$gt: null},
          'foo': {$type: 'boolean'}
        },
        fields: ['_id']
      }).then(function (res) {
        res.docs.sort(sortById);
        res.docs.should.deep.equal([{_id: 'f'}]);

      });
    });

    it('does number', function () {
      var db = context.db;
      return db.find({
        selector: {
          _id: {$gt: null},
          'foo': {$type: 'number'}
        },
        fields: ['_id']
      }).then(function (res) {
        res.docs.sort(sortById);
        res.docs.should.deep.equal([{_id: 'b'}]);
      });
    });

    it('does string', function () {
      var db = context.db;
      return db.find({
        selector: {
          _id: {$gt: null},
          'foo': {$type: 'string'}
        },
        fields: ['_id']
      }).then(function (res) {
        res.docs.sort(sortById);
        res.docs.should.deep.equal([{_id: 'a'}]);
      });
    });

    it('does array', function () {
      var db = context.db;
      return db.find({
        selector: {
          _id: {$gt: null},
          'foo': {$type: 'array'}
        },
        fields: ['_id']
      }).then(function (res) {
        res.docs.sort(sortById);
        res.docs.should.deep.equal([{_id: 'd'}]);
      });
    });

    it('does object', function () {
      var db = context.db;
      return db.find({
        selector: {
          _id: {$gt: null},
          'foo': {$type: 'object'}
        },
        fields: ['_id']
      }).then(function (res) {
        res.docs.sort(sortById);
        res.docs.should.deep.equal([{_id: 'e'}]);
      });
    });

    it('throws error for unmatched type', function () {
      var db = context.db;
      return db.find({
        selector: {
          _id: {$gt: null},
          'foo': {$type: 'made-up'}
        },
        fields: ['_id']
      }).catch(function (err) {
        err.message.should.match(/made-up not supported/);
      });
    });
  });
};
