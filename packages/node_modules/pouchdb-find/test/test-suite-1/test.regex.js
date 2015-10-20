'use strict';

module.exports = function (dbType, context) {
  describe(dbType + ': $regex', function () {

    beforeEach(function () {
      return context.db.bulkDocs([
        { name: 'Mario', _id: 'mario', rank: 5, series: 'Mario', debut: 1981, awesome: true },
        { name: 'Jigglypuff', _id: 'puff', rank: 8, series: 'Pokemon', debut: 1996,
          awesome: false },
        { name: 'Link', rank: 10, _id: 'link', series: 'Zelda', debut: 1986, awesome: true },
        { name: 'Donkey Kong', rank: 7, _id: 'dk', series: 'Mario', debut: 1981, awesome: false },
        { name: 'Pikachu', series: 'Pokemon', _id: 'pikachu', rank: 1, debut: 1996, awesome: true },
        { name: 'Captain Falcon', _id: 'falcon', rank: 4, series: 'F-Zero', debut: 1990,
          awesome: true },
        { name: 'Luigi', rank: 11, _id: 'luigi', series: 'Mario', debut: 1983, awesome: false },
        { name: 'Fox', _id: 'fox', rank: 3, series: 'Star Fox', debut: 1993, awesome: true },
        { name: 'Ness', rank: 9, _id: 'ness', series: 'Earthbound', debut: 1994, awesome: true },
        { name: 'Samus', rank: 12, _id: 'samus', series: 'Metroid', debut: 1986, awesome: true },
        { name: 'Yoshi', _id: 'yoshi', rank: 6, series: 'Mario', debut: 1990, awesome: true },
        { name: 'Kirby', _id: 'kirby', series: 'Kirby', rank: 2, debut: 1992, awesome: true },
        { name: 'Master Hand', _id: 'master_hand', series: 'Smash Bros', rank: 0, debut: 1999,
          awesome: false }
      ]);
    });

    it('should do a basic regex search', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": ["name"]
        }
      };
      return db.createIndex(index).then(function () {
        return db.find({
          selector: {
            name: {$gte: null},
            series: {$regex: "^Mario"}
          },
          sort: ['name']
        }).then(function (resp) {
          var docs = resp.docs.map(function (doc) {
            delete doc._rev;
            return doc;
          });

          docs.should.deep.equal([
            { name: 'Donkey Kong', rank: 7, _id: 'dk', series: 'Mario',
              debut: 1981, awesome: false },
            { name: 'Luigi', rank: 11, _id: 'luigi', series: 'Mario', debut: 1983, awesome: false },
            { name: 'Mario', _id: 'mario', rank: 5, series: 'Mario', debut: 1981, awesome: true },
            { name: 'Yoshi', _id: 'yoshi', rank: 6, series: 'Mario', debut: 1990, awesome: true },
          ]);
        });
      });
    });

    it('returns 0 docs for no match', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": ["name"]
        }
      };
      return db.createIndex(index).then(function () {
        return db.find({
          selector: {
            name: {$gte: null},
            series: {$regex: "^Wrong"}
          },
          sort: ['name']
        }).then(function (resp) {
          var docs = resp.docs.map(function (doc) {
            delete doc._rev;
            return doc;
          });

          docs.should.deep.equal([]);
        });
      });
    });

    it('does not return docs for regex on non-string field', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": ["name"]
        }
      };
      return db.createIndex(index).then(function () {
        return db.find({
          selector: {
            name: {$gte: null},
            debut: {$regex: "^Mario"}
          },
          sort: ['name']
        }).then(function (resp) {
          var docs = resp.docs.map(function (doc) {
            delete doc._rev;
            return doc;
          });

          docs.should.deep.equal([]);
        });
      });
    });

  });
};
