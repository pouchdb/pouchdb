'use strict';

testCases.push(function (dbType, context) {

  describe(dbType + ': test.use-index.js', function () {

    beforeEach(function () {
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
      ])
      .then(function () {
        return db.createIndex({
          index: {
            "fields": ["name", "series"]
          },
          "ddoc": "index-1",
          "type": "json"
        });
      })
      .then(function () {
        return db.createIndex({
          index: {
            "fields": ["name", "debut"]
          },
          "ddoc": "index-2",
          "type": "json"
        });
      })
      .then(function () {
        return db.createIndex({
          index: {
            "fields": ["name", "another_field"]
          },
          "ddoc": "index-3",
          "name": "third-index",
          "type": "json"
        });
      });
    });

    it.skip('use index based on ddoc', function () {
      var db = context.db;
      return db.explain({
        selector: {
          name: 'mario'
        },
        use_index: "index-2",
        fields: ["_id"]
      }).then(function (resp) {
        resp.index.ddoc.should.equal("_design/index-2");
      });
    });

    if (dbType === 'http') {
      return;
    }
    it('use index based on ddoc and name', function () {
      var db = context.db;
      return db.explain({
        selector: {
          name: 'mario'
        },
        use_index: ["index-3", "third-index"],
        fields: ["_id"]
      }).then(function (resp) {
        resp.index.ddoc.should.equal("_design/index-3");
      });
    });

    it('throws error if index does not exist', function () {
      var db = context.db;
      return db.explain({
        selector: {
          name: 'mario'
        },
        use_index: "index-not-found",
        fields: ["_id"]
      }).then(function () {
        throw "Should not get here";
      })
      .catch(function (err) {
        err.error.should.equal("unknown_error");
      });
    });

    it('throws error if index cannot be used', function () {
      var db = context.db;
      return db.explain({
        selector: {
          rank : 2
        },
        use_index: "index-2",
        fields: ["_id"]
      }).then(function () {
        throw "Should not get here";
      })
      .catch(function (err) {
        err.error.should.equal("no_usable_index");
      });
    });
  });

});
