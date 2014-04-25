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
  describe('test.sync.js-' + adapters[0] + '-' + adapters[1], function () {

    var dbs = {};

    beforeEach(function (done) {
      dbs.name = testUtils.adapterUrl(adapters[0], 'test_repl');
      dbs.remote = testUtils.adapterUrl(adapters[1], 'test_repl_remote');
      testUtils.cleanup([dbs.name, dbs.remote], done);
    });

    after(function (done) {
      testUtils.cleanup([dbs.name, dbs.remote], done);
    });

    it('PouchDB.sync event', function (done) {
      var doc1 = {
          _id: 'adoc',
          foo: 'bar'
        };
      var doc2 = {
          _id: 'anotherdoc',
          foo: 'baz'
        };
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      db.put(doc1, function (err) {
        remote.put(doc2, function (err) {
          PouchDB.sync(db, remote).on('complete', function (result) {
            result.pull.ok.should.equal(true);
            result.pull.docs_read.should.equal(1);
            result.pull.docs_written.should.equal(1);
            result.pull.errors.should.have.length(0);
            done();
          });
        });
      });
    });

    it('PouchDB.sync callback', function (done) {
      var doc1 = {
          _id: 'adoc',
          foo: 'bar'
        };
      var doc2 = {
          _id: 'anotherdoc',
          foo: 'baz'
        };
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      db.put(doc1, function (err) {
        remote.put(doc2, function (err) {
          PouchDB.sync(db, remote, function (err, result) {
            result.pull.ok.should.equal(true);
            result.pull.docs_read.should.equal(1);
            result.pull.docs_written.should.equal(1);
            result.pull.errors.should.have.length(0);
            done();
          });
        });
      });
    });

    it('PouchDB.sync promise', function (done) {
      var doc1 = {
          _id: 'adoc',
          foo: 'bar'
        };
      var doc2 = {
          _id: 'anotherdoc',
          foo: 'baz'
        };
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      db.put(doc1).then(function () {
        return remote.put(doc2);
      }).then(function () {
        return PouchDB.sync(db, remote);
      }).then(function (result) {
        result.pull.ok.should.equal(true);
        result.pull.docs_read.should.equal(1);
        result.pull.docs_written.should.equal(1);
        result.pull.errors.should.have.length(0);
        done();
      }, done);
    });

    it('db.sync event', function (done) {
      var doc1 = {
          _id: 'adoc',
          foo: 'bar'
        };
      var doc2 = {
          _id: 'anotherdoc',
          foo: 'baz'
        };
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      db.put(doc1, function (err) {
        remote.put(doc2, function (err) {
          db.sync(remote).on('complete', function (result) {
            result.pull.ok.should.equal(true);
            result.pull.docs_read.should.equal(1);
            result.pull.docs_written.should.equal(1);
            result.pull.errors.should.have.length(0);
            done();
          });
        });
      });
    });

    it('db.sync callback', function (done) {
      var doc1 = {
          _id: 'adoc',
          foo: 'bar'
        };
      var doc2 = {
          _id: 'anotherdoc',
          foo: 'baz'
        };
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      db.put(doc1, function (err) {
        remote.put(doc2, function (err) {
          db.sync(remote, function (err, result) {
            result.pull.ok.should.equal(true);
            result.pull.docs_read.should.equal(1);
            result.pull.docs_written.should.equal(1);
            result.pull.errors.should.have.length(0);
            done();
          });
        });
      });
    });

    it('db.sync promise', function (done) {
      var doc1 = {
          _id: 'adoc',
          foo: 'bar'
        };
      var doc2 = {
          _id: 'anotherdoc',
          foo: 'baz'
        };
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      db.put(doc1).then(function () {
        return remote.put(doc2);
      }).then(function () {
        return db.sync(remote);
      }).then(function (result) {
        result.pull.ok.should.equal(true);
        result.pull.docs_read.should.equal(1);
        result.pull.docs_written.should.equal(1);
        result.pull.errors.should.have.length(0);
        done();
      }, done);
    });

    // Skipped due to https://github.com/daleharvey/pouchdb/issues/1409
    // This will only call once in the case of being cancelled before starting
    // but will call twice when cancelled after starting
    it('Test sync cancel', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var replications = db.sync(remote, {
        complete: function (err, result) {
          done();
        }
      });
      should.exist(replications);
      replications.cancel();
      return;
    });

    it('Test syncing two endpoints (issue 838)', function (done) {
      var doc1 = {
          _id: 'adoc',
          foo: 'bar'
        };
      var doc2 = {
          _id: 'anotherdoc',
          foo: 'baz'
        };
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      // Replication isn't finished until onComplete has been called twice
      function onComplete() {
        db.allDocs(function (err, res1) {
          should.not.exist(err);
          remote.allDocs(function (err, res2) {
            should.not.exist(err);
            res1.total_rows.should.equal(res2.total_rows);
            done();
          });
        });
      }
      db.put(doc1, function (err) {
        remote.put(doc2, function (err) {
          db.replicate.sync(remote).on('complete', onComplete);
        });
      });
    });

    it('Syncing should stop if one replication fails (issue 838)',
      function (done) {
      var doc1 = {_id: 'adoc', foo: 'bar'};
      var doc2 = {_id: 'anotherdoc', foo: 'baz'};

      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var replications = db.sync(remote, {
        live: true,
        complete: function () {
          done();
        }
      });
      db.on('change', function (ch) {
        if (ch.seq !== 1) {
          done(true);
        }
      });
      replications.then(null, function () {
        done();
      });
      var changes = 0;
      replications.on('change', function (ch) {
        changes++;
        if (changes === 2) {
          replications.pull.emit('error');
          remote.put(doc2);
        } else if (changes > 2) {
          done(true);
        }
      });
      db.put(doc1);
    });
  });
});
