'use strict';

var adapters = [
  ['local', 'http'],
  ['http', 'http'],
  ['http', 'local'],
  ['local', 'local']
];

adapters.forEach(function (adapters) {
  describe('test.sync.js-' + adapters[0] + '-' + adapters[1], function () {

    var dbs = {};

    beforeEach(function (done) {
      dbs.name = testUtils.adapterUrl(adapters[0], 'test_repl');
      dbs.remote = testUtils.adapterUrl(adapters[1], 'test_repl_remote');
      testUtils.cleanup([dbs.name, dbs.remote], done);
    });

    afterEach(function (done) {
      testUtils.cleanup([dbs.name, dbs.remote], done);
    });

    it('PouchDB.sync 1', function (done) {
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
          var push_done = false;
          var pull_done = false;
          PouchDB.sync(db, remote, {
            complete: function (err, result) {
              should.not.exist(err);
              should.exist(result);
              result.ok.should.equal(true);
              result.docs_read.should.equal(1);
              result.docs_written.should.equal(1);
              result.errors.should.have.length(0);
              should.exist(result.direction);
              result.direction.should.match(/^(push|pull)$/);
              if (result.direction === 'push') {
                push_done = true;
                if (pull_done) {
                  done();
                }
              } else if (result.direction === 'pull') {
                pull_done = true;
                if (push_done) {
                  done();
                }
              }
            }
          });
        });
      });
    });

    it('PouchDB.sync 2', function (done) {
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
          var push_done = false;
          var pull_done = false;
          PouchDB.sync(db, remote, {}, function (err, result) {
            should.not.exist(err);
            should.exist(result);
            result.ok.should.equal(true);
            result.docs_read.should.equal(1);
            result.docs_written.should.equal(1);
            result.errors.should.have.length(0);
            should.exist(result.direction);
            result.direction.should.match(/^(push|pull)$/);
            if (result.direction === 'push') {
              push_done = true;
              if (pull_done) {
                done();
              }
            } else if (result.direction === 'pull') {
              pull_done = true;
              if (push_done) {
                done();
              }
            }
          });
        });
      });
    });

    it('db.sync 1', function (done) {
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
          var push_done = false;
          var pull_done = false;
          db.replicate.sync(remote, {
            complete: function (err, result) {
              should.not.exist(err);
              should.exist(result);
              result.ok.should.equal(true);
              result.docs_read.should.equal(1);
              result.docs_written.should.equal(1);
              result.errors.should.have.length(0);
              should.exist(result.direction);
              result.direction.should.match(/^(push|pull)$/);
              if (result.direction === 'push') {
                push_done = true;
                if (pull_done) {
                  done();
                }
              } else if (result.direction === 'pull') {
                pull_done = true;
                if (push_done) {
                  done();
                }
              }
            }
          });
        });
      });
    });

    it('db.sync 2', function (done) {
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
          var push_done = false;
          var pull_done = false;
          db.replicate.sync(remote, {}, function (err, result) {
            should.not.exist(err);
            should.exist(result);
            result.ok.should.equal(true);
            result.docs_read.should.equal(1);
            result.docs_written.should.equal(1);
            result.errors.should.have.length(0);
            should.exist(result.direction);
            result.direction.should.match(/^(push|pull)$/);
            if (result.direction === 'push') {
              push_done = true;
              if (pull_done) {
                done();
              }
            } else if (result.direction === 'pull') {
              pull_done = true;
              if (push_done) {
                done();
              }
            }
          });
        });
      });
    });

    // Skipped due to https://github.com/daleharvey/pouchdb/issues/1409
    // This will only call once in the case of being cancelled before starting
    // but will call twice when cancelled after starting
    it.skip('Test sync cancel', function (done) {
      var completed = 0;
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var replications = db.replicate.sync(remote, {
        complete: function (err, result) {
          completed++;
          // sync calls complete twice: once for each replicate
          if (completed === 2) {
            done();
          }
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
      var completed = 0;
      function onComplete() {
        completed++;
        if (completed < 2) {
          return;
        }
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
          db.replicate.sync(remote, { complete: onComplete });
        });
      });
    });

    it('Syncing should stop if one replication fails (issue 838)', function (done) {
      var doc1 = {_id: 'adoc', foo: 'bar'};
      var doc2 = {_id: 'anotherdoc', foo: 'baz'};

      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var changes = db.changes;
      db.changes = function (opts) {
        var err = {
          status: 500,
          error: 'mock error',
          reason: 'mock changes failure'
        };
        opts.complete(err, null);
      };
      function check_results() {
        db.allDocs(function (err, res) {
          res.total_rows.should.be.below(2, 'db replication halted');
          db.changes = changes;
          done();
        });
      }
      var replications_completed = 0;
      var put_completed = 0;
      var replications = db.replicate.sync(remote, {
        live: true,
        complete: function () {
          replications_completed++;
          if (replications_completed < 2 || put_completed === 0) {
            return;
          }
          check_results();
        }
      });
      db.put(doc1, function (err) {
        remote.put(doc2, function (err) {
          put_completed = 1;
          if (replications_completed < 2) {
            replications.cancel();
            return;
          }
          check_results();
        });
      });
    });
  });
});
