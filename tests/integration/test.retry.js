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
  var suiteName = 'test.retry.js-' + adapters[0] + '-' + adapters[1];
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

    it('retry stuff', function (done) {
      this.timeout(2000000);
      var remote = new PouchDB(dbs.remote);
      var Promise = PouchDB.utils.Promise;
      var allDocs = remote.allDocs;

      // Reject attempting to write 'foo' 3 times, then let it succeed
      var i = 0;
      remote.allDocs = function (opts) {
        if (opts.keys[0] === 'foo') {
          if (++i !== 3) {
            return Promise.reject(new Error('flunking you'));
          }
        }
        return allDocs.apply(remote, arguments);
      };

      var db = new PouchDB(dbs.name);
      var rep = db.replicate.from(remote, {
        live: true,
        retry: true,
        back_off_function: function () { return 0; }
      });

      var paused = 0;
      rep.on('paused', function (e) {
        ++paused;
        // The first paused event is the replication up to date
        // and waiting on changes (no error)
        if (paused === 1) {
          should.not.exist(e);
          return remote.put({}, 'foo').then(function () {
            return remote.put({}, 'bar');
          });
        }
        // Second paused event is due to failed writes, should
        // have an error
        if (paused === 2) {
          should.exist(e);
        }
      });

      var active = 0;
      rep.on('active', function () {
        ++active;
      });

      rep.on('complete', function () {
        active.should.be.within(3, 4);
        paused.should.be.at.least(3);
        done();
      });

      rep.catch(done);

      var numChanges = 0;
      rep.on('change', function () {
        if (c.docs_written === 3) { 
          rep.cancel();
        }
      });

      remote.put({}, 'hazaa');
    });

    it('#3687 active event only fired once...', function (done) {

      var remote = new PouchDB(dbs.remote);
      var db = new PouchDB(dbs.name);
      var rep = db.replicate.from(remote, {
        live: true,
        retry: true,
        back_off_function: function () { return 0; }
      });

      var paused = 0;
      var error;
      rep.on('paused', function (e) {
        ++paused;
        // The first paused event is the replication up to date
        // and waiting on changes (no error)
        try {
          should.not.exist(e);
        } catch (err) {
          error = err;
          rep.cancel();
        }
        if (paused === 1) {
          return remote.put({}, 'foo');
        } else {
          rep.cancel();
        }
      });

      var active = 0;
      rep.on('active', function () {
        ++active;
      });

      var numChanges = 0;
      rep.on('change', function () {
        ++numChanges;
      });

      rep.on('complete', function() {
        try {
          active.should.be.within(1, 2);
          paused.should.equal(2);
          numChanges.should.equal(2);
          done(error);
        } catch (err) {
          done(err);
        }
      });

      rep.catch(done);

      remote.put({}, 'hazaa');
    });

    it('source doesn\'t leak "destroyed" event', function () {

      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var Promise = PouchDB.utils.Promise;

      var origGet = remote.get;
      var i = 0;
      remote.get = function (opts) {
        // Reject three times, every 5th time
        if ((++i % 5 === 0) && i <= 15) {
          return Promise.reject(new Error('flunking you'));
        }
        return origGet.apply(remote, arguments);
      };

      var rep = db.replicate.from(remote, {
        live: true,
        retry: true,
        back_off_function: function () { return 0; }
      });

      var numDocsToWrite = 10;

      return remote.post({}).then(function() {
        var originalNumListeners;
        var posted = 0;

        return new Promise(function (resolve, reject) {

          var error;
          function cleanup(err) {
            if (err) {
              error = err;
            }
            rep.cancel();
          }
          function finish() {
            if (error) {
              return reject(error);
            }
            resolve();
          }

          rep.on('complete', finish).on('error', cleanup);
          rep.on('change', function () {
            if (++posted < numDocsToWrite) {
              remote.post({}).catch(cleanup);
            } else {
              db.info().then(function (info) {
                if (info.doc_count === numDocsToWrite) {
                  cleanup();
                }
              }).catch(cleanup);
            }

            try {
              var numListeners = db.listeners('destroyed').length;
              if (typeof originalNumListeners !== 'number') {
                originalNumListeners = numListeners;
              } else {
                numListeners.should.equal(originalNumListeners,
                  'numListeners should never increase');
              }
            } catch (err) {
              cleanup(err);
            }
          });
        });
      });
    });

    it('target doesn\'t leak "destroyed" event', function () {

      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var Promise = PouchDB.utils.Promise;

      var origGet = remote.get;
      var i = 0;
      remote.get = function (opts) {
        // Reject three times, every 5th time
        if ((++i % 5 === 0) && i <= 15) {
          return Promise.reject(new Error('flunking you'));
        }
        return origGet.apply(remote, arguments);
      };

      var rep = db.replicate.from(remote, {
        live: true,
        retry: true,
        back_off_function: function () { return 0; }
      });

      var numDocsToWrite = 10;

      return remote.post({}).then(function() {
        var originalNumListeners;
        var posted = 0;

        return new Promise(function (resolve, reject) {

          var error;
          function cleanup(err) {
            if (err) {
              error = err;
            }
            rep.cancel();
          }
          function finish() {
            if (error) {
              return reject(error);
            }
            resolve();
          }

          rep.on('complete', finish).on('error', cleanup);
          rep.on('change', function () {
            if (++posted < numDocsToWrite) {
              remote.post({}).catch(cleanup);
            } else {
              db.info().then(function (info) {
                if (info.doc_count === numDocsToWrite) {
                  cleanup();
                }
              }).catch(cleanup);
            }

            try {
              var numListeners = remote.listeners('destroyed').length;
              if (typeof originalNumListeners !== 'number') {
                originalNumListeners = numListeners;
              } else {
                // special case for "destroy" - because there are
                // two Changes() objects for local databases,
                // there can briefly be one extra listener or one
                // fewer listener. The point of this test is to ensure
                // that the listeners don't grow out of control.
                numListeners.should.be.within(
                  originalNumListeners - 1,
                  originalNumListeners + 1,
                  'numListeners should never increase by +1/-1');
              }
            } catch (err) {
              cleanup(err);
            }
          });
        });
      });
    });

    [
      'complete', 'error', 'paused', 'active',
      'change', 'cancel'
    ].forEach(function (event) {
      it('returnValue doesn\'t leak "' + event + '" event', function () {

        var db = new PouchDB(dbs.name);
        var remote = new PouchDB(dbs.remote);
        var Promise = PouchDB.utils.Promise;

        var origGet = remote.get;
        var i = 0;
        remote.get = function (opts) {
          // Reject three times, every 5th time
          if ((++i % 5 === 0) && i <= 15) {
            return Promise.reject(new Error('flunking you'));
          }
          return origGet.apply(remote, arguments);
        };

        var rep = db.replicate.from(remote, {
          live: true,
          retry: true,
          back_off_function: function () { return 0; }
        });

        var numDocsToWrite = 10;

        return remote.post({}).then(function() {
          var originalNumListeners;
          var posted = 0;

          return new Promise(function (resolve, reject) {

            var error;
            function cleanup(err) {
              if (err) {
                error = err;
              }
              rep.cancel();
            }
            function finish() {
              if (error) {
                return reject(error);
              }
              resolve();
            }

            rep.on('complete', finish).on('error', cleanup);
            rep.on('change', function () {
              if (++posted < numDocsToWrite) {
                remote.post({}).catch(cleanup);
              } else {
                db.info().then(function (info) {
                  if (info.doc_count === numDocsToWrite) {
                    cleanup();
                  }
                }).catch(cleanup);
              }

              try {
                var numListeners = rep.listeners(event).length;
                if (typeof originalNumListeners !== 'number') {
                  originalNumListeners = numListeners;
                } else {
                  numListeners.should.equal(originalNumListeners,
                    'numListeners should never increase');
                }
              } catch (err) {
                cleanup(err);
              }
            });
          });
        });
      });
    });

    it('returnValue doesn\'t leak "change" event w/ onChange', function () {

      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var Promise = PouchDB.utils.Promise;

      var origGet = remote.get;
      var i = 0;
      remote.get = function (opts) {
        // Reject three times, every 5th time
        if ((++i % 5 === 0) && i <= 15) {
          return Promise.reject(new Error('flunking you'));
        }
        return origGet.apply(remote, arguments);
      };

      var rep = db.replicate.from(remote, {
        live: true,
        retry: true,
        back_off_function: function () { return 0; }
      }).on('change', function () {});

      var numDocsToWrite = 10;

      return remote.post({}).then(function() {
        var originalNumListeners;
        var posted = 0;

        return new Promise(function (resolve, reject) {

          var error;
          function cleanup(err) {
            if (err) {
              error = err;
            }
            rep.cancel();
          }
          function finish() {
            if (error) {
              return reject(error);
            }
            resolve();
          }

          rep.on('complete', finish).on('error', cleanup);
          rep.on('change', function () {
            if (++posted < numDocsToWrite) {
              remote.post({}).catch(cleanup);
            } else {
              db.info().then(function (info) {
                if (info.doc_count === numDocsToWrite) {
                  cleanup();
                }
              }).catch(cleanup);
            }

            try {
              var numListeners = rep.listeners('change').length;
              if (typeof originalNumListeners !== 'number') {
                originalNumListeners = numListeners;
              } else {
                numListeners.should.equal(originalNumListeners,
                  'numListeners should never increase');
              }
            } catch (err) {
              cleanup(err);
            }
          });
        });
      });
    });

    it('retry many times, no leaks on any events', function () {
      this.timeout(200000);
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var Promise = PouchDB.utils.Promise;

      var flunked = 0;
      var origGet = remote.get;
      var i = 0;
      remote.get = function (opts) {
        // Reject five times, every 5th time
        if ((++i % 5 === 0) && i <= 25) {
          flunked++;
          return Promise.reject(new Error('flunking you'));
        }
        return origGet.apply(remote, arguments);
      };

      var rep = db.replicate.from(remote, {
        live: true,
        retry: true,
        back_off_function: function () { return 0; }
      });

      var active = 0;
      var paused = 0;
      var numDocsToWrite = 50;

      return remote.post({}).then(function() {
        var originalNumListeners;
        var posted = 0;

        return new Promise(function (resolve, reject) {

          var error;
          function cleanup(err) {
            if (err) {
              error = err;
            }
            rep.cancel();
          }
          function finish() {
            if (error) {
              return reject(error);
            }
            resolve();
          }
          function getTotalListeners() {
            var events = ['complete', 'error', 'paused', 'active',
              'change', 'cancel'];
            return events.map(function (event) {
              return rep.listeners(event).length;
            }).reduce(function (a, b) {return a + b; }, 0);
          }

          rep.on('complete', finish)
            .on('error', cleanup)
            .on('active', function () {
            active++;
          }).on('paused', function () {
            paused++;
          }).on('change', function () {
            if (++posted < numDocsToWrite) {
              remote.post({}).catch(cleanup);
            } else {
              db.info().then(function (info) {
                if (info.doc_count === numDocsToWrite) {
                  cleanup();
                }
              }).catch(cleanup);
            }

            try {
              var numListeners = getTotalListeners();
              if (typeof originalNumListeners !== 'number') {
                originalNumListeners = numListeners;
              } else {
                numListeners.should.equal(originalNumListeners,
                  'numListeners should never increase');
              }
            } catch (err) {
              cleanup(err);
            }
          });
        });
      }).then(function () {
        flunked.should.equal(5);
        active.should.be.at.least(5);
        paused.should.be.at.least(5);
      });
    });


    it('4049 retry while starting offline', function (done) {

      var ajax = PouchDB.utils.ajax;
      var _called = 0;
      var startFailing = false;

      PouchDB.utils.ajax = function (opts, cb) {
        if (!startFailing || ++_called > 3) {
          ajax.apply(this, arguments);
        } else {
          cb(new Error('flunking you'));
        }
      };

      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);

      remote.post({a: 'doc'}).then(function(doc) {
        startFailing = true;
        var rep = db.replicate.from(remote, {live: true, retry: true})
          .on('change', function() { rep.cancel(); });

        rep.on('complete', function() {
          PouchDB.utils.ajax = ajax;
          done();
        });
      });

    });

  });
});
