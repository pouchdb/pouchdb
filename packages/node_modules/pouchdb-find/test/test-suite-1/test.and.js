'use strict';

module.exports = function (dbType, context) {

  describe(dbType + ': $and', function () {

    it('does and for _id', function () {
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
            selector: {$and: [
              {_id: {$in: ['pikachu', 'puff']}},
              {_id: {$gt: null}}
            ]},
          fields: ["_id"],
        });
      }).then(function (resp) {
        resp.should.deep.equal({
          docs: [
            {_id: 'pikachu'},
            {_id: 'puff'},
          ]
        });
      });
    });

    it('does and for index', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": ["debut"]
        }
      };
      return db.createIndex(index).then(function () {
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
      ]);}).then(function () {
        return db.find({
            selector: {$and: [
              {debut: {$in: [1996]}},
              {debut: {$gt: null}}
            ]},
          fields: ["_id"],
        });
      }).then(function (resp) {
        resp.should.deep.equal({
          docs: [
            {_id: 'pikachu'},
            {_id: 'puff'},
          ]
        });
      });
    });

  });
};
