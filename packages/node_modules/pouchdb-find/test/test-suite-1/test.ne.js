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

    it('does ne queries with gt', function () {
      var db = context.db;
      return db.bulkDocs([
        { name: 'mario', _id: 'mario', rank: 5, series: 'mario', debut: 1981 },
        { name: 'jigglypuff', _id: 'puff', rank: 8, series: 'pokemon', debut: 1996 },
        { name: 'link', rank: 10, _id: 'link', series: 'zelda', debut: 1986 },
        { name: 'donkey kong', rank: 7, _id: 'dk', series: 'mario', debut: 1981 },
        { name: 'pikachu', series: 'pokemon', _id: 'pikachu', rank: 1, debut: 1996 },
        { name: 'captain falcon', _id: 'falcon', rank: 4, series: 'f-zero', debut: 1990 },
        { name: 'luigi', rank: 11, _id: 'luigi', series: 'mario', debut: 1983 },
        { name: 'fox', _id: 'fox', rank: 3, series: 'star fox', debut: 1993 },
        { name: 'ness', rank: 9, _id: 'ness', series: 'earthbound', debut: 1994 },
        { name: 'samus', rank: 12, _id: 'samus', series: 'metroid', debut: 1986 },
        { name: 'yoshi', _id: 'yoshi', rank: 6, series: 'mario', debut: 1990 },
        { name: 'kirby', _id: 'kirby', series: 'kirby', rank: 2, debut: 1992 }
      ]).then(function () {
        return db.find({
          selector: {
            $and: [
              {_id: {$ne: "samus"}},
              {_id: {$ne: "yoshia"}},
              {_id: {$gt: "fox"}}
            ]
          },
          fields: ["_id"],
        });
      }).then(function (resp) {
        resp.should.deep.equal({
          docs: [
            {_id: 'kirby'},
            {_id: 'link'},
            {_id: 'luigi'},
            {_id: 'mario'},
            {_id: 'ness'},
            {_id: 'pikachu'},
            {_id: 'puff'},
            {_id: 'yoshi'}
          ]
        });
      });
    });

  });
};
