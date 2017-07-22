'use strict';

var adapters = [
  ['local', 'http'],
  ['http', 'local'],
  ['local', 'local']
];

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
      db.put(doc1, function () {
        remote.put(doc2, function () {
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

    it('sync throws errors in promise', function () {
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

      // intentionally throw an error during replication
      remote.allDocs = function () {
        return testUtils.Promise.reject(new Error('flunking you'));
      };

      return db.put(doc1).then(function () {
        return remote.put(doc2);
      }).then(function () {
        return db.sync(remote);
      }).then(function () {
        throw new Error('expected an error');
      }, function (err) {
        should.exist(err);
        err.should.be.instanceof(Error);
      });
    });

    it('sync throws errors in promise catch()', function () {
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

      // intentionally throw an error during replication
      remote.allDocs = function () {
        return testUtils.Promise.reject(new Error('flunking you'));
      };

      var landedInCatch = false;
      return db.put(doc1).then(function () {
        return remote.put(doc2);
      }).then(function () {
        return db.sync(remote).catch(function (err) {
          landedInCatch = true;
          should.exist(err);
          err.should.be.instanceof(Error);
        });
      }).then(function () {
        if (!landedInCatch) {
          throw new Error('expected catch(), not then()');
        }
      });
    });

    it('sync throws errors in error listener', function () {
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

      // intentionally throw an error during replication
      remote.allDocs = function () {
        return testUtils.Promise.reject(new Error('flunking you'));
      };

      return db.put(doc1).then(function () {
        return remote.put(doc2);
      }).then(function () {
        return new testUtils.Promise(function (resolve) {
          db.sync(remote).on('error', resolve);
        });
      }).then(function (err) {
        should.exist(err);
        err.should.be.instanceof(Error);
      });
    });

    it('sync throws errors in callback', function () {
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

      // intentionally throw an error during replication
      remote.allDocs = function () {
        return testUtils.Promise.reject(new Error('flunking you'));
      };

      return db.put(doc1).then(function () {
        return remote.put(doc2);
      }).then(function () {
        return new testUtils.Promise(function (resolve) {
          db.sync(remote, function (err) {
            resolve(err);
          }).catch(function () {
            // avoid annoying chrome warning about uncaught (in promise)
          });
        });
      }).then(function (err) {
        should.exist(err);
        err.should.be.instanceof(Error);
      });
    });

    it('sync returns result in callback', function () {
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

      return db.put(doc1).then(function () {
        return remote.put(doc2);
      }).then(function () {
        return new testUtils.Promise(function (resolve, reject) {
          db.sync(remote, function (err, res) {
            if (err) {
              return reject(err);
            }
            resolve(res);
          });
        });
      }).then(function (res) {
        should.exist(res);
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
      db.put(doc1, function () {
        remote.put(doc2, function () {
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
      db.put(doc1, function () {
        remote.put(doc2, function () {
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
      db.put(doc1, function () {
        remote.put(doc2, function () {
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

    it.skip('Test sync cancel', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var replications = db.sync(remote).on('complete', function () {
        done();
      });
      should.exist(replications);
      replications.cancel();
    });

    it.skip('Test sync cancel called twice', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var replications = db.sync(remote).on('complete', function () {
        setTimeout(done); // let cancel() get called twice before finishing
      });
      should.exist(replications);
      replications.cancel();
      replications.cancel();
    });

    it('Test syncing two endpoints (issue 838)', function () {
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
      return db.put(doc1).then(function () {
        return remote.put(doc2);
      }).then(function () {
        return new testUtils.Promise(function (resolve, reject) {
          db.sync(remote).on('complete', resolve).on('error', reject);
        });
      }).then(function () {
        // Replication isn't finished until onComplete has been called twice
        return db.allDocs().then(function (res1) {
          return remote.allDocs().then(function (res2) {
            res1.total_rows.should.equal(res2.total_rows);
          });
        });
      });
    });

    it.skip('3894 re-sync after immediate cancel', function () {

      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);

      db.setMaxListeners(100);
      remote.setMaxListeners(100);

      var promise = testUtils.Promise.resolve();

      function syncThenCancel() {
        promise = promise.then(function () {
          return new testUtils.Promise(function (resolve, reject) {
            db = new PouchDB(dbs.name);
            remote = new PouchDB(dbs.remote);
            var sync = db.sync(remote)
              .on('error', reject)
              .on('complete', resolve);
            sync.cancel();
          }).then(function () {
            return testUtils.Promise.all([
              db.destroy(),
              remote.destroy()
            ]);
          });
        });
      }

      for (var i = 0; i < 5; i++) {
        syncThenCancel();
      }

      return promise;
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
          changes.should.equal(1);
          done();
        });
      });

      var changes = 0;
      replications.on('change', function () {
        changes++;
        if (changes === 1) {
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

    it('Change event should be called exactly once per listener (issue 5479)', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      db.post({}).then(function () {
        var counter = 0;
        var sync = db.sync(remote);
        var increaseCounter = function () {
          counter++;
        };
        sync.on('change', increaseCounter)
            .on('change', increaseCounter)
            .on('complete', function () {
              counter.should.equal(2);
              done();
            });
      });
    });

    it('Remove an event listener', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);

      db.bulkDocs([{}, {}, {}]).then(function () {
        return remote.bulkDocs([{}, {}, {}]);
      }).then(function () {

        function changesCallback() {
          changeCalled = true;
        }

        var sync = db.replicate.to(remote);
        var changeCalled = false;
        sync.on('change', changesCallback);
        sync.removeListener('change', changesCallback);
        sync.on('error', function () {});
        sync.on('complete', function () {
          setTimeout(function () {
            Object.keys(sync._events).should.have.length(0);
            changeCalled.should.equal(false);
            done();
          });
        });
      });
    });

    it('Remove an invalid event listener', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);

      db.bulkDocs([{}, {}, {}]).then(function () {
        return remote.bulkDocs([{}, {}, {}]);
      }).then(function () {
        function otherCallback() {}
        function realCallback() {
          changeCalled = true;
        }
        var sync = db.replicate.to(remote);
        var changeCalled = false;
        sync.on('change', realCallback);
        sync.removeListener('change', otherCallback);
        sync.on('error', function () {});
        sync.on('complete', function () {
          setTimeout(function () {
            Object.keys(sync._events).should.have.length(0);
            changeCalled.should.equal(true);
            done();
          });
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
          sync.on('denied', function (error) {
            deniedErrors.push(error);
          });
          return sync;
        }).then(function () {
          deniedErrors.length.should.equal(2);
          deniedErrors[0].doc.name.should.equal('unauthorized');
          deniedErrors[1].doc.name.should.equal('unauthorized');
          deniedErrors[0].direction.should.equal('push');
        })
        .then(done, done);
      });
    });

    it('#3270 triggers "denied" events, reverse direction',
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
            var sync = remote.sync(db);
            sync.on('denied', function (error) {
              deniedErrors.push(error);
            });
            return sync;
          }).then(function () {
            deniedErrors.length.should.equal(2);
            deniedErrors[0].doc.name.should.equal('unauthorized');
            deniedErrors[1].doc.name.should.equal('unauthorized');
            deniedErrors[0].direction.should.equal('pull');
          })
            .then(done, done);
        });
      });

    it('#3270 triggers "change" events with .docs property', function (done) {
      var syncedDocs = [];
      var db = new PouchDB(dbs.name);
      var docs = [
        {_id: '1'},
        {_id: '2'},
        {_id: '3'}
      ];

      db.bulkDocs({ docs: docs }, {}).then(function () {
        var sync = db.sync(dbs.remote);
        sync.on('change', function (change) {
          syncedDocs = syncedDocs.concat(change.change.docs);
        });
        return sync;
      })
      .then(function () {
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

    it('4791 Single filter', function () {

      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);

      var localDocs = [{_id: '0'}, {_id: '1'}];
      var remoteDocs = [{_id: 'a'}, {_id: 'b'}];

      return remote.bulkDocs(remoteDocs).then(function () {
        return db.bulkDocs(localDocs);
      }).then(function () {
        return db.sync(remote, {
          filter: function (doc) { return doc._id !== '0' && doc._id !== 'a'; }
        });
      }).then(function () {
        return db.allDocs();
      }).then(function (docs) {
        docs.total_rows.should.equal(3);
        return remote.allDocs();
      }).then(function (docs) {
        docs.total_rows.should.equal(3);
      });
    });


    it('4791 Single filter, live/retry', function () {

      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);

      var localDocs = [{_id: '0'}, {_id: '1'}];
      var remoteDocs = [{_id: 'a'}, {_id: 'b'}];

      return remote.bulkDocs(remoteDocs).then(function () {
        return db.bulkDocs(localDocs);
      }).then(function () {
        return new testUtils.Promise(function (resolve, reject) {
          var filter = function (doc) {
            return doc._id !== '0' && doc._id !== 'a';
          };
          var changes = 0;
          var onChange = function (c) {
            changes += c.change.docs.length;
            if (changes === 2) {
              sync.cancel();
            }
          };
          var sync = db.sync(remote, {filter: filter, live: true, retry: true})
            .on('error', reject)
            .on('change', onChange)
            .on('complete', resolve);
        });
      }).then(function () {
        return db.allDocs();
      }).then(function (docs) {
        docs.total_rows.should.equal(3);
        return remote.allDocs();
      }).then(function (docs) {
        docs.total_rows.should.equal(3);
      });
    });

    it('4289 Separate to / from filters', function () {

      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);

      var localDocs = [{_id: '0'}, {_id: '1'}];
      var remoteDocs = [{_id: 'a'}, {_id: 'b'}];

      return remote.bulkDocs(remoteDocs).then(function () {
        return db.bulkDocs(localDocs);
      }).then(function () {
        return db.sync(remote, {
          push: {filter: function (doc) { return doc._id === '0'; }},
          pull: {filter: function (doc) { return doc._id === 'a'; }}
        });
      }).then(function () {
        return db.allDocs();
      }).then(function (docs) {
        docs.total_rows.should.equal(3);
        return remote.allDocs();
      }).then(function (docs) {
        docs.total_rows.should.equal(3);
      });
    });

    it('5007 sync 2 databases', function (done) {

      var db = new PouchDB(dbs.name);

      var remote1 = new PouchDB(dbs.remote);
      var remote2 = new PouchDB(dbs.remote + '_2');

      var sync1 = db.sync(remote1, {live: true});
      var sync2 = db.sync(remote2, {live: true});

      var numChanges = 0;
      function onChange() {
        if (++numChanges === 2) {
          complete();
        }
      }

      var changes1 = remote1.changes({live: true}).on('change', onChange);
      var changes2 = remote2.changes({live: true}).on('change', onChange);

      db.post({foo: 'bar'});

      var toCancel = [changes1, changes2, sync1, sync2];
      function complete() {
        if (!toCancel.length) {
          return remote2.destroy().then(function () {
            done();
          });
        }
        var cancelling = toCancel.shift();
        cancelling.on('complete', complete);
        cancelling.cancel();
      }
    });

    it('5782 sync rev-1 conflicts', function () {
      var local = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);

      function update(a, id) {
        return a.get(id).then(function (doc) {
          doc.updated = Date.now();
          return a.put(doc);
        });
      }

      function remove(a, id) {
        return a.get(id).then(function (doc) {
          return a.remove(doc);
        });
      }

      function conflict(docTemplate) {
        return local.put(docTemplate).then(function () {
          docTemplate.baz = 'fubar';
          return remote.put(docTemplate);
        });
      }

      var doc1 = {
        _id: 'random-' + Date.now(),
        foo: 'bar'
      };

      var doc2 = {
        _id: 'random2-' + Date.now(),
        foo: 'bar'
      };

      return conflict(doc2)
      .then(function () { return local.replicate.to(remote); })
      .then(function () { return update(local, doc2._id); })
      .then(function () { return remove(local, doc2._id); })
      .then(function () { return local.replicate.to(remote); })
      .then(function () { return conflict(doc1); })
      .then(function () { return update(remote, doc2._id); })
      .then(function () { return local.replicate.to(remote); })
      .then(function () { return remove(local, doc1._id); })
      .then(function () { return local.sync (remote); })
      .then(function () {
        return testUtils.Promise.all([
          local.allDocs({include_docs: true}),
          remote.allDocs({include_docs: true})
        ]);
      }).then(function (res) {
        res[0].should.deep.equal(res[1]);
      });
    });
  });
});
