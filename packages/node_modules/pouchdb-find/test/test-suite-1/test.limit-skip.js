'use strict';

var testUtils = require('../test-utils');
var sortById = testUtils.sortById;

module.exports = function (dbType, context) {

  describe(dbType + ': limit-skip', function () {

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

    it('should work with $and 1-1', function () {
      var db = context.db;
      return db.createIndex({
        "index": {
          "fields": ["series"]
        }
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
              {debut: {$gte: 1982}}
            ]
          },
          fields: ['_id'],
          limit: 1,
          skip: 1
        });
      }).then(function (res) {
        res.docs.sort(sortById);
        res.docs.should.deep.equal([{_id: 'yoshi'}]);
      });
    });

    it('should work with $and 1 1-2', function () {
      var db = context.db;
      return db.createIndex({
        "index": {
          "fields": ["series"]
        }
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
              {debut: {$gte: 1982}}
            ]
          },
          fields: ['_id'],
          limit: 1,
          skip: 2
        });
      }).then(function (res) {
        res.docs.sort(sortById);
        res.docs.should.deep.equal([]);
      });
    });

    it('should work with $and 1 2-0', function () {
      var db = context.db;
      return db.createIndex({
        "index": {
          "fields": ["series"]
        }
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
              {debut: {$gte: 1982}}
            ]
          },
          fields: ['_id'],
          limit: 2,
          skip: 0
        });
      }).then(function (res) {
        res.docs.sort(sortById);
        res.docs.should.deep.equal([{_id: 'luigi'}, {_id: 'yoshi'}]);
      });
    });

    it('should work with $and 2, same index 0-1', function () {
      var db = context.db;
      return db.createIndex({
        "index": {
          "fields": ["series", "debut"]
        }
      }).then(function() {
        return db.find({
          selector: {
            $and: [
              {series: 'Mario'},
              {debut: {$gte: 1982}}
            ]
          },
          fields: ['_id'],
          limit: 0,
          skip: 1
        });
      }).then(function (res) {
        res.docs.sort(sortById);
        res.docs.should.deep.equal([]);
      });
    });

    it('should work with $and 2, same index 4-2', function () {
      var db = context.db;
      return db.createIndex({
        "index": {
          "fields": ["series", "debut"]
        }
      }).then(function() {
        return db.find({
          selector: {
            $and: [
              {series: 'Mario'},
              {debut: {$gte: 1970}}
            ]
          },
          sort: ['series', 'debut'],
          fields: ['_id'],
          limit: 4,
          skip: 2
        });
      }).then(function (res) {
        res.docs.sort(sortById);
        res.docs.should.deep.equal([
          {_id: 'luigi'},
          {_id: 'yoshi'}
        ]);
      });
    });

    it('should work with $and 2, same index 2-2', function () {
      var db = context.db;
      return db.createIndex({
        "index": {
          "fields": ["series", "debut"]
        }
      }).then(function() {
        return db.find({
          selector: {
            $and: [
              {series: 'Mario'},
              {debut: {$gte: 1980}}
            ]
          },
          fields: ['_id'],
          limit: 2,
          skip: 2
        });
      }).then(function (res) {
        res.docs.sort(sortById);
        res.docs.should.deep.equal([{_id: 'luigi'}, {_id: 'yoshi'}]);
      });
    });

    it('should work with $and 3, index/no-index 10-0', function () {
      var db = context.db;
      return db.createIndex({
        "index": {
          "fields": ["series"]
        }
      }).then(function () {
        return db.createIndex({
          "index": {
            "fields": ["rank"]
          }
        });
      }).then(function() {
        return db.find({
          selector: {
            $and: [
              {series: 'Mario'},
              {debut: {$lte: 1990}}
            ]
          },
          fields: ['_id'],
          limit: 10,
          skip: 0
        });
      }).then(function (res) {
        res.docs.sort(sortById);
        res.docs.should.deep.equal([
          {_id: 'dk'},
          {_id: 'luigi'},
          {_id: 'mario'},
          {_id: 'yoshi'}
        ]);
      });
    });

    it('should work with $and 3, index/no-index 1-0', function () {
      var db = context.db;
      return db.createIndex({
        "index": {
          "fields": ["series"]
        }
      }).then(function () {
        return db.createIndex({
          "index": {
            "fields": ["rank"]
          }
        });
      }).then(function() {
        return db.find({
          selector: {
            $and: [
              {series: 'Star Fox'},
              {debut: {$gte: 1982}}
            ]
          },
          fields: ['_id'],
          limit: 1,
          skip: 0
        });
      }).then(function (res) {
        res.docs.sort(sortById);
        res.docs.should.deep.equal([{_id: 'fox'}]);
      });
    });

    it('should work with $and 3, index/no-index 2-0', function () {
      var db = context.db;
      return db.createIndex({
        "index": {
          "fields": ["series"]
        }
      }).then(function () {
        return db.createIndex({
          "index": {
            "fields": ["rank"]
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
          fields: ['_id'],
          limit: 2,
          skip: 0
        });
      }).then(function (res) {
        res.docs.sort(sortById);
        res.docs.should.deep.equal([{_id: 'luigi'}, {_id: 'yoshi'}]);
      });
    });

    it('should work with $and 4, wrong index', function () {
      var db = context.db;
      return db.createIndex({
        "index": {
          "fields": ["rank"]
        }
      }).then(function() {
        return db.find({
          selector: {
            $and: [
              {series: 'Mario'},
              {debut: {$gte: 1990}}
            ]
          },
          fields: ['_id'],
          limit: 1,
          skip: 1
        }).then(function (resp) {
          resp.should.deep.equal({
            warning: 'no matching index found, create an index to optimize query time',
            docs: []
          });
        });
      });
    });
  });
};
