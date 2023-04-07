'use strict';

describe('test.regex.js', function () {
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

  it('should ignore non-string field values', function () {
    var db = context.db;
    return context.db.bulkDocs([
      { _id: "number", unknown: 10 },
      { _id: "number-as-string", unknown: "10" },
    ]).then(function () {
      return db.find({
        selector: {
          unknown: { $regex: "10" }
        },
      }).then(function (resp) {
        var docs = resp.docs.map(function (doc) {
          delete doc._rev;
          return doc;
        });

        docs.should.deep.equal([
          { _id: "number-as-string", unknown: "10" },
        ]);
      });
    });
  });
  it('should error on non string or regex query values', function () {
    var db = context.db;
    var index = {
      "index": {
        "fields": [ "name" ]
      }
    };
    return db.createIndex(index).then(function () {
      return db.find({
        selector: {
          $and: [
            { name: { $regex: 1986 } },
          ]
        },
        sort: [ 'name' ]
      }).then(function () {
        throw new Error('Function should throw');
      }, function (err) {
        if (testUtils.adapterType() === "http") {
          err.message.should.eq('Query operator $regex must be a string. Received number: 1986');
        } else {
          err.message.should.eq('Query operator $regex must be a string or an instance of a javascript regular expression. Received number: 1986');
        }
      });
    });
  });

  it('should work with index on multiple fields', function () {
    var db = context.db;
    var index = {
      "index": {
        "fields": ["name", "debut"]
      }
    };
    return db.createIndex(index).then(function () {
      return db.find({
        selector: {
          name: {$regex: "^Luig"},
          debut: {$gt: 1980}
        },
        sort: ['name']
      }).then(function (resp) {
        var docs = resp.docs.map(function (doc) {
          delete doc._rev;
          return doc;
        });

        docs.should.deep.equal([
          { name: 'Luigi', rank: 11, _id: 'luigi', series: 'Mario', debut: 1983, awesome: false },
        ]);
      });
    });
  });

  it('should works with $and with multiple $regex conditions on same field', function () {
    var db = context.db;
    var index = {
      "index": {
        "fields": ["name"]
      }
    };
    return db.createIndex(index).then(function () {
      return db.find({
        selector: {
          $and: [
            { name: { $regex: "in" } },
            { name: { $regex: "n" } },
          ]
        },
        sort: [ 'name' ]
      }).then(function (resp) {
        var docs = resp.docs.map(function (doc) {
          delete doc._rev;
          return doc;
        });
        docs.should.deep.equal([
          {
            name: 'Captain Falcon', _id: 'falcon', rank: 4, series: 'F-Zero', debut: 1990,
            awesome: true
          },
          { name: 'Link', rank: 10, _id: 'link', series: 'Zelda', debut: 1986, awesome: true },
        ]);
      });
    });
  });

  it('should find records within a simple $or condition', function () {
    var db = context.db;
    return db.find({
      selector: {
        $or: [
          { name: { $regex: 'Captain Falcon' } },
          { name: { $regex: 'Link' } },
        ]
      }
    }).then(function (resp) {
      var docs = resp.docs.map(function (doc) {
        delete doc._rev;
        return doc;
      });
      docs.should.deep.equal([
        {
          name: 'Captain Falcon', _id: 'falcon', rank: 4, series: 'F-Zero', debut: 1990,
          awesome: true
        },
        { name: 'Link', rank: 10, _id: 'link', series: 'Zelda', debut: 1986, awesome: true },
      ]);
    });
  });
});
