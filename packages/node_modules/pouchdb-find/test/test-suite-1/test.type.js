'use strict';

var testUtils = require('../test-utils');
var sortById = testUtils.sortById;

module.exports = function (dbType, context) {

  //
  // TODO: cloudant seems to have implemented these incorrectly
  //
  if (dbType === 'local') {
    describe(dbType + ': type', function () {

      it('does $type queries', function () {
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
            {_id: 'b', foo: 1},
            {_id: 'c', foo: null},
            {_id: 'd', foo: []},
            {_id: 'e', foo: {}},
            {_id: 'f', foo: false}
          ]);
        }).then(function () {
          return db.find({
            selector: {'foo': {$type: 'null'}},
            fields: ['_id']
          });
        }).then(function (res) {
          res.docs.sort(sortById);
          res.docs.should.deep.equal([{_id: 'c'}]);
          return db.find({
            selector: {'foo': {$type: 'boolean'}},
            fields: ['_id']
          });
        }).then(function (res) {
          res.docs.sort(sortById);
          res.docs.should.deep.equal([{_id: 'f'}]);
          return db.find({
            selector: {'foo': {$type: 'number'}},
            fields: ['_id']
          });
        }).then(function (res) {
          res.docs.sort(sortById);
          res.docs.should.deep.equal([{_id: 'b'}]);
          return db.find({
            selector: {'foo': {$type: 'string'}},
            fields: ['_id']
          });
        }).then(function (res) {
          res.docs.sort(sortById);
          res.docs.should.deep.equal([{_id: 'a'}]);
          return db.find({
            selector: {'foo': {$type: 'array'}},
            fields: ['_id']
          });
        }).then(function (res) {
          res.docs.sort(sortById);
          res.docs.should.deep.equal([{_id: 'd'}]);
          return db.find({
            selector: {'foo': {$type: 'object'}},
            fields: ['_id']
          });
        }).then(function (res) {
          res.docs.sort(sortById);
          res.docs.should.deep.equal([{_id: 'e'}]);
        });
      });
    });
  }
};