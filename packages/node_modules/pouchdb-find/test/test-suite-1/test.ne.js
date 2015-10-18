'use strict';

module.exports = function (dbType, context) {

  describe(dbType + ': ne', function () {

    it('#7 does ne queries 1', function () {
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
          selector: {foo: {$gt: "a"}, bar: {$ne: 'zxy'}},
          fields: ["_id"],
          sort: [{foo: "asc"}]
        });
      }).then(function (resp) {
        resp.should.deep.equal({
          docs: [
            { _id: '4'},
            { _id: '3'}
          ]
        });
      });
    });

    it('#7 does ne queries 2', function () {
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
          selector: {foo: {$gt: "a"}, bar: {$ne: 'zxy'}},
          fields: ["_id"],
          sort: [{foo: "asc"}]
        });
      }).then(function (resp) {
        resp.should.deep.equal({
          docs: [
            {_id: '4'},
            {_id: '3'}
          ]
        });
      });
    });

    it('$ne/$eq inconsistency', function () {
      var db = context.db;

      function normalize(res) {
        return res.docs.map(function getId(x) {
          return x._id;
        }).sort();
      }

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
          selector: {$and: [{foo: {$eq: 1}}, {foo: {$ne: 1}}]}
        });
      }).then(function (res) {
        normalize(res).should.deep.equal([]);
      });
    });

    it('$ne/$eq consistency', function () {
      var db = context.db;

      function normalize(res) {
        return res.docs.map(function getId(x) {
          return x._id;
        }).sort();
      }

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
          selector: {$and: [{foo: {$eq: 1}}, {foo: {$ne: 3}}]}
        });
      }).then(function (res) {
        normalize(res).should.deep.equal(['1']);
      });
    });

  });
};