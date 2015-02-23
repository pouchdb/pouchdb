'use strict';

var testUtils = require('../test-utils');
var sortById = testUtils.sortById;

module.exports = function (dbType, context) {

  describe(dbType + ': set-operations', function () {

    beforeEach(function () {
      return context.db.bulkDocs([
        { name: 'Mario', _id: 'mario', rank: 5, series: 'Mario', debut: 1981 },
        { name: 'Jigglypuff', _id: 'puff', rank: 8, series: 'Pokemon', debut: 1996 },
        { name: 'Link', rank: 10, _id: 'link', series: 'Zelda', debut: 1986 },
        { name: 'Donkey Kong', rank: 7, _id: 'dk', series: 'Mario', debut: 1981 },
        { name: 'Pikachu', series: 'Pokemon', _id: 'pikachu', rank: 1, debut: 1996 },
        { name: 'Captain Falcon', _id: 'falcon', rank: 4, series: 'F-Zero', debut: 1990 },
        { name: 'Luigi', rank: 11, _id: 'luigi', series: 'Mario', debut: 1983 },
        { name: 'Fox', _id: 'fox', rank: 3, series: 'Star Fox', debut: 1993 },
        { name: 'Ness', rank: 9, _id: 'ness', series: 'Earthbound', debut: 1994 },
        { name: 'Samus', rank: 12, _id: 'samus', series: 'Metroid', debut: 1986 },
        { name: 'Yoshi', _id: 'yoshi', rank: 6, series: 'Mario', debut: 1990 },
        { name: 'Kirby', _id: 'kirby', series: 'Kirby', rank: 2, debut: 1992 }
      ]);
    });

    it('should pick a better matching index 1', function () {
      var db = context.db;
      return db.createIndex({
        "index": {
          "fields": ["series"]
        }
      }).then(function () {
        return db.createIndex({
          "index": {
            "fields": ["series", "debut"]
          }
        });
      }).then(function () {
        return db.createIndex({
          "index": {
            "fields": ["debut"]
          }
        });
      }).then(function() {
        return db.find({
          selector: {
            $and: [
              {series: 'Mario'},
              {debut: {$gte: 1983}}
            ]
          },
          fields: ['_id']
        });
      }).then(function (res) {
        res.docs.sort(sortById);
        res.docs.should.deep.equal([{_id: 'luigi'}, {_id: 'yoshi'}]);
      });
    });

  });
};