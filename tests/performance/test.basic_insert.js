'use strict';

var request = require('request');

if (!process.env.DASHBOARD_HOST) {
  console.log('DASHBOARD_HOST is required');
  process.exit(0);
}

var DASHBOARD_HOST = 'http://localhost:5984'// process.env.DASHBOARD_HOST;
var adapters = ['http', 'local'];

adapters.forEach(function (adapter) {
  describe('test.basics.js-' + adapter, function () {

    var dbs = {};
    var results;

    beforeEach(function (done) {
      dbs.name = testUtils.adapterUrl(adapter, 'test_basics');
      testUtils.cleanup([dbs.name], done);
    });

    afterEach(function (done) {
      testUtils.cleanup([dbs.name], done);
    });

    var before = Date.now();
    it('Performance: Add 1000 docs', function (done) {
      var db = new PouchDB(dbs.name);
      for (var i = 0; i < 1000; i++) {
        db.post({test: 'somestuff'}, function (err, info) {
          should.not.exist(err);
          done();
        });
      }
    });
    results.basic_insert_time = Date.now() - before;
    
    var options = {
      method: 'POST',
      uri: DASHBOARD_HOST + '/performance',
      json: results
    };
    
    request(options, function (error, response, body) {
      if (!error) {
        return process.exit(0);
      } else {
        return process.exit(1);
      }
    });
  });
});
