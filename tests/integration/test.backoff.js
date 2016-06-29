'use strict';

var adapters = [
  ['local', 'http']
];

adapters.forEach(function (adapters) {
  var suiteName = 'test.backoff.js-' + adapters[0] + '-' + adapters[1];
  describe(suiteName, function () {

    var dbs = {};

    beforeEach(function (done) {
      dbs.name = testUtils.adapterUrl(adapters[0], 'testdb');
      dbs.remote = testUtils.adapterUrl(adapters[1], 'test_repl_remote');
      testUtils.cleanup([dbs.name, dbs.remote], done);
    });

    after(function (done) {
      testUtils.cleanup([dbs.name, dbs.remote], done);
    });

    it('Issue 5402 should not keep adding event listeners when backoff is firing', function (done) {
      var remote = new PouchDB(dbs.remote);
      var db = new PouchDB(dbs.name);
      var backOffCount = 0;
      var replication = db.sync(remote, {
        live: true,
        retry: true,
        heartbeat: 1,
        timeout: 1,
        back_off_function: function () {
          var numberOfActiveListeners = replication.pull.listeners("active").length;
          ++backOffCount;
          if (backOffCount > 15 || numberOfActiveListeners > 3) {
            replication.cancel();
            if (numberOfActiveListeners > 3) {
              done(new Error("Number of 'active' listeners shouldn't grow larger than one.  Currently at " + numberOfActiveListeners));
            } else {
              done();
            }
          }
          return 1;
        }
      });
    });
  });
});
