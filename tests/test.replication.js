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

var downAdapters = ['local'];

adapters.forEach(function (adapters) {
  describe('test.replication.js-' + adapters[0] + '-' + adapters[1],
    function () {

    var dbs = {};

    beforeEach(function (done) {
      dbs.name = testUtils.adapterUrl(adapters[0], 'test_repl');
      dbs.remote = testUtils.adapterUrl(adapters[1], 'test_repl_remote');
      testUtils.cleanup([dbs.name, dbs.remote], done);
    });

    after(function (done) {
      testUtils.cleanup([dbs.name, dbs.remote], done);
    });


    var docs = [
      {_id: '0', integer: 0, string: '0'},
      {_id: '1', integer: 1, string: '1'},
      {_id: '2', integer: 2, string: '2'}
    ];

    it('Test basic pull replication', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      remote.bulkDocs({ docs: docs }, {}, function (err, results) {
        db.replicate.from(dbs.remote, function (err, result) {
          result.ok.should.equal(true);
          result.docs_written.should.equal(docs.length);
          done();
        });
      });
    });

    it('Test basic pull replication plain api', function (done) {
      var remote = new PouchDB(dbs.remote);
      remote.bulkDocs({ docs: docs }, {}, function (err, results) {
        PouchDB.replicate(dbs.remote, dbs.name, {}, function (err, result) {
          result.ok.should.equal(true);
          result.docs_written.should.equal(docs.length);
          done();
        });
      });
    });

    it('Test basic pull replication plain api 2', function (done) {
      var remote = new PouchDB(dbs.remote);
      remote.bulkDocs({ docs: docs }, {}, function (err, results) {
        PouchDB.replicate(dbs.remote, dbs.name, {
          complete: function (err, result) {
            result.ok.should.equal(true);
            result.docs_written.should.equal(docs.length);
            done();
          }
        });
      });
    });

    it('Local DB contains documents', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      remote.bulkDocs({ docs: docs }, {}, function (err, _) {
        db.bulkDocs({ docs: docs }, {}, function (err, _) {
          db.replicate.from(dbs.remote, function (err, _) {
            db.allDocs(function (err, result) {
              result.rows.length.should.equal(docs.length);
              done();
            });
          });
        });
      });
    });

    it('Test basic push replication', function (done) {
      var db = new PouchDB(dbs.name);
      db.bulkDocs({ docs: docs }, {}, function (err, results) {
        db.replicate.to(dbs.remote, function (err, result) {
          result.ok.should.equal(true);
          result.docs_written.should.equal(docs.length);
          done();
        });
      });
    });

    it('Test basic push replication take 2', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      db.bulkDocs({ docs: docs }, {}, function (err, _) {
        db.replicate.to(dbs.remote, function (err, _) {
          remote.allDocs(function (err, result) {
            result.rows.length.should.equal(docs.length);
            done();
          });
        });
      });
    });

    it('Test basic push replication sequence tracking', function (done) {
      var db = new PouchDB(dbs.name);
      var doc1 = {_id: 'adoc', foo: 'bar'};
      db.put(doc1, function (err, result) {
        db.replicate.to(dbs.remote, function (err, result) {
          result.docs_read.should.equal(1);
          db.replicate.to(dbs.remote, function (err, result) {
            result.docs_read.should.equal(0);
            db.replicate.to(dbs.remote, function (err, result) {
              result.docs_read.should.equal(0);
              done();
            });
          });
        });
      });
    });

    it('Test checkpoint', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      remote.bulkDocs({ docs: docs }, {}, function (err, results) {
        db.replicate.from(dbs.remote, function (err, result) {
          result.ok.should.equal(true);
          result.docs_written.should.equal(docs.length);
          db.replicate.from(dbs.remote, function (err, result) {
            result.ok.should.equal(true);
            result.docs_written.should.equal(0);
            result.docs_read.should.equal(0);
            done();
          });
        });
      });
    });

    it('Test live pull checkpoint', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      remote.bulkDocs({ docs: docs }, {}, function (err, results) {
        var changeCount = docs.length;
        var changes = db.changes({
          live: true,
          onChange: function (change) {
            if (--changeCount) {
              return;
            }
            replication.cancel();
            changes.cancel();
          },
          complete: function () {
            db.replicate.from(dbs.remote, {
              complete: function (err, details) {
                details.docs_read.should.equal(0);
                done();
              }
            });
          }
        });
        var replication = db.replicate.from(dbs.remote, { live: true });
      });
    });

    it('Test live push checkpoint', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      db.bulkDocs({ docs: docs }, {}, function (err, results) {
        var changeCount = docs.length;
        var finished = 0;
        var isFinished = function () {
          if (++finished !== 2) {
            return;
          }
          db.replicate.to(dbs.remote, {
            complete: function (err, details) {
              details.docs_read.should.equal(0);
              done();
            }
          });
        };
        var changes = remote.changes({
          live: true,
          onChange: function (change) {
            if (--changeCount) {
              return;
            }
            replication.cancel();
            changes.cancel();
          },
          complete: isFinished
        });
        var replication = db.replicate.to(dbs.remote, {
          live: true,
          complete: isFinished
        });
      });
    });

    it('Test checkpoint 2', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var doc = {_id: '3', count: 0};
      remote.put(doc, {}, function (err, results) {
        db.replicate.from(dbs.remote, function (err, result) {
          result.ok.should.equal(true);
          doc._rev = results.rev;
          doc.count++;
          remote.put(doc, {}, function (err, results) {
            doc._rev = results.rev;
            doc.count++;
            remote.put(doc, {}, function (err, results) {
              db.replicate.from(dbs.remote, function (err, result) {
                result.ok.should.equal(true);
                result.docs_written.should.equal(1);
                done();
              });
            });
          });
        });
      });
    });

    it('Test checkpoint 3 :)', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var doc = {_id: '3', count: 0};
      db.put(doc, {}, function (err, results) {
        PouchDB.replicate(db, remote, {}, function (err, result) {
          result.ok.should.equal(true);
          doc._rev = results.rev;
          doc.count++;
          db.put(doc, {}, function (err, results) {
            doc._rev = results.rev;
            doc.count++;
            db.put(doc, {}, function (err, results) {
              PouchDB.replicate(db, remote, {}, function (err, result) {
                result.ok.should.equal(true);
                result.docs_written.should.equal(1);
                done();
              });
            });
          });
        });
      });
    });

    it('Test checkpoint read only 3 :)', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var put = function (doc) {
        return db.bulkDocs({docs: [doc]}).then(function (resp) {
          return resp[0];
        });
      };
      var err = {
        "message": "_writer access is required for this request",
        "name": "unauthorized",
        "status": 401
      };
      db.put = function () {
        if (typeof arguments[arguments.length - 1] === 'function') {
          arguments[arguments.length - 1](err);
        } else {
          return PouchDB.utils.Promise.reject(err);
        }
      };
      var doc = {_id: '3', count: 0};
      put(doc).then(function (results) {
        return PouchDB.replicate(db, remote).then(function (result) {
          result.ok.should.equal(true);
          doc._rev = results.rev;
          doc.count++;
          return put(doc);
        });
      }).then(function (results) {
        doc._rev = results.rev;
        doc.count++;
        return put(doc);
      }).then(function () {
        return PouchDB.replicate(db, remote);
      }).then(function (result) {
        result.ok.should.equal(true);
        result.docs_written.should.equal(1);
        done();
      }, function (a) {
        done(JSON.stringify(a, false, 4));
      });
    });

    it('Testing allDocs with some conflicts (issue #468)', function (done) {
      var db1 = new PouchDB(dbs.name);
      var db2 = new PouchDB(dbs.remote);
      // we indeed needed replication to create failing test here!
      var doc = {_id: 'foo', _rev: '1-a', value: 'generic'};
      db1.put(doc, { new_edits: false }, function (err, res) {
        db2.put(doc, { new_edits: false }, function (err, res) {
          testUtils.putAfter(db2, {
            _id: 'foo',
            _rev: '2-b',
            value: 'db2'
          }, '1-a', function (err, res) {
            testUtils.putAfter(db1, {
              _id: 'foo',
              _rev: '2-c',
              value: 'whatever'
            }, '1-a', function (err, res) {
              testUtils.putAfter(db1, {
                _id: 'foo',
                _rev: '3-c',
                value: 'db1'
              }, '2-c', function (err, res) {
                db1.get('foo', function (err, doc) {
                  doc.value.should.equal('db1');
                  db2.get('foo', function (err, doc) {
                    doc.value.should.equal('db2');
                    PouchDB.replicate(db1, db2, function () {
                      PouchDB.replicate(db2, db1, function () {
                        db1.get('foo', function (err, doc) {
                          doc.value.should.equal('db1');
                          db2.get('foo', function (err, doc) {
                            doc.value.should.equal('db1');
                            db1.allDocs({ include_docs: true },
                              function (err, res) {
                              res.rows.should.have.length.above(0, 'first');
                              // redundant but we want to test it
                              res.rows[0].doc.value.should.equal('db1');
                              db2.allDocs({ include_docs: true },
                                function (err, res) {
                                res.rows.should.have.length.above(0, 'second');
                                res.rows[0].doc.value.should.equal('db1');
                                done();
                              });
                            });
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });

    // CouchDB will not generate a conflict here, it uses a deteministic
    // method to generate the revision number, however we cannot copy its
    // method as it depends on erlangs internal data representation
    it('Test basic conflict', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var doc1 = {_id: 'adoc', foo: 'bar'};
      var doc2 = {_id: 'adoc', bar: 'baz'};
      db.put(doc1, function (err, localres) {
        remote.put(doc2, function (err, remoteres) {
          db.replicate.to(dbs.remote, function (err, _) {
            remote.get('adoc', { conflicts: true }, function (err, result) {
              result.should.have.property('_conflicts');
              done();
            });
          });
        });
      });
    });

    it('Test _conflicts key', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var doc1 = {_id: 'adoc', foo: 'bar'};
      var doc2 = {_id: 'adoc', bar: 'baz'};
      db.put(doc1, function (err, localres) {
        remote.put(doc2, function (err, remoteres) {
          db.replicate.to(dbs.remote, function (err, _) {
            var queryFun = {
              map: function (doc) {
                if (doc._conflicts) {
                  emit(doc._id, [doc._rev].concat(doc._conflicts));
                }
              }
            };
            remote.query(queryFun, {
              reduce: false,
              conflicts: true
            }, function (_, res) {
              res.rows.length.should.equal(1);
              done();
            });
          });
        });
      });
    });

    it('Test basic live pull replication', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var doc1 = {_id: 'adoc', foo: 'bar'};
      remote.bulkDocs({ docs: docs }, {}, function (err, results) {
        var count = 0;
        var finished = 0;
        var isFinished = function () {
          if (++finished !== 2) {
            return;
          }
          done();
        };
        var rep = db.replicate.from(dbs.remote, {
          live: true,
          complete: isFinished
        });
        var changes = db.changes({
          onChange: function (change) {
            ++count;
            if (count === 3) {
              return remote.put(doc1);
            }
            if (count === 4) {
              rep.cancel();
              changes.cancel();
            }
          },
          live: true,
          complete: isFinished
        });
      });
    });

    it('Test basic live push replication', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var doc1 = {_id: 'adoc', foo: 'bar'};
      db.bulkDocs({ docs: docs }, {}, function (err, results) {
        var count = 0;
        var finished = 0;
        var isFinished = function () {
          if (++finished !== 2) {
            return;
          }
          done();
        };
        var rep = remote.replicate.from(db, {
          live: true,
          complete: isFinished
        });
        var changes = remote.changes({
          onChange: function (change) {
            ++count;
            if (count === 3) {
              return db.put(doc1);
            }
            if (count === 4) {
              rep.cancel();
              changes.cancel();
            }
          },
          live: true,
          complete: isFinished
        });
      });
    });

    it('test-cancel-pull-replication', function (done) {
      new PouchDB(dbs.remote, function (err, remote) {
        var db = new PouchDB(dbs.name);
        var docs = [
          {_id: '0', integer: 0, string: '0'},
          {_id: '1', integer: 1, string: '1'},
          {_id: '2', integer: 2, string: '2'}
        ];
        var doc1 = {_id: 'adoc', foo: 'bar' };
        var doc2 = {_id: 'anotherdoc', foo: 'baz'};
        remote.bulkDocs({ docs: docs }, {}, function (err, results) {
          var count = 0;
          var replicate = db.replicate.from(remote, {
            live: true,
            complete: function () {
              remote.put(doc2);
              setTimeout(function () {
                changes.cancel();
              }, 100);
            }
          });
          var changes = db.changes({
            live: true,
            complete: function (err, reason) {
              count.should.equal(4);
              done();
            },
            onChange: function (change) {
              ++count;
              if (count === 3) {
                remote.put(doc1);
              }
              if (count === 4) {
                replicate.cancel();
              }
            }
          });
        });
      });
    });

    it('Test basic events', function (done) {
      var db = new PouchDB(dbs.name);
      db.bulkDocs({ docs: docs }).then(function () {
        db.replicate.to(dbs.remote)
        .on('complete', function (res) {
          should.exist(res);
          db.replicate.to('http://0.0.0.0:0')
          .on('error', function (res) {
            should.exist(res);
            done();
          });
        });
      });
    });

    it('Replication filter', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var docs1 = [
        {_id: '0', integer: 0},
        {_id: '1', integer: 1},
        {_id: '2', integer: 2},
        {_id: '3', integer: 3}
      ];
      remote.bulkDocs({ docs: docs1 }, function (err, info) {
        db.replicate.from(remote, {
          complete: function (err, res) {
            if (err) {
              done(err);
            }
            db.allDocs(function (err, docs) {
              if (err) { done(err); }
              docs.rows.length.should.equal(2);
              done();
            });
          },
          filter: function (doc) {
            return doc.integer % 2 === 0;
          }
        });
      });
    });

    it('Replication with different filters', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var more_docs = [
        {_id: '3', integer: 3, string: '3'},
        {_id: '4', integer: 4, string: '4'}
      ];
      remote.bulkDocs({ docs: docs }, function (err, info) {
        db.replicate.from(remote, {
          filter: function (doc) {
            return doc.integer % 2 === 0;
          }
        }, function (err, response) {
          remote.bulkDocs({ docs: more_docs }, function (err, info) {
            db.replicate.from(remote, {}, function (err, response) {
              response.docs_written.should.equal(3);
              done();
            });
          });
        });
      });
    });

    it('Replication doc ids', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var thedocs = [
        {_id: '3', integer: 3, string: '3'},
        {_id: '4', integer: 4, string: '4'},
        {_id: '5', integer: 5, string: '5'}
      ];
      remote.bulkDocs({ docs: thedocs }, function (err, info) {
        db.replicate.from(remote, {
          doc_ids: ['3', '4']
        }, function (err, response) {
          response.docs_written.should.equal(2);
          done();
        });
      });
    });

    it('Replication since', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var thedocs = [
        {_id: '1', integer: 1, string: '1'},
        {_id: '2', integer: 2, string: '2'},
        {_id: '3', integer: 3, string: '3'},
        {_id: '4', integer: 4, string: '4'},
        {_id: '5', integer: 5, string: '5'}
      ];
      remote.bulkDocs({ docs: thedocs }, function (err, info) {
        db.replicate.from(remote, {
          since: 3,
          complete: function (err, result) {
            should.not.exist(err);
            result.docs_written.should.equal(2);
            db.replicate.from(remote, {
              since: 0,
              complete: function (err, result) {
                should.not.exist(err);
                result.docs_written.should.equal(3);
                done();
              }
            });
          }
        });
      });
    });

    it('Replication with same filters', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var more_docs = [
        {_id: '3', integer: 3, string: '3'},
        {_id: '4', integer: 4, string: '4'}
      ];
      remote.bulkDocs({ docs: docs }, function (err, info) {
        db.replicate.from(remote, {
          filter: function (doc) {
            return doc.integer % 2 === 0;
          }
        }, function (err, response) {
          remote.bulkDocs({ docs: more_docs }, function (err, info) {
            db.replicate.from(remote, {
              filter: function (doc) {
                return doc.integer % 2 === 0;
              }
            }, function (err, response) {
              response.docs_written.should.equal(1);
              done();
            });
          });
        });
      });
    });

    it('Replication with deleted doc', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var docs1 = [
        {_id: '0', integer: 0},
        {_id: '1', integer: 1},
        {_id: '2', integer: 2},
        {_id: '3', integer: 3},
        {_id: '4', integer: 4, _deleted: true}
      ];
      remote.bulkDocs({ docs: docs1 }, function (err, info) {
        db.replicate.from(remote, function () {
          db.allDocs(function (err, res) {
            res.total_rows.should.equal(4);
            done();
          });
        });
      });
    });

    it('Replication with doc deleted twice', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      remote.bulkDocs({ docs: docs }).then(function (info) {
        return remote.get('0');
      }).then(function (doc) {
        return remote.remove(doc);
      }).then(function () {
        return db.replicate.from(remote);
      }).then(function () {
        return db.allDocs();
      }).then(function (res) {
        res.total_rows.should.equal(2);
        return remote.allDocs({ keys: [ '0' ] });
      }).then(function (res) {
        var row = res.rows[0];
        should.not.exist(row.error);
        // set rev to latest so we go at the end (otherwise new
        // rev is 1 and the subsequent remove below won't win)
        var doc = {
          _id: '0',
          integer: 10,
          string: '10',
          _rev: row.value.rev
        };
        return remote.put(doc);
      }).then(function () {
        return remote.get('0');
      }).then(function (doc) {
        return remote.remove(doc);
      }).then(function () {
        return db.replicate.from(remote);
      }).then(function () {
        return db.allDocs();
      }).then(function (res) {
        res.total_rows.should.equal(2);
        done();
      }).catch(function (err) {
        done(JSON.stringify(err, false, 4));
      });
    });

    it('Replication notifications', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var changes = 0;
      var onChange = function (c) {
        changes++;
        if (changes === 3) {
          done();
        }
      };
      remote.bulkDocs({ docs: docs }, {}, function (err, results) {
        db.replicate.from(dbs.remote, { onChange: onChange });
      });
    });

    it('Replication with remote conflict', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var doc = {_id: 'test', test: 'Remote 1'}, winningRev;
      remote.post(doc, function (err, resp) {
        doc._rev = resp.rev;
        PouchDB.replicate(remote, db, function (err, resp) {
          doc.test = 'Local 1';
          db.put(doc, function (err, resp) {
            doc.test = 'Remote 2';
            remote.put(doc, function (err, resp) {
              doc._rev = resp.rev;
              doc.test = 'Remote 3';
              remote.put(doc, function (err, resp) {
                winningRev = resp.rev;
                PouchDB.replicate(db, remote, function (err, resp) {
                  PouchDB.replicate(remote, db, function (err, resp) {
                    remote.get('test', { revs_info: true },
                      function (err, remotedoc) {
                      db.get('test', { revs_info: true },
                        function (err, localdoc) {
                        localdoc._rev.should.equal(winningRev);
                        remotedoc._rev.should.equal(winningRev);
                        done();
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });

    it('Replication of multiple remote conflicts (#789)', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var doc = {_id: '789', _rev: '1-a', value: 'test'};
      function createConflicts(db, callback) {
        db.put(doc, { new_edits: false }, function (err, res) {
          testUtils.putAfter(db, {
            _id: '789',
            _rev: '2-a',
            value: 'v1'
          }, '1-a', function (err, res) {
            testUtils.putAfter(db, {
              _id: '789',
              _rev: '2-b',
              value: 'v2'
            }, '1-a', function (err, res) {
              testUtils.putAfter(db, {
                _id: '789',
                _rev: '2-c',
                value: 'v3'
              }, '1-a', function (err, res) {
                callback();
              });
            });
          });
        });
      }
      createConflicts(remote, function () {
        db.replicate.from(remote, function (err, result) {
          result.ok.should.equal(true);
          // in this situation, all the conflicting revisions should be read and
          // written to the target database (this is consistent with CouchDB)
          result.docs_written.should.equal(3);
          result.docs_read.should.equal(3);
          done();
        });
      });
    });

    it('Replicate large number of docs', function (done) {
      if ('saucelabs' in testUtils.params()) {
        return done();
      }
      this.timeout(15000);
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var docs = [];
      var num = 30;
      for (var i = 0; i < num; i++) {
        docs.push({
          _id: 'doc_' + i,
          foo: 'bar_' + i
        });
      }
      remote.bulkDocs({ docs: docs }, function (err, info) {
        db.replicate.from(remote, {}, function () {
          db.allDocs(function (err, res) {
            res.total_rows.should.equal(num);
            done();
          });
        });
      });
    });

    it.skip('Changes error', function (done) {
      if ('saucelabs' in testUtils.params()) {
        return done();
      }
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var docs = [];
      var num = 80;
      for (var i = 0; i < num; i++) {
        docs.push({
          _id: 'doc_' + i,
          foo: 'bar_' + i
        });
      }
      remote.bulkDocs({docs: docs}, {}, function (err, results) {
        var changes = remote.changes;
        var doc_count = 0;

        // Mock remote.get to fail writing doc_3
        remote.changes = function (opts) {
          var onChange = opts.onChange;
          opts.onChange = function () {
            doc_count++;
            onChange.apply(this, arguments);
          };
          var complete = opts.complete;
          opts.complete = function () {
            complete.apply(this, [{
              status: 500,
              error: 'mock changes error',
              reason: 'simulate and error from changes'
            }]);
          };
          changes.apply(this, arguments);
        };

        // Replicate and confirm failure
        db.replicate.from(remote, function (err, result) {
          should.exist(err);
          doc_count.should.equal(result.docs_read);
          remote.changes = changes;
          done();
        });
      });
    });

    it('Ensure checkpoint after deletion', function (done) {
      var db1name = dbs.name;
      var adoc = { '_id': 'adoc' };
      var newdoc = { '_id': 'newdoc' };
      var db1 = new PouchDB(dbs.name);
      var db2 = new PouchDB(dbs.remote);
      db1.post(adoc, function () {
        PouchDB.replicate(db1, db2, {
          complete: function () {
            PouchDB.destroy(db1name, function () {
              var fresh = new PouchDB(db1name);
              fresh.post(newdoc, function () {
                PouchDB.replicate(fresh, db2, {
                  complete: function () {
                    db2.allDocs(function (err, docs) {
                      docs.rows.length.should.equal(2);
                      done();
                    });
                  }
                });
              });
            });
          }
        });
      });
    });

    it('issue #1001 cb as 3rd argument', function (done) {
      PouchDB.replicate('http://example.com', dbs.name, function (err, result) {
        should.exist(err);
        done();
      });
    });

    it('issue #1001 cb in options', function (done) {
      PouchDB.replicate('http://example.com', dbs.name, {
        complete: function (err, result) {
          should.exist(err);
          done();
        }
      });
    });

    it('issue #1001 cb as 4th argument', function (done) {
      PouchDB.replicate(
        'http://example.com',
        dbs.name,
        {},
        function (err, result) {
          should.exist(err);
          done();
        }
      );
    });

    it('issue #909 Filtered replication bails at paging limit',
      function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var docs = [];
      var num = 100;
      for (var i = 0; i < num; i++) {
        docs.push({
          _id: 'doc_' + i,
          foo: 'bar_' + i
        });
      }
      num = 100;
      var docList = [];
      for (i = 0; i < num; i += 5) {
        docList.push('doc_' + i);
      }
      // uncomment this line to test only docs higher than paging limit
      docList = [
        'doc_33',
        'doc_60',
        'doc_90'
      ];
      remote.bulkDocs({ docs: docs }, {}, function (err, results) {
        db.replicate.from(dbs.remote, {
          live: false,
          doc_ids: docList
        }, function (err, result) {
          result.docs_written.should.equal(docList.length);
          done();
        });
      });
    });

    it.skip('(#1240) - get error', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      // 10 test documents
      var num = 10;
      var docs = [];
      for (var i = 0; i < num; i++) {
        docs.push({
          _id: 'doc_' + i,
          foo: 'bar_' + i
        });
      }
      // Initialize remote with test documents
      remote.bulkDocs({ docs: docs }, {}, function (err, results) {
        var get = remote.get;
        function first_replicate() {
          // Mock remote.get to fail writing doc_3 (fourth doc)
          remote.get = function () {
            // Simulate failure to get the document with id 'doc_4'
            // This should block the replication at seq 4
            if (arguments[0] === 'doc_4') {
              arguments[2].apply(null, [{}]);
            } else {
              get.apply(this, arguments);
            }
          };
          // Replicate and confirm failure, docs_written and target docs
          db.replicate.from(remote, function (err, result) {
            should.exist(err);
            should.exist(result);
            result.docs_written.should.equal(4);
            function check_docs(id, result) {
              if (!id) {
                second_replicate();
                return;
              }
              db.get(id, function (err, exists) {
                if (exists) {
                  should.not.exist(err);
                } else {
                  should.exist(err);
                }
                check_docs(docs.shift());
              });
            }
            var docs = [
              [
                'doc_0',
                true
              ],
              [
                'doc_1',
                true
              ],
              [
                'doc_2',
                true
              ],
              [
                'doc_3',
                false
              ],
              [
                'doc_4',
                false
              ],
              [
                'doc_5',
                false
              ],
              [
                'doc_6',
                false
              ],
              [
                'doc_7',
                false
              ],
              [
                'doc_8',
                false
              ],
              [
                'doc_9',
                false
              ]
            ];
            check_docs(docs.shift());
          });
        }
        function second_replicate() {
          // Restore remote.get to original
          remote.get = get;
          // Replicate and confirm success, docs_written and target docs
          db.replicate.from(remote, function (err, result) {
            should.not.exist(err);
            should.exist(result);
            result.docs_written.should.equal(6);
            function check_docs(id, exists) {
              if (!id) {
                done();
                return;
              }
              db.get(id, function (err, result) {
                if (exists) {
                  should.not.exist(err);
                } else {
                  should.exist(err);
                }
                check_docs(docs.shift());
              });
            }
            var docs = [
              [
                'doc_0',
                true
              ],
              [
                'doc_1',
                true
              ],
              [
                'doc_2',
                true
              ],
              [
                'doc_3',
                true
              ],
              [
                'doc_4',
                true
              ],
              [
                'doc_5',
                true
              ],
              [
                'doc_6',
                true
              ],
              [
                'doc_7',
                true
              ],
              [
                'doc_8',
                true
              ],
              [
                'doc_9',
                true
              ]
            ];
            check_docs(docs.shift());
          });
        }
        // Done the test
        first_replicate();
      });
    });

    it.skip('Get error 2', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      // 10 test documents
      var num = 10;
      var docs = [];
      for (var i = 0; i < num; i++) {
        docs.push({
          _id: 'doc_' + i,
          foo: 'bar_' + i
        });
      }
      // Initialize remote with test documents
      remote.bulkDocs({ docs: docs }, {}, function (err, results) {
        var get = remote.get;
        function first_replicate() {
          // Mock remote.get to fail writing doc_3 (fourth doc)
          remote.get = function () {
            // Simulate failure to get the document with id 'doc_4'
            // This should block the replication at seq 4
            if (arguments[0] === 'doc_4') {
              arguments[2].apply(null, [{
                status: 500,
                error: 'mock error',
                reason: 'mock get failure'
              }]);
            } else {
              get.apply(this, arguments);
            }
          };
          // Replicate and confirm failure, docs_written and target docs
          db.replicate.from(remote, function (err, result) {
            err.status.should.equal(500);
            err.error.should.equal('Replication aborted');
            err.reason.should.equal('src.get completed with error');
            err.details.status.should.equal(500);
            err.details.error.should.equal('mock error');
            err.details.reason.should.equal('mock get failure');
            result.errors[0].status.should.equal(500);
            result.errors[0].error.should.equal('mock error');
            result.errors[0].reason.should.equal('mock get failure');
            result.docs_written.should.equal(4);
            function check_docs(id, result) {
              if (!id) {
                second_replicate();
                return;
              }
              db.get(id, function (err, exists) {
                if (exists) {
                  should.not.exist(err);
                } else {
                  should.exist(err);
                }
                check_docs(docs.shift());
              });
            }
            var docs = [
              [
                'doc_0',
                true
              ],
              [
                'doc_1',
                true
              ],
              [
                'doc_2',
                true
              ],
              [
                'doc_3',
                false
              ],
              [
                'doc_4',
                false
              ],
              [
                'doc_5',
                false
              ],
              [
                'doc_6',
                false
              ],
              [
                'doc_7',
                false
              ],
              [
                'doc_8',
                false
              ],
              [
                'doc_9',
                false
              ]
            ];
            check_docs(docs.shift());
          });
        }
        function second_replicate() {
          // Restore remote.get to original
          remote.get = get;
          // Replicate and confirm success, docs_written and target docs
          db.replicate.from(remote, function (err, result) {
            should.not.exist(err);
            should.exist(result);
            result.docs_written.should.equal(6);
            function check_docs(id, exists) {
              if (!id) {
                done();
                return;
              }
              db.get(id, function (err, result) {
                if (exists) {
                  should.not.exist(err);
                } else {
                  should.exist(err);
                }
                check_docs(docs.shift());
              });
            }
            var docs = [
              [
                'doc_0',
                true
              ],
              [
                'doc_1',
                true
              ],
              [
                'doc_2',
                true
              ],
              [
                'doc_3',
                true
              ],
              [
                'doc_4',
                true
              ],
              [
                'doc_5',
                true
              ],
              [
                'doc_6',
                true
              ],
              [
                'doc_7',
                true
              ],
              [
                'doc_8',
                true
              ],
              [
                'doc_9',
                true
              ]
            ];
            check_docs(docs.shift());
          });
        }
        // Done the test
        first_replicate();
      });
    });

    it.skip("error updating checkpoint", function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      remote.bulkDocs({docs: docs}, {}, function (err, results) {
        var get = remote.get;
        var local_count = 0;
        // Mock remote.get to fail writing doc_3 (fourth doc)
        remote.get = function () {
          // Simulate failure to get the checkpoint
          if (arguments[0].slice(0, 6) === '_local') {
            local_count++;
            if (local_count === 2) {
              arguments[1].apply(null, [{
                status: 500,
                error: 'mock get error',
                reason: 'simulate an error updating the checkpoint'
              }]);
            } else {
              get.apply(this, arguments);
            }
          } else {
            get.apply(this, arguments);
          }
        };

        db.replicate.from(remote, {
          complete: function (err, result) {
            should.exist(err);
            done();
          }
        });
      });
    });

    it('(#1307) - replicate empty database', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      db.replicate.from(remote, function (err, result) {
        should.not.exist(err);
        should.exist(result);
        result.docs_written.should.equal(0);
        done();
      });
    });


    // This fails as it somehow triggers an xhr abort in the http adapter in
    // node which doesnt have xhr....
    it.skip('Syncing should stop if one replication fails (issue 838)',
      function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var doc1 = {_id: 'adoc', foo: 'bar'};
      var doc2 = {_id: 'anotherdoc', foo: 'baz'};
      var finished = false;
      var replications = db.replicate.sync(remote, {
        live: true,
        complete: function () {
          if (finished) {
            return;
          }
          finished = true;
          remote.put(doc2, function (err) {
            setTimeout(function () {
              db.allDocs(function (err, res) {
                res.total_rows.should.be.below(2);
                done();
              });
            }, 100);
          });
        }
      });
      db.put(doc1, function (err) {
        replications.pull.cancel();
      });
    });

    it("Reporting write failures (#942)", function (done) {
      var docs = [{_id: 'a', _rev: '1-a'}, {_id: 'b', _rev: '1-b'}];
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      db.bulkDocs({docs: docs}, {new_edits: false}, function (err, _) {
        var bulkDocs = remote.bulkDocs;
        remote.bulkDocs = function (content, opts, callback) {
          return new PouchDB.utils.Promise(function (fulfill, reject) {
            if (typeof callback !== 'function') {
              callback = function (err, resp) {
                if (err) {
                  reject(err);
                } else {
                  fulfill(resp);
                }
              };
            }
            var ids = content.docs.map(function (doc) { return doc._id; });
            if (ids.indexOf('a') >= 0) {
              callback(null, [{ok: true, id: 'a', rev: '1-a'}]);
            } else if (ids.indexOf('b') >= 0) {
              callback(null, [{
                id: 'b',
                error: 'internal server error',
                reason: 'test document write error'
              }]);
            } else {
              bulkDocs.apply(remote, [content, opts, callback]);
            }
          });
        };

        db.replicate.to(remote, { batch_size: 1 }, function (err, result) {
          should.not.exist(result);
          should.exist(err);
          err.result.docs_read.should.equal(2, 'docs_read');
          err.result.docs_written.should.equal(1, 'docs_written');
          err.result.doc_write_failures.should.equal(1, 'doc_write_failures');
          remote.bulkDocs = bulkDocs;
          db.replicate.to(remote, { batch_size: 1 }, function (err, result) {
            // checkpoint should not be moved past first doc
            // should continue from this point and retry second doc
            result.docs_read.should.equal(1, 'second replication, docs_read');
            result.docs_written.should
              .equal(1, 'second replication, docs_written');
            result.doc_write_failures.should
              .equal(0, 'second replication, doc_write_failures');
            done();
          });
        });
      });
    });

    it("Reporting write failures if whole saving fails (#942)",
      function (done) {
      var docs = [{_id: 'a', _rev: '1-a'}, {_id: 'b', _rev: '1-b'}];
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      db.bulkDocs({docs: docs}, {new_edits: false}, function (err, _) {
        var bulkDocs = remote.bulkDocs;
        remote.bulkDocs = function (docs, opts, callback) {
          if (typeof callback !== 'function') {
            return PouchDB.utils.Promise.reject(new Error());
          }
          callback(new Error());
        };

        db.replicate.to(remote, { batch_size: 1 }, function (err, result) {
          should.not.exist(result);
          should.exist(err);
          err.result.docs_read.should.equal(1, 'docs_read');
          err.result.docs_written.should.equal(0, 'docs_written');
          err.result.doc_write_failures.should.equal(1, 'doc_write_failures');
          err.result.last_seq.should.equal(0, 'last_seq');
          remote.bulkDocs = bulkDocs;
          db.replicate.to(remote, { batch_size: 1 }, function (err, result) {
            result.doc_write_failures.should
              .equal(0, 'second replication, doc_write_failures');
            result.docs_written.should
              .equal(2, 'second replication, docs_written');
            result.last_seq.should.equal(2, 'second replication, last_seq');
            done();
          });
        });
      });
    });

    it('Test consecutive replications with different query_params',
      function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var myDocs = [
        {_id: '0', integer: 0, string: '0'},
        {_id: '1', integer: 1, string: '1'},
        {_id: '2', integer: 2, string: '2'},
        {_id: '3', integer: 3, string: '3'},
        {_id: '4', integer: 5, string: '5'}
      ];
      remote.bulkDocs({ docs: myDocs }, {}, function (err, results) {
        var filterFun = function (doc, req) {
          if (req.query.even) {
            return doc.integer % 2 === 0;
          } else {
            return true;
          }
        };
        db.replicate.from(dbs.remote, {
          filter: filterFun,
          query_params: { 'even': true }
        }, function (err, result) {
          result.docs_written.should.equal(2);
          db.replicate.from(dbs.remote, {
            filter: filterFun,
            query_params: { 'even': false }
          }, function (err, result) {
            result.docs_written.should.equal(3);
            done();
          });
        });
      });
    });

    it('Test consecutive replications with different query_params and promises',
      function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var myDocs = [
        {_id: '0', integer: 0, string: '0'},
        {_id: '1', integer: 1, string: '1'},
        {_id: '2', integer: 2, string: '2'},
        {_id: '3', integer: 3, string: '3'},
        {_id: '4', integer: 5, string: '5'}
      ];
      var filterFun;
      remote.bulkDocs({ docs: myDocs }).then(function (results) {
        filterFun = function (doc, req) {
          if (req.query.even) {
            return doc.integer % 2 === 0;
          } else {
            return true;
          }
        };
        return db.replicate.from(dbs.remote, {
          filter: filterFun,
          query_params: { 'even': true }
        });
      }).then(function (result) {
        result.docs_written.should.equal(2);
        return db.replicate.from(dbs.remote, {
          filter: filterFun,
          query_params: { 'even': false }
        });
      }).then(function (result) {
        result.docs_written.should.equal(3);
        done();
      }).catch(done);
    });

    it('Test consecutive replications with different doc_ids', function (done) {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var myDocs = [
        {_id: '0', integer: 0, string: '0'},
        {_id: '1', integer: 1, string: '1'},
        {_id: '2', integer: 2, string: '2'},
        {_id: '3', integer: 3, string: '3'},
        {_id: '4', integer: 5, string: '5'}
      ];
      remote.bulkDocs({ docs: myDocs }, {}, function (err, results) {
        db.replicate.from(dbs.remote, {
          doc_ids: ['0', '4']
        }, function (err, result) {
          result.docs_written.should.equal(2);
          db.replicate.from(dbs.remote, {
            doc_ids: ['1', '2', '3']
          }, function (err, result) {
            result.docs_written.should.equal(3);
            db.replicate.from(dbs.remote, {
              doc_ids: ['5']
            }, function (err, result) {
              result.docs_written.should.equal(0);
              done();
            });
          });
        });
      });
    });

    it('doc count after multiple replications', function (done) {

      var runs = 2;
      // helper. remove each document in db and bulk load docs into same
      function rebuildDocuments(db, docs, callback) {
        db.allDocs({ include_docs: true }, function (err, response) {
          var count = 0;
          var limit = response.rows.length;
          if (limit === 0) {
            bulkLoad(db, docs, callback);
          }
          response.rows.forEach(function (doc) {
            db.remove(doc, function (err, response) {
              ++count;
              if (count === limit) {
                bulkLoad(db, docs, callback);
              }
            });
          });
        });
      }

      // helper.
      function bulkLoad(db, docs, callback) {
        db.bulkDocs({ docs: docs }, function (err, results) {
          if (err) {
            console.error('Unable to bulk load docs.  Err: ' +
                          JSON.stringify(err));
            return;
          }
          callback(results);
        });
      }

      // a basic map function to mimic our testing situation
      var map = 'function(doc) {' +
        'if (doc.common === true) {' +
          'emit(doc._id, doc.rev);' +
        '}' +
      '}';

      // The number of workflow cycles to perform. 2+ was always failing
      // reason for this test.
      var workflow = function (name, remote, x) {
        // some documents.  note that the variable Date component,
        //thisVaries, makes a difference.
        // when the document is otherwise static, couch gets the same hash
        // when calculating revision.
        // and the revisions get messed up in pouch
        var docs = [
          {
            _id: '0',
            integer: 0,
            thisVaries: new Date(),
            common: true
          },
          {
            _id: '1',
            integer: 1,
            thisVaries: new Date(),
            common: true
          },
          {
            _id: '2',
            integer: 2,
            thisVaries: new Date(),
            common: true
          },
          {
            _id: '3',
            integer: 3,
            thisVaries: new Date(),
            common: true
          }
        ];
        var dbr = new PouchDB(remote);
        rebuildDocuments(dbr, docs, function () {
          var db = new PouchDB(name);
          db.replicate.from(remote, function (err, result) {
            db.query({ map: map }, { reduce: false }, function (err, result) {
              result.rows.length.should.equal(docs.length);
              if (--x) {
                workflow(name, remote, x);
              } else {
                done();
              }
            });
          });
        });
      };

      workflow(dbs.name, dbs.remote, runs);
    });

    it('issue #300 rev id unique per doc', function (done) {
      var remote = new PouchDB(dbs.remote);
      var db = new PouchDB(dbs.name);
      var docs = [{ _id: 'a' }, { _id: 'b' }];
      remote.bulkDocs({ docs: docs }, {}, function (err, _) {
        db.replicate.from(dbs.remote, function (err, _) {
          db.allDocs(function (err, result) {
            result.rows.length.should.equal(2);
            result.rows[0].id.should.equal('a');
            result.rows[1].id.should.equal('b');
            done();
          });
        });
      });
    });

    it('issue #585 Store checkpoint on target db.', function (done) {
      var db = new PouchDB(dbs.name);
      var docs = [{ _id: 'a' }, { _id: 'b' }];
      db.bulkDocs({ docs: docs }, {}, function (err, _) {
        db.replicate.to(dbs.remote, function (err, result) {
          result.docs_written.should.equal(docs.length);
          PouchDB.destroy(dbs.remote, function (err, result) {
            db.replicate.to(dbs.remote, function (err, result) {
              result.docs_written.should.equal(docs.length);
              done();
            });
          });
        });
      });
    });
    it('should work with a read only source', function (done) {
      var src = new PouchDB(dbs.name);
      var target = new PouchDB(dbs.remote);
      var err = {
        "message": "_writer access is required for this request",
        "name": "unauthorized",
        "status": 401
      };
      src.bulkDocs({docs: [
        {_id: '0', integer: 0, string: '0'},
        {_id: '1', integer: 1, string: '1'},
        {_id: '2', integer: 2, string: '2'},
      ]}).then(function () {
        src.put = function () {
          if (typeof arguments[arguments.length - 1] === 'function') {
            arguments[arguments.length - 1](err);
          } else {
            return PouchDB.utils.Promise.reject(err);
          }
        };
        return src.replicate.to(target);
      }).then(function () {
        done();
      }, function (a) {
        done(JSON.stringify(a, false, 4));
      });
    });

    it('issue #2342 update_seq after large replication', function (done) {
      this.timeout(30000);
      var manyDocs;

      /* jshint ignore:start */
      manyDocs = [{"_id":"1"},{"_id":"2"},{"_id":"3"},{"_id":"4"},{"_id":"5"},{"_id":"6"},{"_id":"7"},{"_id":"8"},{"_id":"9"},{"_id":"10"},{"_id":"11"},{"_id":"12"},{"_id":"13"},{"_id":"14"},{"_id":"15"},{"_id":"16"},{"_id":"17"},{"_id":"18"},{"_id":"19"},{"_id":"20"},{"_id":"21"},{"_id":"22"},{"_id":"23"},{"_id":"24"},{"_id":"25"},{"_id":"26"},{"_id":"27"},{"_id":"28"},{"_id":"29"},{"_id":"30"},{"_id":"31"},{"_id":"32"},{"_id":"33"},{"_id":"34"},{"_id":"35"},{"_id":"36"},{"_id":"37"},{"_id":"38"},{"_id":"39"},{"_id":"40"},{"_id":"41"},{"_id":"42"},{"_id":"43"},{"_id":"44"},{"_id":"45"},{"_id":"46"},{"_id":"47"},{"_id":"48"},{"_id":"49"},{"_id":"50"},{"_id":"51"},{"_id":"52"},{"_id":"53"},{"_id":"54"},{"_id":"55"},{"_id":"56"},{"_id":"57"},{"_id":"58"},{"_id":"59"},{"_id":"60"},{"_id":"61"},{"_id":"62"},{"_id":"63"},{"_id":"64"},{"_id":"65"},{"_id":"66"},{"_id":"67"},{"_id":"68"},{"_id":"69"},{"_id":"70"},{"_id":"71"},{"_id":"72"},{"_id":"73"},{"_id":"74"},{"_id":"75"},{"_id":"76"},{"_id":"77"},{"_id":"78"},{"_id":"79"},{"_id":"80"},{"_id":"81"},{"_id":"82"},{"_id":"83"},{"_id":"84"},{"_id":"85"},{"_id":"86"},{"_id":"87"},{"_id":"88"},{"_id":"89"},{"_id":"90"},{"_id":"91"},{"_id":"92"},{"_id":"93"},{"_id":"94"},{"_id":"95"},{"_id":"96"},{"_id":"97"},{"_id":"98"},{"_id":"99"},{"_id":"100"},{"_id":"101"},{"_id":"102"},{"_id":"103"},{"_id":"104"},{"_id":"105"},{"_id":"106"},{"_id":"107"},{"_id":"108"},{"_id":"109"},{"_id":"110"},{"_id":"111"},{"_id":"112"},{"_id":"113"},{"_id":"114"},{"_id":"115"},{"_id":"116"},{"_id":"117"},{"_id":"118"},{"_id":"119"},{"_id":"120"},{"_id":"121"},{"_id":"122"},{"_id":"123"},{"_id":"124"},{"_id":"125"},{"_id":"126"},{"_id":"127"},{"_id":"128"},{"_id":"129"},{"_id":"130"},{"_id":"131"},{"_id":"132"},{"_id":"133"},{"_id":"134"},{"_id":"135"},{"_id":"136"},{"_id":"137"},{"_id":"138"},{"_id":"139"},{"_id":"140"},{"_id":"141"},{"_id":"142"},{"_id":"143"},{"_id":"144"},{"_id":"145"},{"_id":"146"},{"_id":"147"},{"_id":"148"},{"_id":"149"},{"_id":"150"},{"_id":"151"},{"_id":"152"},{"_id":"153"},{"_id":"154"},{"_id":"155"},{"_id":"156"},{"_id":"157"},{"_id":"158"},{"_id":"159"},{"_id":"160"}];
      /* jshint ignore:end */

      var remote = new PouchDB(dbs.remote);
      var db = new PouchDB(dbs.name);

      remote.bulkDocs({ docs: manyDocs }, {}, function (err, _) {
        db.replicate.from(dbs.remote, function (err, _) {
          db.info(function (err, info) {
            var maxSeq = 0;
            db.changes({
              since: 'latest',
              live: true,
              onChange: function (change) {
                if (change.seq > maxSeq) {
                  maxSeq = change.seq;
                }
              },
              complete: function (info) {
                maxSeq.should.equal(info.update_seq - 1);
                done();
              }
            });
          });
        });
      });
    });
  });
});

// // This test only needs to run for one configuration, and it slows stuff
// // down
downAdapters.map(function (adapter) {

  describe('test.replication.js-down-test', function () {

    var dbs = {};

    beforeEach(function (done) {
      dbs.name = testUtils.adapterUrl(adapters[0], 'test_repl');
      testUtils.cleanup([dbs.name], done);
    });

    afterEach(function (done) {
      testUtils.cleanup([dbs.name], done);
    });

    it('replicate from down server test', function (done) {
      var db = new PouchDB(dbs.name);
      db.replicate.to('http://infiniterequest.com', function (err, changes) {
        should.exist(err);
        done();
      });
    });

  });
});
