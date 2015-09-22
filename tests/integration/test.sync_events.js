'use strict';

var adapters = [
  ['local', 'http'],
  ['http', 'http'],
  ['http', 'local'],
  ['local', 'local']
];

if ('saucelabs' in testUtils.params()) {
  adapters = [['local', 'http'], ['http', 'local']];
}


adapters.forEach(function (adapters) {
  var title = 'test.sync_events.js-' + adapters[0] + '-' + adapters[1];
  describe('suite2 ' + title, function () {

    var dbs = {};

    beforeEach(function (done) {
      dbs.name = testUtils.adapterUrl(adapters[0], 'testdb');
      dbs.remote = testUtils.adapterUrl(adapters[1], 'test_repl_remote');
      testUtils.cleanup([dbs.name, dbs.remote], done);
    });

    after(function (done) {
      testUtils.cleanup([dbs.name, dbs.remote], done);
    });


    it('#4251 Should fire paused and active on sync', function (done) {

      var db = new PouchDB(dbs.name);
      db.bulkDocs([{_id: 'a'}, {_id: 'b'}]);
      var repl = db.sync(dbs.remote, {retry: true, live: true});
      var pausedCount = 0;
      var activeCount = 0;

      repl.on('complete', function() {
        done();
      });

      repl.on('active', function(evt) {
        activeCount++;
        console.log('active', activeCount);
      });

      repl.on('paused', function(evt) {
        pausedCount++;
        console.log('paused', pausedCount);
        if(pausedCount > 0 && activeCount > 0) {
          console.log('finished');
          repl.cancel();
        }
      });
    });

  });
});
