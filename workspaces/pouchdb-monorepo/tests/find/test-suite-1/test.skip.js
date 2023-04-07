'use strict';

describe('test.skip.js', function () {
  var sortById = testUtils.sortById;

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

  it('should work with $and 1 skip 0', function () {
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
    }).then(function () {
      return db.find({
        selector: {
          $and: [
            {series: 'Mario'},
            {debut: {$gte: 1982}}
          ]
        },
        fields: ['_id'],
        skip: 0
      });
    }).then(function (res) {
      res.docs.sort(sortById);
      res.docs.should.deep.equal([{_id: 'luigi'}, {_id: 'yoshi'}]);
    });
  });

  it('should work with $and 1 skip 1', function () {
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
    }).then(function () {
      return db.find({
        selector: {
          $and: [
            {series: 'Mario'},
            {debut: {$gte: 1982}}
          ]
        },
        fields: ['_id'],
        skip: 1
      });
    }).then(function (res) {
      res.docs.sort(sortById);
      res.docs.should.deep.equal([{_id: 'yoshi'}]);
    });
  });

  it('should work with $and 1 skip 2', function () {
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
    }).then(function () {
      return db.find({
        selector: {
          $and: [
            {series: 'Mario'},
            {debut: {$gte: 1982}}
          ]
        },
        fields: ['_id'],
        skip: 2
      });
    }).then(function (res) {
      res.docs.sort(sortById);
      res.docs.should.deep.equal([]);
    });
  });

  it('should work with $and 2, same index skip 0', function () {
    var db = context.db;
    return db.createIndex({
      "index": {
        "fields": ["series", "debut"]
      }
    }).then(function () {
      return db.find({
        selector: {
          $and: [
            {series: 'Mario'},
            {debut: {$gte: 1982}}
          ]
        },
        fields: ['_id'],
        skip: 0
      });
    }).then(function (res) {
      res.docs.sort(sortById);
      res.docs.should.deep.equal([{_id: 'luigi'}, {_id: 'yoshi'}]);
    });
  });

  it('should work with $and 2, same index skip 1', function () {
    var db = context.db;
    return db.createIndex({
      "index": {
        "fields": ["series", "debut"]
      }
    }).then(function () {
      return db.find({
        selector: {
          $and: [
            {series: 'Mario'},
            {debut: {$gte: 1982}}
          ]
        },
        fields: ['_id'],
        skip: 1
      });
    }).then(function (res) {
      res.docs.sort(sortById);
      res.docs.should.deep.equal([{_id: 'yoshi'}]);
    });
  });

  it('should work with $and 2, same index skip 2', function () {
    var db = context.db;
    return db.createIndex({
      "index": {
        "fields": ["series", "debut"]
      }
    }).then(function () {
      return db.find({
        selector: {
          $and: [
            {series: 'Mario'},
            {debut: {$gte: 1982}}
          ]
        },
        fields: ['_id'],
        skip: 2
      });
    }).then(function (res) {
      res.docs.sort(sortById);
      res.docs.should.deep.equal([]);
    });
  });

  it('should work with $and 3, index/no-index skip 0', function () {
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
    }).then(function () {
      return db.find({
        selector: {
          $and: [
            {series: 'Mario'},
            {debut: {$gte: 1982}}
          ]
        },
        fields: ['_id'],
        skip: 0
      });
    }).then(function (res) {
      res.docs.sort(sortById);
      res.docs.should.deep.equal([{_id: 'luigi'}, {_id: 'yoshi'}]);
    });
  });

  it('should work with $and 3, index/no-index skip 1', function () {
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
    }).then(function () {
      return db.find({
        selector: {
          $and: [
            {series: 'Mario'},
            {debut: {$gte: 1982}}
          ]
        },
        fields: ['_id'],
        skip: 1
      });
    }).then(function (res) {
      res.docs.sort(sortById);
      res.docs.should.deep.equal([{_id: 'yoshi'}]);
    });
  });

  it('should work with $and 3, index/no-index skip 2', function () {
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
    }).then(function () {
      return db.find({
        selector: {
          $and: [
            {series: 'Mario'},
            {debut: {$gte: 1983}}
          ]
        },
        fields: ['_id'],
        skip: 2
      });
    }).then(function (res) {
      res.docs.sort(sortById);
      res.docs.should.deep.equal([]);
    });
  });

  it('should work with $and 4, wrong index', function () {
    var db = context.db;
    return db.createIndex({
      "index": {
        "fields": ["rank"]
      }
    }).then(function () {
      return db.find({
        selector: {
          $and: [
            {series: 'Mario'},
            {debut: {$gte: 1990}}
          ]
        },
        fields: ['_id'],
        skip: 1
      }).then(function (resp) {
        resp.docs.should.deep.equal([]);
      });
    });
  });

//   uncomment once skip behaviour is fixed
//   it('skip 1 should work when an index is used', async function () {
//     var db = context.db;
//     await db.createIndex({
//         index: {
//             fields: ['name']
//         }
//     });
// 
//     const resultAll = await db.find({
//         selector: {}
//     });
//     const resultNoFirst = await db.find({
//         selector: {},
//         skip: 1
//     });
//     const totalDocCount = (await db.info()).doc_count
//     assert.deepEqual(resultAll.docs.length, totalDocCount);
// 
//     // should have one document less because skip: 1
//     assert.deepEqual(resultNoFirst.docs.length, totalDocCount - 1);
//   });
});
