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

        it('backoff event listeners', function (done) {
            var remote = new PouchDB(dbs.remote);
            var db = new PouchDB(dbs.name);
            const rep = db.sync(remote, {
                live: true,
                retry: true,
                heartbeat: 1,
                timeout: 1,
                back_off_function: function () { return 1; }
            });

            setTimeout(function () {
              var numAListeners = rep.pull.listeners("active").length;
              numAListeners.should.be.below(3);
              done();
            }, 600);
        });

    });
});
