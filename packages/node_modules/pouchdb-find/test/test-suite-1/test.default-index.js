'use strict';

var testUtils = require('../test-utils');
var should = testUtils.should;

module.exports = function (dbType, context) {

  describe(dbType + ': defaultindex', function () {

    it('uses all_docs with warning if no index found simple query 1', function () {
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
              series: 'mario'
            },
          fields: ["_id"],
        });
      }).then(function (resp) {
        resp.should.deep.equal({
          warning: 'no matching index found, create an index to optimize query time',
          docs: [
            {_id: 'dk'},
            {_id: 'luigi'},
            {_id: 'mario'},
            {_id: 'yoshi'}
          ]
        });
      });
    });


    it('uses all_docs with warning if no index found simple query 2', function () {
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
              debut: {
                $gt: 1992,
                $lte: 1996
              },
              rank: {
                $gte: 3,
                $lte: 8
              }
            },
          fields: ["_id"],
        });
      }).then(function (resp) {
        resp.should.deep.equal({
          warning: 'no matching index found, create an index to optimize query time',
          docs: [
            {_id: 'fox'},
            {_id: 'puff'}
          ]
        });
      });
    });

    it('works with complex query', function () {
      var db = context.db;
      return db.bulkDocs([
        { _id: '1', age: 75, name: {first: 'Nancy', surname: 'Sinatra'}},
        { _id: '2', age: 40, name: {first: 'Eddie', surname: 'Vedder'}},
        { _id: '3', age: 80, name: {first: 'John', surname: 'Fogerty'}},
        { _id: '4', age: 76, name: {first: 'Mick', surname: 'Jagger'}},
      ]).then(function () {
        return db.find({
          selector: {
            $and: [
              {age:{$gte: 40}},
              {$not:{age: {$eq: 75}}},
            ]
          },
          fields: ["_id"],
        });
      }).then(function (resp) {
        resp.should.deep.equal({
          warning: 'no matching index found, create an index to optimize query time',
          docs: [
            { _id: '2'},
            { _id: '3'},
            { _id: '4'}
          ]
        });
      });
    });

    it('throws an error if a sort is required', function () {
      var db = context.db;

      return db.bulkDocs([
        { _id: '1', foo: 'eyo'},
        { _id: '2', foo: 'ebb'},
        { _id: '3', foo: 'eba'},
        { _id: '4', foo: 'abo'}
      ]).then(function () {
        return db.find({
          selector: {foo: {$ne: "eba"}},
          fields: ["_id", "foo"],
          sort: [{"foo": "asc"}]
        });
      }).then(function () {
        throw new Error('should have thrown an error');
      }, function (err) {
        should.exist(err);
      });
    });

    it('sorts ok if _id used', function () {
      var db = context.db;

      return db.bulkDocs([
        { _id: '1', foo: 'eyo'},
        { _id: '2', foo: 'ebb'},
        { _id: '3', foo: 'eba'},
        { _id: '4', foo: 'abo'}
      ]).then(function () {
        return db.find({
          selector: {foo: {$ne: "eba"}},
          fields: ["_id",],
          sort: ["_id"]
        });
      }).then(function (resp) {
        resp.should.deep.equal({
          warning: 'no matching index found, create an index to optimize query time',
          docs: [
            { _id: '1'},
            { _id: '2'},
            { _id: '4'}
          ]
        });
      });
    });
  });

  it.skip('ne query will work and sort', function () {
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
        selector: {foo: {$ne: "eba"}},
        fields: ["_id" ],
        sort: [{foo: "asc"}]
      });
    }).then(function (resp) {
      resp.should.deep.equal({
        warning: 'no matching index found, create an index to optimize query time',
        docs: [
          {_id: '1'},
          {_id: '2'},
          {_id: '4'}
        ]
      });
    });
  });

  it.skip('$and empty selector returns all docs', function () {
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
        selector: {
          $and: [{}, {}]
        },
        fields: ['_id']
      }).then(function (resp) {
        resp.should.deep.equal({
          warning: 'no matching index found, create an index to optimize query time',
          docs: [
            {_id: '1'},
            {_id: '2'},
            {_id: '3'},
            {_id: '4'}
          ]
        });
      });
    });
  });

  it('$elemMatch works with no other index', function () {
    var db = context.db;

    return db.createIndex({
      index: {
        fields: ['foo']
      }
    }).then(function () {
      return db.bulkDocs([
        {_id: '1', foo: [1]},
        {_id: '2', foo: [2]},
        {_id: '3', foo: [3]},
        {_id: '4', foo: [4]}
      ]);
    }).then(function () {
      return db.find({
        selector: {
          foo: {$elemMatch: {$gte: 3}}
        },
        fields: ['_id']
      }).then(function (resp) {
        resp.should.deep.equal({
          warning: 'no matching index found, create an index to optimize query time',
          docs: [
            { _id: "3" },
            { _id: "4" }
          ]
        });
      });
    });
  });

  it.skip('error - no usable index', function () {
    var db = context.db;
    var index = {
      "index": {
        "fields": ["foo"]
      },
      "name": "foo-index",
      "type": "json"
    };
    return db.createIndex(index).then(function () {
      return db.find({
        "selector": {"foo": "$exists"},
        "fields": ["_id", "foo"],
        "sort": [{"bar": "asc"}]
      });
    }).then(function () {
      throw new Error('shouldnt be here');
    }, function (err) {
      should.exist(err);
    });
  });

  it.skip('handles just regex selector', function () {
    var db = context.db;
      return db.bulkDocs([
        {_id: '1', foo: 1},
        {_id: '2', foo: 2},
        {_id: '3', foo: 3},
        {_id: '4', foo: 4}
      ]).then(function () {
      return db.find({
        selector: {
          _id: {$regex: /1/}
        },
        fields: ['_id']
      }).then(function (resp) {
        resp.should.deep.equal({
          warning: 'no matching index found, create an index to optimize query time',
          docs: [
            { _id: "1" }
          ]
        });
      });
    });
  });
};
