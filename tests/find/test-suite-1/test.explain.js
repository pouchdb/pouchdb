'use strict';

var Promise = testUtils.Promise;

testCases.push(function (dbType, context) {

  describe(dbType + ': test.explain.js', function () {
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
          "type": "json",
          "name": "index-name",
          "ddoc": "design-doc-name"
        });
      });
    });

    it.skip('explains which index it uses', function () {
      var db = context.db;
      return db.explain({
        selector: {
          name: 'mario',
          series: 'mario'
        },
        fields: ["_id"],
        limit: 10,
        skip: 1,
      }).then(function (resp) {
        var actual = { //This is an explain response from CouchDB
          "dbname": resp.dbname, //this is random based on the test
          "index": {
            "ddoc": "_design/design-doc-name",
            "name": "index-name",
            "type": "json",
            "def": {
              "fields": [
                {
                  "name": "asc"
                },
                {
                  "series": "asc"
                }
              ]
            }
          },
          "selector": {
            "$and": [
              {
                "name": {
                  "$eq": "mario"
                }
              },
              {
                "series": {
                  "$eq": "mario"
                }
              }
            ]
          },
          "opts": {
            "use_index": [],
            "bookmark": "nil",
            "limit": 25,
            "skip": 0,
            "sort": {"name": "asc"},
            "fields": [
              "_id"
            ],
            "r": [
              49
            ],
            "conflicts": false
          },
          "limit": 10,
          "skip": 1,
          "fields": [
            "_id"
          ],
          "range": {
            "start_key": [
              "mario",
              "mario"
            ],
            "end_key": [
              "mario",
              "mario",
              {}
            ]
          }
        };

        //This is a little tricky to test due to the fact that pouchdb-find and Mango do query slightly differently
        resp.dbname.should.deep.equal(actual.dbname);
        resp.index.should.deep.equal(actual.index);
        resp.fields.should.deep.equal(actual.fields);
        resp.skip.should.deep.equal(actual.skip);
        resp.limit.should.deep.equal(actual.limit);
      });
    });

    it("should work with a callback", function () {
      var db = context.db;
      return new Promise(function (resolve, reject) {
        return db.explain({
          selector: {
            name: 'mario',
            series: 'mario'
          }
        }, function (err, res) {
          if (err) {
            return reject(err);
          }

          resolve(res);
        });
      });
    });

    it("should work with a throw missing selector warning", function () {
      var db = context.db;
      db.explain()
      .catch(function (err) {
        assert.ok(/provide search parameters/.test(err.message));
      });
    });
  });
});
