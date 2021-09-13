'use strict';

describe('test.mod.js', function () {
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

  it('should get all even values', function () {
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
          rank: {$mod: [2, 0]}
        },
        sort: ['name']
      }).then(function (resp) {
        var docs = resp.docs.map(function (doc) {
          delete doc._rev;
          return doc;
        });

        docs.should.deep.equal([
          { name: 'Captain Falcon', _id: 'falcon', rank: 4, series: 'F-Zero', debut: 1990,
            awesome: true },
          { name: 'Jigglypuff', _id: 'puff', rank: 8, series: 'Pokemon', debut: 1996,
            awesome: false },
          { name: 'Kirby', _id: 'kirby', series: 'Kirby', rank: 2, debut: 1992, awesome: true },
          { name: 'Link', rank: 10, _id: 'link', series: 'Zelda', debut: 1986, awesome: true },
          { name: 'Master Hand', _id: 'master_hand', series: 'Smash Bros', rank: 0, debut: 1999,
            awesome: false },
          { name: 'Samus', rank: 12, _id: 'samus', series: 'Metroid', debut: 1986,
            awesome: true },
          { name: 'Yoshi', _id: 'yoshi', rank: 6, series: 'Mario', debut: 1990, awesome: true },
        ]);
      });
    });
  });

  it('should error for zero divisor', function () {
    var db = context.db;
    var index = {
      "index": {
        "fields": ["name"]
      }
    };
    return db.createIndex(index).then(function () {
      return db.find({
        selector: {
          name: { $gte: null },
          rank: { $mod: [ 0, 0 ] }
        },
        sort: [ 'name' ]
      }).then(function () {
        throw new Error('Function should throw');
      }, function (err) {
        err.message.should.eq("Query operator $mod's divisor cannot be 0, cannot divide by zero.");
      });
    });
  });

  it('should error for non-integer divisor', function () {
    var db = context.db;
    var index = {
      "index": {
        "fields": ['name']
      }
    };
    return db.createIndex(index).then(function () {
      return db.find({
        selector: {
          name: {$gte: null},
          rank: {$mod: ['a', 0]}
        },
        sort: ['name']
      }).then(function () {
        throw new Error('Function should throw');
      }, function (err) {
        err.message.should.eq("Query operator $mod's divisor is not an integer. Received string: a");
      });
    });
  });

  it('should error for non-integer modulus', function () {
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
          rank: {$mod: [1, 'a']}
        },
        sort: ['name']
      }).then(function () {
        throw new Error('Function should throw');
      }, function (err) {
        err.message.should.eq("Query operator $mod's remainder is not an integer. Received string: a");
      });
    });
  });

  it('should error for non-array modulus', function () {
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
          rank: {$mod: 'a'}
        },
        sort: ['name']
      }).then(function () {
        throw new Error('Function should throw');
      }, function (err) {
        err.message.should.eq('Query operator $mod must be an array. Received string: a');
      });
    });
  });
  it('should error for wrong query value length', function () {
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
          rank: {$mod: [10]}
        },
        sort: ['name']
      }).then(function () {
        throw new Error('Function should throw');
      }, function (err) {
        err.message.should.eq('Query operator $mod must be in the format [divisor, remainder], where divisor and remainder are both integers. Received array: ' + JSON.stringify([10], null, "\t"));
      });
    });
  });

  it('should ignore non-int field values', function () {
    var db = context.db;
    return context.db.bulkDocs([
      { _id: "int", int: 10 },
      { _id: "float", int: 10.1 },
      { _id: "string", int: "10" },
    ]).then(function () {
      return db.find({
        selector: {
          int: { $mod: [ 3, 1 ] }
        },
      }).then(function (resp) {
        var docs = resp.docs.map(function (doc) {
          delete doc._rev;
          return doc;
        });

        docs.should.deep.equal([
          { _id: "int", int: 10 }
        ]);
      });
    });
  });
});
