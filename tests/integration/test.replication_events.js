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
  var title = 'test.replication_events.js-' + adapters[0] + '-' + adapters[1];
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


    it('#3852 Test basic starting empty', function (done) {

      var db = new PouchDB(dbs.name);
      var repl = db.replicate.to(dbs.remote, {retry: true, live: true});
      var counter = 0;

      repl.on('complete', function() { done(); });

      repl.on('active', function(evt) {
        counter++;
        if (!(counter === 2 || counter === 4)) {
          done('active fired incorrectly');
        }
      });

      repl.on('paused', function(evt) {
        counter++;
        // We should receive a paused event when replication
        // starts because there is nothing to replicate
        if (counter === 1) {
          db.bulkDocs([{_id: 'a'}, {_id: 'b'}]);
        } else if (counter === 3) {
          db.bulkDocs([{_id: 'c'}, {_id: 'd'}]);
        } else if (counter === 5) {
          repl.cancel();
        } else {
          done('paused fired incorrectly');
        }
      });
    });


    it('#3852 Test basic starting with docs', function (done) {

      var db = new PouchDB(dbs.name);

      db.bulkDocs([{_id: 'a'}, {_id: 'b'}]).then(function() {

        var repl = db.replicate.to(dbs.remote, {retry: true, live: true});

        var counter = 0;

        repl.on('complete', function() { done(); });

        repl.on('active', function(evt) {
          counter++;
          if (!(counter === 1 || counter === 3 || counter === 5)) {
            done('active fired incorrectly:' + counter);
          }
        });

        repl.on('paused', function(evt) {
          counter++;
          // We should receive a paused event when replication
          // starts because there is nothing to replicate
          if (counter === 2) {
            db.bulkDocs([{_id: 'c'}, {_id: 'd'}]);
          } else if (counter === 4) {
            db.bulkDocs([{_id: 'e'}, {_id: 'f'}]);
          } else if (counter === 6) {
            repl.cancel();
          } else {
            done('paused fired incorrectly');
          }
        });
      });
    });

    it('#3852 Test errors', function (done) {

      if (!(/http/.test(dbs.remote) && !/http/.test(dbs.name))) {
        // Only run test when remote is http and local is local
        return done();
      }

      var db = new PouchDB(dbs.name);
      var rejectAjax = true;
      var ajax = PouchDB.utils.ajax;

      PouchDB.utils.ajax = function (opts, cb) {
        if (rejectAjax) {
          cb(new Error('flunking you'));
        } else {
          ajax.apply(this, arguments);
        }
      };

      db.bulkDocs([{_id: 'a'}, {_id: 'b'}]).then(function() {

        var repl = db.replicate.to(dbs.remote, {
          retry: true,
          live: true,
          back_off_function: function () { return 0; }
        });

        var counter = 0;

        repl.on('complete', function() {
          PouchDB.utils.ajax = ajax;
          done();
        });

        repl.on('active', function(evt) {
          counter++;
          if (counter === 2) {
            // All good, wait for pause
          } else if (counter === 4) {
            // Lets start failing while active
            rejectAjax = true;
            db.bulkDocs([{_id: 'e'}, {_id: 'f'}]);
          } else if (counter === 6) {
            // All good, wait for pause
          } else {
            done('active fired incorrectly');
          }
        });

        repl.on('paused', function(err) {
          counter++;
          // Replication starts with a paused(err) because ajax is
          // failing
          if (counter === 1) {
            should.exist(err);
            // Lets let the repliation start
            rejectAjax = false;
          } else if (counter === 3) {
            db.bulkDocs([{_id: 'c'}, {_id: 'd'}]);
          } else if (counter === 5) {
            // We started failing while active, should have an error
            // then we stop rejecting and should become active again
            should.exist(err);
            rejectAjax = false;
          } else if (counter === 7) {
            repl.cancel();
          } else {
            done('paused fired incorrectly');
          }
        });
      }).catch(done);
    });


    // this test sets up a 2 way replication which initially transfers
    // documents from a remote to a local database. Once the initial
    // sync is complete, it inserts documents locally - the changes
    // should propagate to the remote database and then back to the
    // local database via the live replications. However, we do not
    // expect any "change" events to fire for these documents since
    // they already exist locally.
    it('#4627 Test no duplicate changes in live replication', function () {
      return new PouchDB.utils.Promise(function (resolve, reject) {
        var db = new PouchDB(dbs.name);
        var remote = new PouchDB(dbs.remote);
        var docId = -1;
        var docsToGenerate = 10;
        var lastChange = -1;

        function generateDocs(n) {
          return Array.apply(null, new Array(n)).map(function (e, i) {
            docId += 1;
            return {
              _id: docId.toString(),
              foo: Math.random().toString()
            };
          });
        }

        remote.bulkDocs(generateDocs(docsToGenerate)).then(function () {
          db.replicate.to(remote, {
            live: true,
            retry: true,
            since: 0
          });

          var replicationHandler = remote.replicate.to(db, {
            live: true,
            retry: true,
            since: 0
          }).on("change", function (feed) {
            // attempt to detect changes loop
            var ids = feed.docs.map(function (d) {
              return parseInt(d._id, 10);
            }).sort();

            var firstChange = ids[0];
            if (firstChange <= lastChange)
            {
              reject(new Error("Duplicate change events detected"));
            }

            lastChange = ids[ids.length - 1];

            if (lastChange === docsToGenerate - 1) {
              // if loop doesn't occur within 2 seconds, assume success
              setTimeout(function () {
                replicationHandler.cancel();
                resolve();
              }, 2000);
            }

            // write doc to local db (should round trip in _changes)
            // but not generate change event
            db.bulkDocs(generateDocs(1));
          });
        });
      });
    });
  });
});
