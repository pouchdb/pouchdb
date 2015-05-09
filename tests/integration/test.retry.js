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
        retry: true
      });

      var paused = 0;
      rep.on('paused', function (e) {
        ++paused;
        // The first paused event is the replication up to date
        // and waiting on changes (no error)
        if (paused === 1) {
          (typeof e).should.equal('undefined');
          return remote.put({}, 'foo').then(function () {
            return remote.put({}, 'bar');
          });
        }
        // Second paused event is due to failed writes, should
        // have an error
        if (paused === 2) {
          e.should.exist();
        }
      });

      var active = 0;
      rep.on('active', function () {
        ++active;
      });

      rep.on('complete', function () {
        active.should.equal(4);
        paused.should.be.at.least(3);
        done();
      });

      rep.catch(done);

      var numChanges = 0;
      rep.on('change', function () {
        if (++numChanges === 3) {
          rep.cancel();
        }
      });

      remote.put({}, 'hazaa');
    });

    it.skip('leaky replication, using allDocs()', function (done) {

      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var Promise = PouchDB.utils.Promise;

      var allDocs = remote.allDocs;

      // Reject attempting to write 'foo' once,
      // then let it succeed, repeat
      var i = 0;
      remote.allDocs = function (opts) {
        if ((++i % 2) !== 0) {
          return Promise.reject(new Error('flunking you'));
        }
        return allDocs.apply(remote, arguments);
      };

      var rep = db.replicate.from(remote, {
        live: true,
        retry: true
      });

      var posted = 0;
      var paused = 0;
      rep.on('paused', function (e) {
        if (++posted < 10) {
          remote.post({});
        }
        ++paused;
      });

      var active = 0;
      rep.on('active', function () {
        ++active;
      });

      rep.on('complete', function () {
        active.should.be.at.least(7);
        paused.should.be.at.least(6);
        db.info(function (err, res) {
          if (err) {
            return done(err);
          }
          res.doc_count.should.equal(10);
          done();
        });
      });

      rep.catch(done);

      var numChanges = 0;
      rep.on('change', function () {
        if (++numChanges === 10) {
          rep.cancel();
        }
      });

      remote.post({});
    });

    it('returnValue doesn\'t leak', function (done) {

      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var Promise = PouchDB.utils.Promise;

      var origGet = remote.get;
      var i = 0;
      remote.get = function (opts) {
        // Reject get() every 5 times
        if ((++i % 5) === 0) {
          return Promise.reject(new Error('flunking you'));
        }
        return origGet.apply(remote, arguments);
      };

      var rep = db.replicate.from(remote, {
        live: true,
        retry: true
      });

      var numDocsToWrite = 10;

      var called = false;
      rep.on('complete', function () {
        if (!called) {
          called = true;
          done();
        }
      }).on('error', done);

      function checkDone() {
        db.info().then(function (info) {
          if (info.doc_count === numDocsToWrite) {
            rep.cancel();
          }
        }).catch(done);
      }

      function getNumListeners() {
        var events = [
          'active', 'cancel', 'change',
          'complete', 'error', 'paused'
        ];
        return events.map(function (event) {
          return rep.listeners(event).length;
        }).reduce(function (a, b) { return a + b; }, 0);
      }

      var originalNumListeners;
      var posted = 0;
      rep.on('change', function () {
        if (++posted < numDocsToWrite) {
          remote.post({}).catch(done);
        }
        var numListeners = getNumListeners();
        if (typeof originalNumListeners !== 'number') {
          originalNumListeners = numListeners;
        } else {
          numListeners.should.equal(originalNumListeners,
            'numListeners should never increase');
        }
        checkDone();
      });

      remote.post({}).catch(done);
    });

    it('source doesn\'t leak destroyed', function (done) {

      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var Promise = PouchDB.utils.Promise;

      var origGet = remote.get;
      var i = 0;
      remote.get = function (opts) {
        // Reject get() every 5 times
        if ((++i % 5) === 0) {
          return Promise.reject(new Error('flunking you'));
        }
        return origGet.apply(remote, arguments);
      };

      var rep = db.replicate.from(remote, {
        live: true,
        retry: true
      });

      var numDocsToWrite = 10;

      var called = false;
      rep.on('complete', function () {
        if (!called) {
          called = true;
          done();
        }
      }).on('error', done);

      function checkDone() {
        db.info().then(function (info) {
          if (info.doc_count === numDocsToWrite) {
            rep.cancel();
          }
        }).catch(done);
      }

      var originalNumListeners;
      var posted = 0;
      rep.on('change', function () {
        if (++posted < numDocsToWrite) {
          remote.post({}).catch(done);
        }
        var numListeners = db.listeners('destroyed').length;
        if (typeof originalNumListeners !== 'number') {
          originalNumListeners = numListeners;
        } else {
          numListeners.should.equal(originalNumListeners,
            'numListeners should never increase');
        }
        checkDone();
      });

      remote.post({}).catch(done);
    });

    it('target doesn\'t leak destroyed', function (done) {

      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var Promise = PouchDB.utils.Promise;

      var origGet = remote.get;
      var i = 0;
      remote.get = function (opts) {
        // Reject get() every 5 times
        if ((++i % 5) === 0) {
          return Promise.reject(new Error('flunking you'));
        }
        return origGet.apply(remote, arguments);
      };

      var rep = db.replicate.from(remote, {
        live: true,
        retry: true
      });

      var numDocsToWrite = 10;

      var called = false;
      rep.on('complete', function () {
        if (!called) {
          called = true;
          done();
        }
      }).on('error', done);

      function checkDone() {
        db.info().then(function (info) {
          if (info.doc_count === numDocsToWrite) {
            rep.cancel();
          }
        }).catch(done);
      }

      var originalNumListeners;
      var posted = 0;
      rep.on('change', function () {
        if (++posted < numDocsToWrite) {
          remote.post({}).catch(done);
        }
        var numListeners = remote.listeners('destroyed').length;
        if (typeof originalNumListeners !== 'number') {
          originalNumListeners = numListeners;
        } else {
          numListeners.should.equal(originalNumListeners,
            'numListeners should never increase');
        }
        checkDone();
      });

      remote.post({}).catch(done);
    });

  });
});