'use strict';

var testUtils = require('../test-utils');
var sortById = testUtils.sortById;

module.exports = function (dbType, context) {

  describe(dbType + ': basic3', function () {

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

    it('should be able to search for numbers', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": ["rank"]
        }
      };
      return db.createIndex(index).then(function () {
        return db.find({
          selector: {rank: 12},
          fields: ['_id']
        }).then(function (response) {
          response.docs.should.deep.equal([
            {"_id": "samus"}
          ]);
        });
      });
    });

    it('should use $exists for an in-memory filter', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": ["rank"]
        }
      };
      return db.createIndex(index).then(function () {
        return db.find({
          selector: {rank: 12, name: {$exists: true}},
          fields: ['_id']
        }).then(function (response) {
          response.docs.should.deep.equal([
            {"_id": "samus"}
          ]);
        });
      });
    });

    it('should be able to search for 0', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": ["rank"]
        }
      };
      return db.createIndex(index).then(function () {
        return db.find({
          selector: {rank: 0},
          fields: ['_id']
        }).then(function (response) {
          response.docs.should.deep.equal([
            {"_id": "master_hand"}
          ]);
        });
      });
    });

    it('should be able to search for boolean true', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": ["awesome"]
        }
      };
      return db.createIndex(index).then(function () {
        return db.find({
          selector: {awesome: true},
          fields: ['_id']
        }).then(function (response) {
          response.docs.sort(sortById);
          response.docs.should.deep.equal([{"_id":"falcon"},{"_id":"fox"},{"_id":"kirby"},
            {"_id":"link"},{"_id":"mario"},{"_id":"ness"},{"_id":"pikachu"},
            {"_id":"samus"},{"_id":"yoshi"}]);
        });
      });
    });

    it('should be able to search for boolean true', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": ["awesome"]
        }
      };
      return db.createIndex(index).then(function () {
        return db.find({
          selector: {awesome: false},
          fields: ['_id']
        }).then(function (response) {
          response.docs.sort(sortById);
          response.docs.should.deep.equal([{"_id":"dk"},{"_id":"luigi"},
            {"_id":"master_hand"},{"_id":"puff"}]);
        });
      });
    });

    it('#73 should be able to create a custom index name', function () {
      var db = context.db;
      var index = {
        index: {
          fields: ["awesome"],
          name: 'myindex',
          ddoc: 'mydesigndoc'
        }
      };
      return db.createIndex(index).then(function () {
        return db.getIndexes();
      }).then(function (res) {
        var indexes = res.indexes.map(function (index) {
          return {
            name: index.name,
            ddoc: index.ddoc,
            type: index.type
          };
        });
        indexes.should.deep.equal([
          {
            name: '_all_docs',
            type: 'special',
            ddoc: null
          },
          {
            name: 'myindex',
            ddoc: '_design/mydesigndoc',
            type: 'json'
          }
        ]);
        return db.get('_design/mydesigndoc');
      });
    });

    it('#73 should be able to create a custom index, alt style', function () {
      var db = context.db;
      var index = {
        index: {
          fields: ["awesome"],
        },
        name: 'myindex',
        ddoc: 'mydesigndoc'
      };
      return db.createIndex(index).then(function () {
        return db.getIndexes();
      }).then(function (res) {
        var indexes = res.indexes.map(function (index) {
          return {
            name: index.name,
            ddoc: index.ddoc,
            type: index.type
          };
        });
        indexes.should.deep.equal([
          {
            name: '_all_docs',
            type: 'special',
            ddoc: null
          },
          {
            name: 'myindex',
            ddoc: '_design/mydesigndoc',
            type: 'json'
          }
        ]);
        return db.get('_design/mydesigndoc');
      });
    });

    it('#73 should be able to create a custom index, alt style 2', function () {
      var db = context.db;
      var index = {
        name: 'myindex',
        ddoc: 'mydesigndoc',
        fields: ["awesome"]
      };
      return db.createIndex(index).then(function () {
        return db.getIndexes();
      }).then(function (res) {
        var indexes = res.indexes.map(function (index) {
          return {
            name: index.name,
            ddoc: index.ddoc,
            type: index.type
          };
        });
        indexes.should.deep.equal([
          {
            name: '_all_docs',
            type: 'special',
            ddoc: null
          },
          {
            name: 'myindex',
            ddoc: '_design/mydesigndoc',
            type: 'json'
          }
        ]);
        return db.get('_design/mydesigndoc');
      });
    });

  });
};