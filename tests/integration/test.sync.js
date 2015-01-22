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
      dbs.name = testUtils.adapterUrl(adapters[0], 'testdb');
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
      var replications = db.sync(remote, {live: true});

      replications.on('complete', function () {
        remote.put(doc2, function () {
          changes.should.equal(2);
          done();
        });
      });

      var changes = 0;
      replications.on('change', function (ch) {
        changes++;
        if (changes === 2) {
          replications.pull.cancel();
        }
      });
      db.put(doc1);
    });

    it('Push and pull changes both fire (issue 2555)', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var correct = false;
      db.post({}).then(function () {
        return remote.post({});
      }).then(function () {
        var numChanges = 0;
        var lastChange;
        var sync = db.sync(remote);
        sync.on('change', function (change) {
          ['push', 'pull'].should.contain(change.direction);
          change.change.docs_read.should.equal(1);
          change.change.docs_written.should.equal(1);
          if (!lastChange) {
            lastChange = change.direction;
          } else {
            lastChange.should.not.equal(change.direction);
          }
          if (++numChanges === 2) {
            correct = true;
            sync.cancel();
          }
        }).on('complete', function () {
          correct.should.equal(true, 'things happened right');
          done();
        });
      });
    });

    it('Doesn\'t have a memory leak (push)', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);

      db.bulkDocs([{}, {}, {}]).then(function () {
        return remote.bulkDocs([{}, {}, {}]);
      }).then(function () {
        var sync = db.replicate.to(remote);
        sync.on('change', function () {});
        sync.on('error', function () {});
        sync.on('complete', function () {
          setTimeout(function () {
            Object.keys(sync._events).should.have.length(0);
            done();
          });
        });
      });
    });

    it('Doesn\'t have a memory leak (pull)', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);

      db.bulkDocs([{}, {}, {}]).then(function () {
        return remote.bulkDocs([{}, {}, {}]);
      }).then(function () {
        var sync = db.replicate.from(remote);
        sync.on('change', function () {});
        sync.on('error', function () {});
        sync.on('complete', function () {
          setTimeout(function () {
            Object.keys(sync._events).should.have.length(0);
            done();
          });
        });
      });
    });

    it('Doesn\'t have a memory leak (bi)', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);

      db.bulkDocs([{}, {}, {}]).then(function () {
        return remote.bulkDocs([{}, {}, {}]);
      }).then(function () {
        var sync = db.sync(remote);
        sync.on('change', function () {});
        sync.on('error', function () {});
        sync.on('complete', function () {
          setTimeout(function () {
            Object.keys(sync._events).should.have.length(0);
            done();
          });
        });
      });
    });
    it('PouchDB.sync with strings for dbs', function (done) {
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
        return PouchDB.sync(dbs.name, dbs.remote);
      }).then(function (result) {
        result.pull.ok.should.equal(true);
        result.pull.docs_read.should.equal(1);
        result.pull.docs_written.should.equal(1);
        result.pull.errors.should.have.length(0);
        done();
      }, done);
    });

    it('#3270 triggers "denied" events',
        function (done) {
      testUtils.isCouchDB(function (isCouchDB) {
        if (/*adapters[1] !== 'http' || */!isCouchDB) {
          return done();
        }
        if (adapters[0] !== 'local' || adapters[1] !== 'http') {
          return done();
        }

        var deniedErrors = [];
        var ddoc = {
          "_id": "_design/validate",
          "validate_doc_update": function (newDoc) {
            if (newDoc.foo) {
              throw { unauthorized: 'go away, no picture' };
            }
          }.toString()
        };

        var remote = new PouchDB(dbs.remote);
        var db = new PouchDB(dbs.name);

        return remote.put(ddoc).then(function () {
          var docs = [
            {_id: 'foo1', foo: 'string'},
            {_id: 'nofoo'},
            {_id: 'foo2', foo: 'object'}
          ];
          return db.bulkDocs({docs: docs});
        }).then(function () {
          var sync = db.sync(dbs.remote);
          sync.on('denied', function(error) {
            deniedErrors.push(error);
          });
          return sync;
        }).then(function (res) {
          deniedErrors.length.should.equal(2);
          deniedErrors[0].doc.id.should.equal('foo1');
          deniedErrors[0].doc.name.should.equal('unauthorized');
          deniedErrors[1].doc.id.should.equal('foo2');
          deniedErrors[1].doc.name.should.equal('unauthorized');
          deniedErrors[0].direction.should.equal('push');
        })
        .then(done, done);
      });
    });

    it('#3270 triggers "change" events with .docs property', function(done) {
      var syncedDocs = [];
      var db = new PouchDB(dbs.name);
      var docs = [
        {_id: '1'},
        {_id: '2'},
        {_id: '3'}
      ];

      db.bulkDocs({ docs: docs }, {})
      .then(function(results) {
        var sync = db.sync(dbs.remote);
        sync.on('change', function(change) {
          syncedDocs = syncedDocs.concat(change.change.docs);
        });
        return sync;
      })
      .then(function() {
        syncedDocs.sort(function (a, b) {
          return a._id > b._id ? 1 : -1;
        });

        syncedDocs.length.should.equal(3);
        syncedDocs[0]._id.should.equal('1');
        syncedDocs[1]._id.should.equal('2');
        syncedDocs[2]._id.should.equal('3');
        done();
      })
      .catch(done);
    });
  });
});
