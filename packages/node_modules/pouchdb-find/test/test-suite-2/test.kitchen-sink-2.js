'use strict';

/**
 * "kitchen sink" tests - just throw everything at the wall
 * and see what sticks.
 */

var testUtils = require('../test-utils');
var should = testUtils.should;

function humanizeNum(i) {
  var res = (i + 1).toString();
  while (res.length < 3) {
    res = '0' + res;
  }
  return res;
}

module.exports = function (dbType, context) {

  describe(dbType + ': kitchen-sink-2', function () {

    /* jshint maxlen:false */

    // to actually generate the list:
    // var configs = // whatever python spit out
    // var tests = []
    // configs.forEach(function (config) {db.find(config).then(function (res) {return {res: {docs: res.docs.map(function (doc) {return doc._id;})}}}, function (err){return {err: err}}).then(function (res){tests.push({input: config, output: res})})})
    var testConfigs = [{"input":{"selector":{"$and":[{"series":{"$ne":"kirby"}},{"series":{"$ne":"pokemon"}},{"_id":{"$gt":"mario"}},{"debut":{"$lte":1993}}]}},"output":{"res":{"docs":["samus","yoshi"]}}},{"input":{"selector":{"_id":{"$gte":"link"}}},"output":{"res":{"docs":["link","luigi","mario","ness","pikachu","puff","samus","yoshi"]}}},{"input":{"selector":{"_id":{"$lt":"samus", "$gt": "a"}}},"output":{"res":{"docs":["dk","falcon","fox","kirby","link","luigi","mario","ness","pikachu","puff"]}}},{"input":{"selector":{"$and":[{"_id":{"$eq":"pikach"}},{"name":{"$gte":"link"}},{"rank":{"$ne":8}}]}},"output":{"res":{"docs":[]}}},{"input":{"selector":{"$and":[{"rank":{"$lt":1}},{"_id":{"$lt":"fox"}}]}},"output":{"res":{"docs":[]}}},{"input":{"selector":{"$and":[{"name":{"$ne":"jigglypuff"}},{"_id":{"$lt":"puff"}},{"rank":{"$gte":4}},{"_id":{"$gt":"pikach"}}]}},"output":{"res":{"docs":[]}}},{"input":{"selector":{"$and":[{"_id":{"$lte":"dk"}},{"series":{"$lt":"mario"}}]}},"output":{"res":{"docs":[]}}},{"input":{"selector":{"$and":[{"series":{"$lt":"star fox"}},{"_id":{"$gte":"ness"}}]}},"output":{"res":{"docs":["ness","pikachu","puff","samus","yoshi"]}}},{"input":{"selector":{"$and":[{"_id":{"$gt":"samus"}},{"name":{"$gt":"fox"}}]}},"output":{"res":{"docs":["yoshi"]}}},{"input":{"sort":["_id"],"selector":{"$and":[{"rank":{"$ne":4}},{"rank":{"$gte":9}},{"_id":{"$gt":"ness"}},{"_id":{"$ne":"ness"}}]}},"output":{"res":{"docs":["samus"]}}},{"input":{"sort":["_id"],"selector":{"$and":[{"name":{"$gt":"yoshi"}},{"_id":{"$lte":"puff"}}]}},"output":{"res":{"docs":[]}}},{"input":{"selector":{"$and":[{"series":{"$gte":"kirby"}},{"_id":{"$lte":"dk"}}]}},"output":{"res":{"docs":["dk"]}}},{"input":{"selector":{"$and":[{"series":{"$gt":"mario"}},{"_id":{"$lt":"mario"}},{"name":{"$ne":"link"}}]}},"output":{"res":{"docs":["fox"]}}},{"input":{"selector":{"$and":[{"name":{"$eq":"fox"}},{"_id":{"$lte":"pikach"}}]}},"output":{"res":{"docs":["fox"]}}},{"input":{"selector":{"$and":[{"rank":{"$lt":9}},{"_id":{"$lte":"puff"}}]}},"output":{"res":{"docs":["dk","falcon","fox","kirby","mario","pikachu","puff"]}}},{"input":{"selector":{"$and":[{"name":{"$eq":"ness"}},{"_id":{"$lte":"luigi"}}]}},"output":{"res":{"docs":[]}}},{"input":{"selector":{"$and":[{"name":{"$lte":"mario"}},{"_id":{"$lt":"mario"}},{"debut":{"$eq":1990}}]}},"output":{"res":{"docs":["falcon"]}}},{"input":{"selector":{"$and":[{"debut":{"$lte":1994}},{"_id":{"$lte":"link"}},{"_id":{"$lte":"pikach"}},{"rank":{"$gt":4}}]}},"output":{"res":{"docs":["dk","link"]}}},{"input":{"selector":{"$and":[{"name":{"$lt":"yoshi"}},{"_id":{"$eq":"falcon"}},{"rank":{"$ne":2}}]}},"output":{"res":{"docs":["falcon"]}}},{"input":{"sort":["_id"],"selector":{"_id":{"$lt":"falcon", "$gt": "a"}}},"output":{"res":{"docs":["dk"]}}},{"input":{"selector":{"$and":[{"rank":{"$gte":5}},{"_id":{"$lt":"link"}},{"series":{"$ne":"mario"}}]}},"output":{"res":{"docs":[]}}},{"input":{"selector":{"$and":[{"rank":{"$gt":10}},{"_id":{"$lt":"luigi"}},{"series":{"$gte":"mario"}},{"debut":{"$lt":1992}}]}},"output":{"res":{"docs":[]}}},{"input":{"selector":{"$and":[{"name":{"$gt":"samus"}},{"_id":{"$gte":"kirby"}},{"series":{"$gte":"pokemon"}}]}},"output":{"res":{"docs":[]}}},{"input":{"selector":{"$and":[{"series":{"$lt":"f-zero"}},{"_id":{"$lt":"pikach"}}]}},"output":{"res":{"docs":["ness"]}}},{"input":{"selector":{"$and":[{"rank":{"$lt":6}},{"_id":{"$eq":"kirby"}},{"name":{"$eq":"fox"}}]}},"output":{"res":{"docs":[]}}},{"input":{"selector":{"$and":[{"name":{"$lt":"luigi"}},{"name":{"$lt":"jigglypuff"}},{"_id":{"$gt":"samus"}}]}},"output":{"res":{"docs":[]}}},{"input":{"selector":{"$and":[{"series":{"$lte":"mario"}},{"_id":{"$gte":"kirby"}},{"_id":{"$lt":"puff"}}]}},"output":{"res":{"docs":["kirby","luigi","mario","ness"]}}},{"input":{"sort":["_id"],"selector":{"$and":[{"series":{"$eq":"pokemon"}},{"_id":{"$gte":"samus"}},{"rank":{"$ne":4}},{"debut":{"$ne":1990}}]}},"output":{"res":{"docs":[]}}},{"input":{"selector":{"$and":[{"series":{"$gt":"mario"}},{"_id":{"$lt":"mario"}}]}},"output":{"res":{"docs":["fox","link"]}}},{"input":{"sort":["_id"],"selector":{"$and":[{"_id":{"$lt":"fox"}},{"debut":{"$ne":1993}},{"name":{"$lte":"luigi"}}]}},"output":{"res":{"docs":["dk","falcon"]}}},{"input":{"selector":{"$and":[{"_id":{"$lt":"samus"}},{"debut":{"$ne":1986}},{"debut":{"$lte":1983}}]}},"output":{"res":{"docs":["dk","luigi","mario"]}}},{"input":{"selector":{"_id":{"$gt":"fox"}}},"output":{"res":{"docs":["kirby","link","luigi","mario","ness","pikachu","puff","samus","yoshi"]}}}];

    /* jshint maxlen:100 */

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
};