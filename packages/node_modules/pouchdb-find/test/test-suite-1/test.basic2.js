'use strict';

var testUtils = require('../test-utils');
var sortById = testUtils.sortById;
var should = testUtils.should;

module.exports = function (dbType, context) {

  describe(dbType + ': basic2', function () {

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

    it('should include ddocs in _id results', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": ["foo"]
        },
        "name": "foo-index",
        "type": "json"
      };
      return db.createIndex(index).then(function () {
        return db.getIndexes();
      }).then(function (res) {
        var ddoc = res.indexes[1].ddoc;
        return db.find({
          selector: {_id: {$gt: '\u0000'}},
          fields: ['_id'],
          sort: ['_id']
        }).then(function (response) {
          response.docs.should.deep.equal([
            {"_id": ddoc},
            {"_id": "dk"},
            {"_id": "falcon"},
            {"_id": "fox"},
            {"_id": "kirby"},
            {"_id": "link"},
            {"_id": "luigi"},
            {"_id": "mario"},
            {"_id": "ness"},
            {"_id": "pikachu"},
            {"_id": "puff"},
            {"_id": "samus"},
            {"_id": "yoshi"}
          ]);
        });
      });
    });

    it('should find debut > 1990', function () {
      var db = context.db;
      return db.createIndex({
        "index": {
          "fields": ["name"]
        }
      }).then(function () {
        return db.createIndex({
          index: {fields: ['debut']}
        });
      }).then(function () {
        return db.find({
          selector: {debut: {$gt: 1990}},
          fields: ['_id'],
          sort: ['debut']
        });
      }).then(function (response) {
        response.docs.should.deep.equal([
          {"_id":"kirby"},
          {"_id":"fox"},
          {"_id":"ness"},
          {"_id":"pikachu"},
          {"_id":"puff"}
        ]);
      });
    });

    it('should find debut > 1990 2', function () {
      var db = context.db;
      return db.createIndex({
        "index": {
          "fields": ["name"]
        }
      }).then(function () {
        return db.createIndex({
          index: {fields: ['debut']}
        });
      }).then(function () {
        return db.createIndex({
          index: {fields: ['series', 'debut']}
        });
      }).then(function () {
        return db.find({
          selector: {debut: {$gt: 1990}},
          fields: ['_id'],
          sort: ['debut']
        });
      }).then(function (response) {
        response.docs.should.deep.equal([
          {"_id":"kirby"},
          {"_id":"fox"},
          {"_id":"ness"},
          {"_id":"pikachu"},
          {"_id":"puff"}
        ]);
      });
    });

    it('should find debut > 1990 3', function () {
      var db = context.db;
      return db.createIndex({
        "index": {
          "fields": ["name"]
        }
      }).then(function () {
        return db.createIndex({
          index: {fields: ['debut']}
        });
      }).then(function () {
        return db.createIndex({
          index: {fields: ['series', 'debut']}
        });
      }).then(function () {
        return db.find({
          selector: {debut: {$gt: 1990}},
          fields: ['_id']
        });
      }).then(function (response) {
        response.docs.sort(sortById);
        response.docs.should.deep.equal([
          {"_id":"fox"},
          {"_id":"kirby"},
          {"_id":"ness"},
          {"_id":"pikachu"},
          {"_id":"puff"}
        ]);
      });
    });

    it('should find series == mario', function () {
      var db = context.db;
      return db.createIndex({
        "index": {
          "fields": ["name"]
        }
      }).then(function () {
        return db.createIndex({
          index: {fields: ['debut']}
        });
      }).then(function () {
        return db.createIndex({
          index: {fields: ['series', 'debut']}
        });
      }).then(function () {
        return db.find({
          selector: {series: {$eq: 'Mario'}},
          fields: ['_id', 'debut'],
          sort: [{series: 'desc'}, {debut: 'desc'}]
        });
      }).then(function (response) {
        response.docs.should.deep.equal([
          {"_id":"yoshi","debut":1990},
          {"_id":"luigi","debut":1983},
          {"_id":"mario","debut":1981},
          {"_id":"dk","debut":1981}
        ]);
      });
    });

    it('throws an error for an invalid selector/sort', function () {
      var db = context.db;
      return db.createIndex({
        index: {fields: ['series', 'debut']}
      }).then(function () {
        return db.find({
          selector: {series: 'Mario', debut: 1981},
          sort: ['name']
        });
      }).then(function () {
        throw new Error('expected an error');
      }, function (err) {
        should.exist(err);
      });
    });

  });
};
