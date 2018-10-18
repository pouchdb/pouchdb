'use strict';

/**
 * "kitchen sink" tests - just throw everything at the wall
 * and see what sticks.
 */

['local', 'http'].forEach(function (adapter) {

  function humanizeNum(i) {
    var res = (i + 1).toString();
    while (res.length < 3) {
      res = '0' + res;
    }
    return res;
  }

  var dbName = testUtils.adapterUrl(adapter, 'testdb');
  var Promise = testUtils.Promise;

  describe('pouchdb-find: ' + adapter + ': test.kitchen-sink-2.js', function () {
    // tests that don't destroy/recreate the database for each test,
    // because that makes them take a long time

    this.timeout(100000);

    var context = {};

    before(function () {
      this.timeout(60000);
      context.db = new PouchDB(dbName);

      return context.db.bulkDocs([
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
      ]).then(function () {
        // This could be done by Promise.all, but for now that breaks IDBNext.
        // Promise.all index creation is tested explicitly in test.ddoc.js
        var indexes = [
          {index: {fields: ['rank']}},
          {index: {fields: ['series']}},
          {index: {fields: ['debut']}},
          {index: {fields: ['name']}},
          {index: {fields: ['name', 'rank']}},
          {index: {fields: ['name', 'series']}},
          {index: {fields: ['series', 'debut', 'rank']}},
          {index: {fields: ['rank', 'debut']}},
        ];

        return indexes.reduce(function (p, index) {
          return p.then(function () { return context.db.createIndex(index); });
        }, Promise.resolve());
      });
    });
    after(function () {
      this.timeout(60000);
      return context.db.destroy();
    });

    // to actually generate the list:
    // var configs = // whatever python spit out
    // var tests = []
    // configs.forEach(function (config) {db.find(config).then(function (res) {return {res: {docs: res.docs.map(function (doc) {return doc._id;})}}}, function (err){return {err: err}}).then(function (res){tests.push({input: config, output: res})})})
    var testConfigs = [{"input":{"selector":{"$and":[{"series":{"$ne":"kirby"}},{"series":{"$ne":"pokemon"}},{"_id":{"$gt":"mario"}},{"debut":{"$lte":1993}}]}},"output":{"res":{"docs":["samus","yoshi"]}}},{"input":{"selector":{"_id":{"$gte":"link"}}},"output":{"res":{"docs":["link","luigi","mario","ness","pikachu","puff","samus","yoshi"]}}},{"input":{"selector":{"_id":{"$lt":"samus", "$gt": "a"}}},"output":{"res":{"docs":["dk","falcon","fox","kirby","link","luigi","mario","ness","pikachu","puff"]}}},{"input":{"selector":{"$and":[{"_id":{"$eq":"pikach"}},{"name":{"$gte":"link"}},{"rank":{"$ne":8}}]}},"output":{"res":{"docs":[]}}},{"input":{"selector":{"$and":[{"rank":{"$lt":1}},{"_id":{"$lt":"fox"}}]}},"output":{"res":{"docs":[]}}},{"input":{"selector":{"$and":[{"name":{"$ne":"jigglypuff"}},{"_id":{"$lt":"puff"}},{"rank":{"$gte":4}},{"_id":{"$gt":"pikach"}}]}},"output":{"res":{"docs":[]}}},{"input":{"selector":{"$and":[{"_id":{"$lte":"dk"}},{"series":{"$lt":"mario"}}]}},"output":{"res":{"docs":[]}}},{"input":{"selector":{"$and":[{"series":{"$lt":"star fox"}},{"_id":{"$gte":"ness"}}]}},"output":{"res":{"docs":["ness","pikachu","puff","samus","yoshi"]}}},{"input":{"selector":{"$and":[{"_id":{"$gt":"samus"}},{"name":{"$gt":"fox"}}]}},"output":{"res":{"docs":["yoshi"]}}},{"input":{"sort":["_id"],"selector":{"$and":[{"rank":{"$ne":4}},{"rank":{"$gte":9}},{"_id":{"$gt":"ness"}},{"_id":{"$ne":"ness"}}]}},"output":{"res":{"docs":["samus"]}}},{"input":{"sort":["_id"],"selector":{"$and":[{"name":{"$gt":"yoshi"}},{"_id":{"$lte":"puff"}}]}},"output":{"res":{"docs":[]}}},{"input":{"selector":{"$and":[{"series":{"$gte":"kirby"}},{"_id":{"$lte":"dk"}}]}},"output":{"res":{"docs":["dk"]}}},{"input":{"selector":{"$and":[{"series":{"$gt":"mario"}},{"_id":{"$lt":"mario"}},{"name":{"$ne":"link"}}]}},"output":{"res":{"docs":["fox"]}}},{"input":{"selector":{"$and":[{"name":{"$eq":"fox"}},{"_id":{"$lte":"pikach"}}]}},"output":{"res":{"docs":["fox"]}}},{"input":{"selector":{"$and":[{"rank":{"$lt":9}},{"_id":{"$lte":"puff"}}]}},"output":{"res":{"docs":["dk","falcon","fox","kirby","mario","pikachu","puff"]}}},{"input":{"selector":{"$and":[{"name":{"$eq":"ness"}},{"_id":{"$lte":"luigi"}}]}},"output":{"res":{"docs":[]}}},{"input":{"selector":{"$and":[{"name":{"$lte":"mario"}},{"_id":{"$lt":"mario"}},{"debut":{"$eq":1990}}]}},"output":{"res":{"docs":["falcon"]}}},{"input":{"selector":{"$and":[{"debut":{"$lte":1994}},{"_id":{"$lte":"link"}},{"_id":{"$lte":"pikach"}},{"rank":{"$gt":4}}]}},"output":{"res":{"docs":["dk","link"]}}},{"input":{"selector":{"$and":[{"name":{"$lt":"yoshi"}},{"_id":{"$eq":"falcon"}},{"rank":{"$ne":2}}]}},"output":{"res":{"docs":["falcon"]}}},{"input":{"sort":["_id"],"selector":{"_id":{"$lt":"falcon", "$gt": "a"}}},"output":{"res":{"docs":["dk"]}}},{"input":{"selector":{"$and":[{"rank":{"$gte":5}},{"_id":{"$lt":"link"}},{"series":{"$ne":"mario"}}]}},"output":{"res":{"docs":[]}}},{"input":{"selector":{"$and":[{"rank":{"$gt":10}},{"_id":{"$lt":"luigi"}},{"series":{"$gte":"mario"}},{"debut":{"$lt":1992}}]}},"output":{"res":{"docs":[]}}},{"input":{"selector":{"$and":[{"name":{"$gt":"samus"}},{"_id":{"$gte":"kirby"}},{"series":{"$gte":"pokemon"}}]}},"output":{"res":{"docs":[]}}},{"input":{"selector":{"$and":[{"series":{"$lt":"f-zero"}},{"_id":{"$lt":"pikach"}}]}},"output":{"res":{"docs":["ness"]}}},{"input":{"selector":{"$and":[{"rank":{"$lt":6}},{"_id":{"$eq":"kirby"}},{"name":{"$eq":"fox"}}]}},"output":{"res":{"docs":[]}}},{"input":{"selector":{"$and":[{"name":{"$lt":"luigi"}},{"name":{"$lt":"jigglypuff"}},{"_id":{"$gt":"samus"}}]}},"output":{"res":{"docs":[]}}},{"input":{"selector":{"$and":[{"series":{"$lte":"mario"}},{"_id":{"$gte":"kirby"}},{"_id":{"$lt":"puff"}}]}},"output":{"res":{"docs":["kirby","luigi","mario","ness"]}}},{"input":{"sort":["_id"],"selector":{"$and":[{"series":{"$eq":"pokemon"}},{"_id":{"$gte":"samus"}},{"rank":{"$ne":4}},{"debut":{"$ne":1990}}]}},"output":{"res":{"docs":[]}}},{"input":{"selector":{"$and":[{"series":{"$gt":"mario"}},{"_id":{"$lt":"mario"}}]}},"output":{"res":{"docs":["fox","link"]}}},{"input":{"sort":["_id"],"selector":{"$and":[{"_id":{"$lt":"fox"}},{"debut":{"$ne":1993}},{"name":{"$lte":"luigi"}}]}},"output":{"res":{"docs":["dk","falcon"]}}},{"input":{"selector":{"$and":[{"_id":{"$lt":"samus"}},{"debut":{"$ne":1986}},{"debut":{"$lte":1983}}]}},"output":{"res":{"docs":["dk","luigi","mario"]}}},{"input":{"selector":{"_id":{"$gt":"fox"}}},"output":{"res":{"docs":["kirby","link","luigi","mario","ness","pikachu","puff","samus","yoshi"]}}}];

    testConfigs.forEach(function (testConfig, i) {

      function kitchenSinkTest() {
        var db = context.db;
        var query = testConfig.input;
        query.fields = ['_id'];
        return db.find(query).then(function (res) {
          if (testConfig.output.res) {
            var ids = res.docs.map(function (x) {
              return x._id;
            });
            if (!testConfig.input.sort) {
              // no guaranteed sorting, so ignore order
              ids.sort();
              testConfig.output.res.docs.sort();
            }
            ids.should.deep.equal(testConfig.output.res.docs);
          } else {
            should.exist(res.warning, 'expected a warning');
            res.warning.should.equal('no matching index found, create an ' +
              'index to optimize query time');
          }
        }, function (err) {
          if (testConfig.output.res) {
            should.not.exist(err, 'should not have thrown an error');
          } else {
            should.exist(err);
          }
        });
      }

      var testName = 'kitchen sink 2 test #' + humanizeNum(i);

      it(testName, kitchenSinkTest);

    });
  });
});
