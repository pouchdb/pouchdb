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

      repl.on('complete', function () { done(); });

      repl.on('active', function () {
        counter++;
        if (!(counter === 2 || counter === 4)) {
          done('active fired incorrectly');
        }
      });

      repl.on('paused', function () {
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

      db.bulkDocs([{_id: 'a'}, {_id: 'b'}]).then(function () {

        var repl = db.replicate.to(dbs.remote, {retry: true, live: true});

        var counter = 0;

        repl.on('complete', function () { done(); });

        repl.on('active', function () {
          counter++;
          if (!(counter === 1 || counter === 3 || counter === 5)) {
            done('active fired incorrectly:' + counter);
          }
        });

        repl.on('paused', function () {
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
      var remote = new PouchDB(dbs.remote);
      var rejectAjax = true;
      var ajax = remote._ajax;

      remote._ajax = function (opts, cb) {
        if (rejectAjax) {
          cb(new Error('flunking you'));
        } else {
          ajax.apply(this, arguments);
        }
      };

      db.bulkDocs([{_id: 'a'}, {_id: 'b'}]).then(function () {

        var repl = db.replicate.to(remote, {
          retry: true,
          live: true,
          back_off_function: function () { return 0; }
        });

        var counter = 0;

        repl.on('complete', function () {
          remote._ajax = ajax;
          done();
        });

        repl.on('active', function () {
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

        repl.on('paused', function (err) {
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
    // documents from a remote to a local database.
    // At the same time, we insert documents locally - the changes
    // should propagate to the remote database and then back to the
    // local database via the live replications.
    // Previously, this test resulted in 'change' events being
    // generated for already-replicated documents. When PouchDB is working
    // as expected, each remote document should be passed to a
    // change event exactly once (though a change might contain multiple docs)
    it('#4627 Test no duplicate changes in live replication', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var docId = -1;
      var docsToGenerate = 10;
      var lastChange = -1;
      var firstReplication;
      var secondReplication;
      var completeCalls = 0;

      function generateDocs(n) {
        return Array.apply(null, new Array(n)).map(function () {
          docId += 1;
          return {
            _id: docId.toString(),
            foo: Math.random().toString()
          };
        });
      }

      function complete() {
        completeCalls++;
        if (completeCalls === 2) {
          done();
        }
      }

      remote.bulkDocs(generateDocs(docsToGenerate)).then(function () {
        firstReplication = db.replicate.to(remote, {
          live: true,
          retry: true,
          since: 0
        })
        .on('error', done)
        .on('complete', complete);

        secondReplication = remote.replicate.to(db, {
          live: true,
          retry: true,
          since: 0
        })
        .on('error', done)
        .on('complete', complete)
        .on('change', function (feed) {
          // attempt to detect changes loop
          var ids = feed.docs.map(function (d) {
            return parseInt(d._id, 10);
          }).sort();

          var firstChange = ids[0];
          if (firstChange <= lastChange) {
            done(new Error("Duplicate change events detected"));
          }

          lastChange = ids[ids.length - 1];

          if (lastChange === docsToGenerate - 1) {
            // if a change loop doesn't occur within 2 seconds, assume success
            setTimeout(function () {
              // success!
              // cancelling the replications to clean up and trigger
              // the 'complete' event, which in turn ends the test
              firstReplication.cancel();
              secondReplication.cancel();
            }, 2000);
          }

          // write doc to local db - should round trip in _changes
          // but not generate a change event
          db.bulkDocs(generateDocs(1));
        });
      }).catch(done);
    });

    describe('#5172 triggering error when replicating', function () {
      var securedDbs = [], source, dest, previousAjax;
      beforeEach(function () {
        var err = {
          'status': 401,
          'name': 'unauthorized',
          'message': 'You are not authorized to access this db.'
        };

        source = new PouchDB(dbs.name);
        dest = new PouchDB(dbs.remote);

        if (adapters[0] === 'http') {
          previousAjax = source._ajax;
          source._ajax = function (opts, cb) { cb(err); };
          securedDbs.push(source);
        }

        if (adapters[1] === 'http') {
          previousAjax = dest._ajax;
          dest._ajax = function (opts, cb) { cb(err); };
          securedDbs.push(dest);
        }
      });

      afterEach(function () {
        securedDbs.forEach(function (db) {
          db._ajax = previousAjax;
        });
      });

      function attachHandlers(replication) {
        var invokedHandlers = [];
        ['change', 'complete', 'paused', 'active', 'denied', 'error'].forEach(function (type) {
          replication.on(type, function () {
            invokedHandlers.push(type);
          });
        });
        return invokedHandlers;
      }

      it('from or to a secured database, using live replication', function () {
        if (adapters[0] === 'local' && adapters[1] === 'local') {
          return;
        }

        var replication = source.replicate.to(dest, {live: true});
        var invokedHandlers = attachHandlers(replication);

        return replication.then(function () {
          throw new Error('Resulting promise should be rejected');
        }, function () {
          invokedHandlers.should.be.eql(['error'], 'incorrect handler was invoked');
        });
      });

      it('from or to a secured database, using live replication with checkpoint', function () {
        if (adapters[0] === 'local' && adapters[1] === 'local') {
          return;
        }

        var replication = source.replicate.to(dest, {live: true, since: 1234});
        var invokedHandlers = attachHandlers(replication);

        return replication.then(function () {
          throw new Error('Resulting promise should be rejected');
        }, function () {
          invokedHandlers.should.be.eql(['error'], 'incorrect handler was invoked');
        });
      });

      it('from or to a secured database, using live replication with retrying', function () {
        if (adapters[0] === 'local' && adapters[1] === 'local') {
          return;
        }

        var replication = source.replicate.to(dest, {live: true, retry: true});
        var invokedHandlers = attachHandlers(replication);

        return replication.then(function () {
          throw new Error('Resulting promise should be rejected');
        }, function () {
          invokedHandlers.should.be.eql(['error'], 'incorrect handler was invoked');
        });
      });

      it('from or to a secured database, using one-shot replication', function () {
        if (adapters[0] === 'local' && adapters[1] === 'local') {
          return;
        }

        var replication = source.replicate.to(dest);
        var invokedHandlers = attachHandlers(replication);

        return replication.then(function () {
          throw new Error('Resulting promise should be rejected');
        }, function () {
          invokedHandlers.should.be.eql(['error'], 'incorrect handler was invoked');
        });
      });
    });
  });
});
