"use strict";

var adapters = [
  ['local-1', 'http-1'],
  ['http-1', 'http-2'],
  ['http-1', 'local-1'],
  ['local-1', 'local-2']];
function ok(thing, message) {
  (!!thing).should.equal(true, message);
}
function equal(thing1, thing2, message) {
  thing1.should.equal(thing2, message);
}
function notEqual(thing1, thing2, message) {
  thing1.should.not.equal(thing2, message);
}
function deepEqual(thing1, thing2, message) {
  thing1.should.deep.equal(thing2, message);
}
var strictEqual = equal;
var downAdapters = ['local-1'];
var deletedDocAdapters = [['local-1', 'http-1']];
var interHTTPAdapters = [['http-1', 'http-2']];
var testHelpers = {};
if (typeof module !== 'undefined' && module.exports) {
  downAdapters = [];
}
describe('changes', function () {

  adapters.map(function(adapters) {

    describe(adapters, function () {
      beforeEach(function() {
        testHelpers.name = testUtils.generateAdapterUrl(adapters[0]);
        testHelpers.remote = testUtils.generateAdapterUrl(adapters[1]);
        PouchDB.enableAllDbs = true;
      });
      afterEach(testUtils.cleanupTestDatabases);

      var docs = [
        {_id: "0", integer: 0, string: '0'},
        {_id: "1", integer: 1, string: '1'},
        {_id: "2", integer: 2, string: '2'}
      ];

      it("Test basic pull replication", function(start) {
        testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(db, remote) {
          remote.bulkDocs({docs: docs}, {}, function(err, results) {
            db.replicate.from(testHelpers.remote, function(err, result) {
              ok(result.ok, 'replication was ok');
              ok(result.docs_written === docs.length, 'correct # docs written');
              start();
            });
          });
        });
      });

      it("Test basic pull replication plain api", function(start) {
        testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(db, remote) {
          remote.bulkDocs({docs: docs}, {}, function(err, results) {
            PouchDB.replicate(testHelpers.remote, testHelpers.name, {}, function(err, result) {
              ok(result.ok, 'replication was ok');
              equal(result.docs_written, docs.length, 'correct # docs written');
              start();
            });
          });
        });
      });

      it("Test basic pull replication plain api 2", function(start) {
        testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(db, remote) {
          remote.bulkDocs({docs: docs}, {}, function(err, results) {
            PouchDB.replicate(testHelpers.remote, testHelpers.name, {complete: function(err, result) {
              ok(result.ok, 'replication was ok');
              equal(result.docs_written, docs.length, 'correct # docs written');
              start();
            }});
          });
        });
      });

      it("Local DB contains documents", function(start) {
        testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(db, remote) {
          remote.bulkDocs({docs: docs}, {}, function(err, _) {
            db.bulkDocs({docs: docs}, {}, function(err, _) {
              db.replicate.from(testHelpers.remote, function(err, _) {
                db.allDocs(function(err, result) {
                  ok(result.rows.length === docs.length, 'correct # docs exist');
                  start();
                });
              });
            });
          });
        });
      });

      it("Test basic push replication", function(start) {
        testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(db, remote) {
          db.bulkDocs({docs: docs}, {}, function(err, results) {
            db.replicate.to(testHelpers.remote, function(err, result) {
              ok(result.ok, 'replication was ok');
              ok(result.docs_written === docs.length, 'correct # docs written');
              start();
            });
          });
        });
      });

      it("Test basic push replication take 2", function(start) {
        testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(db, remote) {
          db.bulkDocs({docs: docs}, {}, function(err, _) {
            db.replicate.to(testHelpers.remote, function(err, _) {
              remote.allDocs(function(err, result) {
                ok(result.rows.length === docs.length, 'correct # docs written');
                start();
              });
            });
          });
        });
      });

      it("Test basic push replication sequence tracking", function(start) {
        testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(db, remote) {
          var doc1 = {_id: 'adoc', foo:'bar'};
          db.put(doc1, function(err, result) {
            db.replicate.to(testHelpers.remote, function(err, result) {
              equal(result.docs_read, 1, 'correct # changed docs read on first replication');
              db.replicate.to(testHelpers.remote, function(err, result) {
                equal(result.docs_read, 0, 'correct # changed docs read on second replication');
                db.replicate.to(testHelpers.remote, function(err, result) {
                  equal(result.docs_read, 0, 'correct # changed docs read on third replication');
                  start();
                });
              });
            });
          });
        });
      });

      it("Test checkpoint", function(start) {
        testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(db, remote) {
          remote.bulkDocs({docs: docs}, {}, function(err, results) {
            db.replicate.from(testHelpers.remote, function(err, result) {
              ok(result.ok, 'replication was ok');
              ok(result.docs_written === docs.length, 'correct # docs written');
              db.replicate.from(testHelpers.remote, function(err, result) {
                ok(result.ok, 'replication was ok');
                equal(result.docs_written, 0, 'correct # docs written');
                equal(result.docs_read, 0, 'no docs read');
                start();
              });
            });
          });
        });
      });

      it("Test continuous pull checkpoint", function(start) {
        testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(db, remote) {
          remote.bulkDocs({docs: docs}, {}, function(err, results) {
            var changeCount = docs.length;
            var changes = db.changes({
              continuous: true,
    	  // Replicate writes docs first then updates checkpoints. There is
    	  // a race between the checkpoint update and this change callback.
    	  // This test may not be deterministic.
              onChange: function(change) {
                if (--changeCount) {
                  return;
                }
                replication.cancel();
                changes.cancel();
                db.replicate.from(testHelpers.remote, {complete: function(err, details) {
                  equal(details.docs_read, 0, 'We restarted from checkpoint');
                  start();
                }});
              }
            });
            var replication = db.replicate.from(testHelpers.remote, {continuous: true});
          });
        });
      });

      it("Test continuous push checkpoint", function(start) {
        testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(db, remote) {
          db.bulkDocs({docs: docs}, {}, function(err, results) {
            var changeCount = docs.length;
            var changes = remote.changes({
              continuous: true,
              onChange: function(change) {
                if (--changeCount) {
                  return;
                }
                replication.cancel();
                changes.cancel();
                db.replicate.to(testHelpers.remote, {complete: function(err, details) {
                  equal(details.docs_read, 0, 'We restarted from checkpoint');
                  start();
                }});
              }
            });
            var replication = db.replicate.to(testHelpers.remote, {continuous: true});
          });
        });
      });

      it("Test checkpoint 2", function(start) {
        
        var doc = {_id: "3", count: 0};
        testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(db, remote) {
          remote.put(doc, {}, function(err, results) {
            db.replicate.from(testHelpers.remote, function(err, result) {
              ok(result.ok, 'replication was ok');
              doc._rev = results.rev;
              doc.count++;
              remote.put(doc, {}, function(err, results) {
                doc._rev = results.rev;
                doc.count++;
                remote.put(doc, {}, function(err, results) {
                  db.replicate.from(testHelpers.remote, function(err, result) {
                    ok(result.ok, 'replication was ok');
                    equal(result.docs_written, 1, 'correct # docs written');
                    start();
                  });
                });
              });
            });
          });
        });
      });

      it("Test checkpoint 3 :)", function(start) {
        
        var doc = {_id: "3", count: 0};
        testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(db, remote) {
          db.put(doc, {}, function(err, results) {
            PouchDB.replicate(db, remote, {}, function(err, result) {
              ok(result.ok, 'replication was ok');
              doc._rev = results.rev;
              doc.count++;
              db.put(doc, {}, function(err, results) {
                doc._rev = results.rev;
                doc.count++;
                db.put(doc, {}, function(err, results) {
                  PouchDB.replicate(db, remote, {}, function(err, result) {
                    ok(result.ok, 'replication was ok');
                    ok(result.docs_written === 1, 'correct # docs written');
                    start();
                  });
                });
              });
            });
          });
        });
      });


      it('Testing allDocs with some conflicts (issue #468)', function(start) {
        // we indeed needed replication to create failing test here!
        testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(db1, db2) {
          var doc = {
            _id: "foo",
            _rev: "1-a",
            value: "generic"
          };
          db1.put(doc, {new_edits: false}, function(err, res) {
            db2.put(doc, {new_edits: false}, function(err, res) {
              testUtils.putAfter(db2, {_id: "foo", _rev: "2-b", value: "db2"}, "1-a", function(err, res) {
                testUtils.putAfter(db1, {_id: "foo", _rev: "2-c", value: "whatever"}, "1-a", function(err,res) {
                  testUtils.putAfter(db1, {_id: "foo", _rev: "3-c", value: "db1"}, "2-c", function(err, res) {
                    db1.get("foo", function(err, doc) {
                      ok(doc.value === "db1", "db1 has correct value (get)");
                      db2.get("foo", function(err, doc) {
                        ok(doc.value === "db2", "db2 has correct value (get)");
                        PouchDB.replicate(db1, db2, function() {
                          PouchDB.replicate(db2, db1, function() {
                            db1.get("foo", function(err, doc) {
                              ok(doc.value === "db1", "db1 has correct value (get after replication)");
                              db2.get("foo", function(err, doc) {
                                ok(doc.value === "db1", "db2 has correct value (get after replication)");
                                db1.allDocs({include_docs: true}, function(err, res) { // redundant but we want to test it
                                  ok(res.rows[0].doc.value === "db1", "db1 has correct value (allDocs)");
                                  db2.allDocs({include_docs: true}, function(err, res) {
                                    ok(res.rows[0].doc.value === "db1", "db2 has correct value (allDocs)");

                                    start();
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
      });


      // CouchDB will not generate a conflict here, it uses a deteministic
      // method to generate the revision number, however we cannot copy its
      // method as it depends on erlangs internal data representation
      it("Test basic conflict", function(start) {
        
        var doc1 = {_id: 'adoc', foo:'bar'};
        var doc2 = {_id: 'adoc', bar:'baz'};
        testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(db, remote) {
          db.put(doc1, function(err, localres) {
            remote.put(doc2, function(err, remoteres) {
              db.replicate.to(testHelpers.remote, function(err, _) {
                remote.get('adoc', {conflicts: true}, function(err, result) {
                  ok(result._conflicts, 'result has a conflict');
                  start();
                });
              });
            });
          });
        });
      });


      it("Test _conflicts key", function(start) {
        
        var doc1 = {_id: 'adoc', foo:'bar'};
        var doc2 = {_id: 'adoc', bar:'baz'};
        testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(db, remote) {
          db.put(doc1, function(err, localres) {
            remote.put(doc2, function(err, remoteres) {
              db.replicate.to(testHelpers.remote, function(err, _) {

                var queryFun = {
                  map: function(doc) {
                    if (doc._conflicts) {
                      emit(doc._id, [doc._rev].concat(doc._conflicts));
                    }
                  }
                };

                remote.query(queryFun, {reduce: false, conflicts: true}, function(_, res) {
                  equal(res.rows.length, 1, "_conflict key exists");
                  start();
                });

              });
            });
          });
        });
      });


      it("Test basic continuous pull replication", function(start) {
        
        var doc1 = {_id: 'adoc', foo:'bar'};
        testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(db, remote) {
          remote.bulkDocs({docs: docs}, {}, function(err, results) {
            var count = 0;
            var rep = db.replicate.from(testHelpers.remote, {continuous: true});
            var changes = db.changes({
              onChange: function(change) {
                ++count;
                if (count === 3) {
                  return remote.put(doc1);
                }
                if (count === 4) {
                  ok(true, 'Got all the changes');
                  rep.cancel();
                  changes.cancel();
                  start();
                }
              },
              continuous: true
            });
          });
        });
      });

      it("Test basic continuous push replication", function(start) {
        
        var doc1 = {_id: 'adoc', foo:'bar'};
        testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(db, remote) {
          db.bulkDocs({docs: docs}, {}, function(err, results) {
            var count = 0;
            var rep = remote.replicate.from(db, {continuous: true});
            var changes = remote.changes({
              onChange: function(change) {
                ++count;
                if (count === 3) {
                  return db.put(doc1);
                }
                if (count === 4) {
                  ok(true, 'Got all the changes');
                  rep.cancel();
                  changes.cancel();
                  start();
                }
              },
              continuous: true
            });
          });
        });
      });

      it("Test cancel pull replication", function(start) {
        
        var doc1 = {_id: 'adoc', foo:'bar'};
        var doc2 = {_id: 'anotherdoc', foo:'baz'};
        testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(db, remote) {
          remote.bulkDocs({docs: docs}, {}, function(err, results) {
            var count = 0;
            var replicate = db.replicate.from(testHelpers.remote, {continuous: true});
            var changes = db.changes({
              continuous: true,
              onChange: function(change) {
                ++count;
                if (count === 3) {
                  remote.put(doc1);
                }
                if (count === 4) {
                  replicate.cancel();
                  remote.put(doc2);
                  // This setTimeout is needed to ensure no further changes come through
                  setTimeout(function() {
                    ok(count === 4, 'got no more docs');
                    changes.cancel();
                    start();
                  }, 500);
                }
              }
            });
          });
        });
      });

      it("Replication filter", function(start) {
        var docs1 = [
          {_id: "0", integer: 0},
          {_id: "1", integer: 1},
          {_id: "2", integer: 2},
          {_id: "3", integer: 3}
        ];

        testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(db, remote) {
          remote.bulkDocs({docs: docs1}, function(err, info) {
            var replicate = db.replicate.from(remote, {
              filter: function(doc) { return doc.integer % 2 === 0; }
            }, function() {
              db.allDocs(function(err, docs) {
                equal(docs.rows.length, 2);
                replicate.cancel();
                start();
              });
            });
          });
        });
      });


      it("Replication with different filters", function(start) {
        var more_docs = [
          {_id: '3', integer: 3, string: '3'},
          {_id: '4', integer: 4, string: '4'}
        ];

        testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(db, remote) {
          remote.bulkDocs({docs: docs}, function(err, info) {
            db.replicate.from(remote, {
              filter: function(doc) { return doc.integer % 2 === 0; }
            }, function(err, response){
              remote.bulkDocs({docs:more_docs}, function(err, info) {
                db.replicate.from(remote, {}, function(err, response) {
                  ok(response.docs_written === 3,'correct # of docs replicated');
                  start();
                });
              });
            });
          });
        });
      });

      it("Replication doc ids", function(start) {
        var thedocs = [
          {_id: '3', integer: 3, string: '3'},
          {_id: '4', integer: 4, string: '4'},
          {_id: '5', integer: 5, string: '5'}
        ];

        testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(db, remote) {
          remote.bulkDocs({docs: thedocs}, function(err, info) {
            db.replicate.from(remote, {
              doc_ids: ['3', '4']
            }, function(err, response){
              strictEqual(response.docs_written, 2, 'correct # of docs replicated');
              start();
            });
          });
        });
      });

      it("Replication since", function(start) {
        var thedocs = [
          {_id: '1', integer: 1, string: '1'},
          {_id: '2', integer: 2, string: '2'},
          {_id: '3', integer: 3, string: '3'},
          {_id: '4', integer: 4, string: '4'},
          {_id: '5', integer: 5, string: '5'}
        ];

        testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(db, remote) {
          remote.bulkDocs({docs: thedocs}, function(err, info) {
            db.replicate.from(remote, {
              since: 3,
              complete: function(err, result) {
                ok(!null, 'Replication completed without error');
                result.docs_written.should.equal(2, 'Correct number of docs written');
                db.replicate.from(remote, {
                  since: 0,
                  complete: function(err, result) {
                    ok(!err, 'Replication completed without error');
                    result.docs_written.should.equal(3, 'Correct number of docs written');
                    start();
                  }
                });
              }
            });
          });
        });
      });

      it("Replication with same filters", function(start) {
        var more_docs = [
          {_id: '3', integer: 3, string: '3'},
          {_id: '4', integer: 4, string: '4'}
        ];

        testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(db, remote) {
          remote.bulkDocs({docs: docs}, function(err, info) {
            db.replicate.from(remote, {
              filter: function(doc) { return doc.integer % 2 === 0; }
            }, function(err, response){
              remote.bulkDocs({docs:more_docs}, function(err, info) {
                db.replicate.from(remote, {
                  filter: function(doc) { return doc.integer % 2 === 0; }
                }, function(err, response) {
                  ok(response.docs_written === 1,'correct # of docs replicated');
                  start();
                });
              });
            });
          });
        });
      });

      it("Replication with deleted doc", function(start) {
        var docs1 = [
          {_id: "0", integer: 0},
          {_id: "1", integer: 1},
          {_id: "2", integer: 2},
          {_id: "3", integer: 3},
          {_id: "4", integer: 4, _deleted: true}
        ];

        testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(db, remote) {
          remote.bulkDocs({docs: docs1}, function(err, info) {
            var replicate = db.replicate.from(remote, function() {
              db.allDocs(function(err, res) {
                equal(res.total_rows, 4, 'Replication with deleted docs');
                start();
              });
            });
          });
        });
      });

      it("Replication notifications", function(start) {
        
        var changes = 0;
        var onChange = function(c) {
          changes++;
          ok(true, 'Got change notification');
          if (changes === 3) {
            ok(true, 'Got all change notification');
            start();
          }
        };
        testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(db, remote) {
          remote.bulkDocs({docs: docs}, {}, function(err, results) {
            db.replicate.from(testHelpers.remote, {onChange: onChange});
          });
        });
      });

      it("Replication with remote conflict", function(start) {
        var doc = {_id: 'test', test: "Remote 1"},
            winningRev;

        testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(db, remote) {
          remote.post(doc, function(err, resp) {
            doc._rev = resp.rev;
            PouchDB.replicate(remote, db, function(err, resp) {
              doc.test = "Local 1";
              db.put(doc, function(err, resp) {
                doc.test = "Remote 2";
                remote.put(doc, function(err, resp) {
                  doc._rev = resp.rev;
                  doc.test = "Remote 3";
                  remote.put(doc, function(err, resp) {
                    winningRev = resp.rev;
                    PouchDB.replicate(db, remote, function(err, resp) {
                      PouchDB.replicate(remote, db, function(err, resp) {
                        remote.get('test', {revs_info: true}, function(err, remotedoc) {
                          db.get('test', {revs_info: true}, function(err, localdoc) {
                            equal(localdoc._rev, winningRev, "Local chose correct winning revision");
                            equal(remotedoc._rev, winningRev, "Remote chose winning revision");
                            start();
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

      it("Replication of multiple remote conflicts (#789)", function(start) {
        var doc = {_id: '789', _rev: '1-a', value: 'test'};

        function createConflicts(db, callback) {
          db.put(doc, {new_edits: false}, function(err, res) {
            testUtils.putAfter(db, {_id: '789', _rev: '2-a', value: 'v1'}, '1-a',
              function(err, res) {
                testUtils.putAfter(db, {_id: '789', _rev: '2-b', value: 'v2'}, '1-a',
                  function(err, res) {
                    testUtils.putAfter(db, {_id: '789', _rev: '2-c', value: 'v3'}, '1-a',
                      function(err, res) {
                        callback();
                      });
                  });
              });
          });
        }

        testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(db, remote) {
          createConflicts(remote, function() {
            db.replicate.from(remote, function(err, result) {
              ok(result.ok, 'replication was ok');
              // in this situation, all the conflicting revisions should be read and
              // written to the target database (this is consistent with CouchDB)
              ok(result.docs_written === 3, 'correct # docs written');
              ok(result.docs_read === 3, 'correct # docs read');
              start();
            });
          });
        });
      });

      it("Replicate large number of docs", function(start) {
        this.timeout(15000);
        var docs = [];
        var num = 30;
        for (var i = 0; i < num; i++) {
          docs.push({_id: 'doc_' + i, foo: 'bar_' + i});
        }
        testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(db, remote) {
          remote.bulkDocs({docs: docs}, function(err, info) {
            var replicate = db.replicate.from(remote, {}, function() {
              db.allDocs(function(err, res) {
                equal(res.total_rows, num, 'Replication with deleted docs');
                start();
              });
            });
          });
        });
      });

      it("Ensure checkpoint after deletion", function(start) {
        var db1name = testHelpers.name;
        var adoc = {'_id' :'adoc'};
        var newdoc = {'_id' :'newdoc'};
        testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(db1, db2) {
          db1.post(adoc, function() {
            PouchDB.replicate(db1, db2, {complete: function() {
              PouchDB.destroy(db1name, function() {
                var fresh = new PouchDB(db1name);
                fresh.post(newdoc, function() {
                  PouchDB.replicate(fresh, db2, {complete: function() {
                    db2.allDocs(function(err, docs) {
                      equal(docs.rows.length, 2, 'Woot, got both');
                      start();
                    });
                  }});
                });
              });
            }});
          });
        });
      });

      it("issue #909 Filtered replication bails at paging limit", function(start) {
        
        var docs = [];
        var num = 100;
        for (var i = 0; i < num; i++) {
          docs.push({_id: 'doc_' + i, foo: 'bar_' + i});
        }
        num = 100;
        var docList = [];
        for (i = 0; i < num; i+=5) {
          docList.push('doc_' + i);
        }
        // uncomment this line to test only docs higher than paging limit
        docList = ['doc_33', 'doc_60', 'doc_90'];
        testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(db, remote) {
          remote.bulkDocs({docs: docs}, {}, function(err, results) {
            db.replicate.from(testHelpers.remote, {continuous: false, doc_ids: docList}, function(err, result) {
              ok(result.ok, 'replication was ok');
              ok(result.docs_written === docList.length, 'correct # docs written');
              start();
            });
          });
        });
      });

      it("(#1240) - get error", function(start) {
        

        // 10 test documents
        var num = 10;
        var docs = [];
        for (var i = 0; i < num; i++) {
          docs.push({_id: 'doc_' + i, foo: 'bar_' + i});
        }

        // Set up test databases
        testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(db, remote) {
          // Initialize remote with test documents
          remote.bulkDocs({docs: docs}, {}, function(err, results) {
            var get = remote.get;

            function first_replicate() {
              // Mock remote.get to fail writing doc_3 (fourth doc)
              remote.get = function() {
                // Simulate failure to get the document with id 'doc_4'
                // This should block the replication at seq 4
                if(arguments[0] === 'doc_4') {
                  arguments[2].apply(null, [{}]);
                } else {
                  get.apply(this, arguments);
                }
              };

              // Replicate and confirm failure, docs_written and target docs
              db.replicate.from(remote, function(err, result) {
                ok(err !== null, 'Replication fails with an error');
                ok(result !== null, 'Replication has a result');
                strictEqual(result.docs_written, 4, 'Four docs written');
                function check_docs(id, result) {
                  if (!id) {
                    second_replicate();
                    return;
                  }
                  db.get(id, function(err, exists) {
                    if(exists) {
                      ok(err === null, 'Document exists')
                    } else {
                      ok(err !== null, 'Document does not exist')
                    }
                    check_docs(docs.shift());
                  });
                }
                var docs = [
                  [ 'doc_0', true ],
                  [ 'doc_1', true ],
                  [ 'doc_2', true ],
                  [ 'doc_3', false ],
                  [ 'doc_4', false ],
                  [ 'doc_5', false ],
                  [ 'doc_6', false ],
                  [ 'doc_7', false ],
                  [ 'doc_8', false ],
                  [ 'doc_9', false ]
                ];
                check_docs(docs.shift());
              });
            }

            function second_replicate() {
              // Restore remote.get to original
              remote.get = get;

              // Replicate and confirm success, docs_written and target docs
              db.replicate.from(remote, function(err, result) {
                ok(err === null, 'Replication completes without error');
                ok(result !== null, 'Replication has a result');
                strictEqual(result.docs_written, 6, 'Six docs written');
                function check_docs(id, exists) {
                  if (!id) {
                    start();
                    return;
                  }
                  db.get(id, function(err, result) {
                    if(exists) {
                      ok(err === null, 'Document exists')
                    } else {
                      ok(err !== null, 'Document does not exist')
                    }
                    check_docs(docs.shift());
                  });
                }
                var docs = [
                  [ 'doc_0', true ],
                  [ 'doc_1', true ],
                  [ 'doc_2', true ],
                  [ 'doc_3', true ],
                  [ 'doc_4', true ],
                  [ 'doc_5', true ],
                  [ 'doc_6', true ],
                  [ 'doc_7', true ],
                  [ 'doc_8', true ],
                  [ 'doc_9', true ]
                ];
                check_docs(docs.shift());
              });
            }

            // Start the test
            first_replicate();

          });
        });
      });

      it("Get error 2", function(start) {
        
        // 10 test documents
        var num = 10;
        var docs = [];
        for (var i = 0; i < num; i++) {
          docs.push({_id: 'doc_' + i, foo: 'bar_' + i});
        }

        // Set up test databases
        testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(db, remote) {
          // Initialize remote with test documents
          remote.bulkDocs({docs: docs}, {}, function(err, results) {
            var get = remote.get;

            function first_replicate() {
              // Mock remote.get to fail writing doc_3 (fourth doc)
              remote.get = function() {
                // Simulate failure to get the document with id 'doc_4'
                // This should block the replication at seq 4
                if(arguments[0] === 'doc_4') {
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
              db.replicate.from(remote, function(err, result) {
                ok(err !== null, 'Replication fails with an error');
                ok(err.status === 500, 'err.status');
                ok(err.error === 'Replication aborted', 'err.error');
                ok(err.reason === 'src.get completed with error', 'err.reason');
                ok(err.details.status === 500, 'err.details.status');
                ok(err.details.error === 'mock error', 'err.details.error');
                ok(err.details.reason === 'mock get failure', 'err.details.reason');
                ok(result !== null, 'Replication has a result');
                ok(!result.ok, 'result.ok');
                ok(result.errors[0].status === 500, 'result.errors[0].status');
                ok(result.errors[0].error === 'mock error', 'result.errors[0].error');
                ok(result.errors[0].reason === 'mock get failure', 'result.errors[0].reason');
                strictEqual(result.docs_written, 4, 'Four docs written');
                function check_docs(id, result) {
                  if (!id) {
                    second_replicate();
                    return;
                  }
                  db.get(id, function(err, exists) {
                    if(exists) {
                      ok(err === null, 'Document exists')
                    } else {
                      ok(err !== null, 'Document does not exist')
                    }
                    check_docs(docs.shift());
                  });
                }
                var docs = [
                  [ 'doc_0', true ],
                  [ 'doc_1', true ],
                  [ 'doc_2', true ],
                  [ 'doc_3', false ],
                  [ 'doc_4', false ],
                  [ 'doc_5', false ],
                  [ 'doc_6', false ],
                  [ 'doc_7', false ],
                  [ 'doc_8', false ],
                  [ 'doc_9', false ]
                ];
                check_docs(docs.shift());
              });
            }

            function second_replicate() {
              // Restore remote.get to original
              remote.get = get;

              // Replicate and confirm success, docs_written and target docs
              db.replicate.from(remote, function(err, result) {
                ok(err === null, 'Replication completes without error');
                ok(result !== null, 'Replication has a result');
                strictEqual(result.docs_written, 6, 'Six docs written');
                function check_docs(id, exists) {
                  if (!id) {
                    start();
                    return;
                  }
                  db.get(id, function(err, result) {
                    if(exists) {
                      ok(err === null, 'Document exists')
                    } else {
                      ok(err !== null, 'Document does not exist')
                    }
                    check_docs(docs.shift());
                  });
                }
                var docs = [
                  [ 'doc_0', true ],
                  [ 'doc_1', true ],
                  [ 'doc_2', true ],
                  [ 'doc_3', true ],
                  [ 'doc_4', true ],
                  [ 'doc_5', true ],
                  [ 'doc_6', true ],
                  [ 'doc_7', true ],
                  [ 'doc_8', true ],
                  [ 'doc_9', true ]
                ];
                check_docs(docs.shift());
              });
            }

            // Start the test
            first_replicate();

          });
        });
      });

      // it("(#1240) - bulkWrite error", function () {
      //   

      //   // 10 test documents
      //   var num = 10;
      //   var docs = [];
      //   for (var i = 0; i < num; i++) {
      //     docs.push({_id: 'doc_' + i, foo: 'bar_' + i});
      //   }

      //   // Set up test databases
      //   testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(db, remote) {
      //     // Initialize remote with test documents
      //     remote.bulkDocs({docs: docs}, {}, function(err, results) {
      //       var bulkDocs = db.bulkDocs;

      //       function first_replicate() {
      //         // Mock bulkDocs to fail writing doc_3 (fourth doc)
      //         db.bulkDocs = function() {
      //           if(arguments[0].docs[0]._id === 'doc_3') {
      //             arguments[2].apply(null, [{
      //               status: 500,
      //               error: 'mock bulkDocs error',
      //               reason: 'Simulated error for test'
      //             }]);
      //           } else {
      //             bulkDocs.apply(this, arguments);
      //           }
      //         };
      //         // Replicate and confirm failure, docs_written and target docs
      //         db.replicate.from(remote, function(err, result) {
      //           ok(err !== null, 'Replication fails with an error');
      //           ok(result !== null, 'Replication has a result');
      //           strictEqual(result.docs_written, 3, 'Three docs written');
      //           function check_docs(id, result) {
      //             if (!id) {
      //               second_replicate();
      //               return;
      //             }
      //             db.get(id, function(err, exists) {
      //               if(exists) {
      //                 ok(err === null, 'Document exists')
      //               } else {
      //                 ok(err !== null, 'Document does not exist')
      //               }
      //               check_docs(docs.shift());
      //             });
      //           }
      //           var docs = [
      //             [ 'doc_0', true ],
      //             [ 'doc_1', true ],
      //             [ 'doc_2', true ],
      //             [ 'doc_3', false ],
      //             [ 'doc_4', false ],
      //             [ 'doc_5', false ],
      //             [ 'doc_6', false ],
      //             [ 'doc_7', false ],
      //             [ 'doc_8', false ],
      //             [ 'doc_9', false ]
      //           ];
      //           check_docs(docs.shift());
      //         });
      //       }

      //       function second_replicate() {
      //         // Restore buldDocs to original
      //         db.bulkDocs = bulkDocs;
      //         // Replicate and confirm success, docs_written and target docs
      //         db.replicate.from(remote, function(err, result) {
      //           ok(err === null, 'Replication completes without error');
      //           ok(result !== null, 'Replication has a result');
      //           strictEqual(result.docs_written, 7, 'Seven docs written');
      //           function check_docs(id, exists) {
      //             if (!id) {
      //               start();
      //               return;
      //             }
      //             db.get(id, function(err, result) {
      //               if(exists) {
      //                 ok(err === null, 'Document exists')
      //               } else {
      //                 ok(err !== null, 'Document does not exist')
      //               }
      //               check_docs(docs.shift());
      //             });
      //           }
      //           var docs = [
      //             [ 'doc_0', true ],
      //             [ 'doc_1', true ],
      //             [ 'doc_2', true ],
      //             [ 'doc_3', true ],
      //             [ 'doc_4', true ],
      //             [ 'doc_5', true ],
      //             [ 'doc_6', true ],
      //             [ 'doc_7', true ],
      //             [ 'doc_8', true ],
      //             [ 'doc_9', true ]
      //           ];
      //           check_docs(docs.shift());
      //         });
      //       }

      //       // Start the test
      //       first_replicate();

      //     });
      //   });
      // });

      it("error updating checkpoint", function(done) {
        testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(db, remote) {
          remote.bulkDocs({docs: docs}, {}, function(err, results) {
            var get = remote.get;
            var local_count = 0;
            // Mock remote.get to fail writing doc_3 (fourth doc)
            remote.get = function() {
              // Simulate failure to get the checkpoint
              if(arguments[0].slice(0,6) === '_local') {
                local_count++;
                if(local_count === 2) {
                  console.log('get local: ' + JSON.stringify(arguments));
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

            db.replicate.from(remote, function(err, result) {
              ok(!!err, 'Replication fails with an error');
              ok(!result.ok, 'Replication result is not OK');
              done();
            });
          });
        });
      });

      it("(#1307) - replicate empty database", function(start) {
        

        // Set up test databases
        testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(db, remote) {
          db.replicate.from(remote, function(err, result) {
            ok(!err, 'No error');
            ok(!!result, 'Result');
            strictEqual(result.docs_written, 0, 'No docs written');
            start();
          });
        });
      });
    });
  });
});
  // test a basic "initialize pouch" scenario when couch instance contains deleted revisions
  // currently testing idb-http only
describe('replication', function () {
  deletedDocAdapters.map(function(adapters) {
    describe(adapters[0] + ':' + adapters[1], function () {
      afterEach(function () {
        testHelpers.name = testUtils.generateAdapterUrl(adapters[0]);
        testHelpers.remote = testUtils.generateAdapterUrl(adapters[1]);
      })

      it("doc count after multiple replications with deleted revisions.", function(start) {
        
        var runs = 2;

        // helper. remove each document in db and bulk load docs into same
        function rebuildDocuments(db, docs, callback) {
          db.allDocs({include_docs:true}, function (err, response) {
            var count = 0;
            var limit = response.rows.length;
            if (limit === 0) {
              bulkLoad(db, docs, callback);
            }
            response.rows.forEach(function(doc) {
              db.remove(doc, function(err, response) {
                ++count;
                if (count === limit){
                  bulkLoad(db, docs, callback);
                }
              });

            });
          });
        }

        // helper.
        function bulkLoad(db, docs, callback){
          db.bulkDocs({docs:docs}, function (err, results) {
            if (err) {
              console.error("Unable to bulk load docs.  Err: " + JSON.stringify(err));
              return;
            }
            callback(results);
          });
        }

        // a basic map function to mimic our testing situation
        function map(doc) {
          if (doc.common === true) {
            emit(doc._id, doc.rev);
          }
        }

        // The number of workflow cycles to perform. 2+ was always failing
        // reason for this test.
        var workflow = function(name, remote, x){

          // some documents.  note that the variable Date component,
          //thisVaries, makes a difference.
          // when the document is otherwise static, couch gets the same hash
          // when calculating revision.
          // and the revisions get messed up in pouch
          var docs = [
            {_id: "0", integer: 0, thisVaries: new Date(), common: true},
            {_id: "1", integer: 1, thisVaries: new Date(), common: true},
            {_id: "2", integer: 2, thisVaries: new Date(), common: true},
            {_id: "3", integer: 3, thisVaries: new Date(), common: true}
          ];

          testUtils.openTestDB(remote, function(err, dbr){
            rebuildDocuments(dbr, docs, function(){
              testUtils.openTestDB(name, function(err, db){
                db.replicate.from(remote, function(err, result) {
                  db.query({map:map}, {reduce: false}, function (err, result) {
                    equal(result.rows.length, docs.length, "correct # docs replicated");
                    if (--x) {
                      workflow(name, remote, x);
                    } else {
                      start();
                    }
                  });
                });
              });
            });
          });
        };

        // new pouch and couch
        testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(){
          // Rinse, repeat our workflow...
          workflow(testHelpers.name, testHelpers.remote, runs);
        });
      });

      it("issue #300 rev id unique per doc", function(start) {
        var docs = [{_id: "a"}, {_id: "b"}];
        
        testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(db, remote) {
          remote.bulkDocs({docs: docs}, {}, function(err, _){
            db.replicate.from(testHelpers.remote, function(err, _){
              db.allDocs(function(err, result){
                ok(result.rows.length === 2, "correct number of rows");
                ok(result.rows[0].id === "a", "first doc ok");
                ok(result.rows[1].id === "b", "second doc ok");
                start();
              });
            });
          });
        });
      });

      it("issue #585 Store checkpoint on target db.", function(start) {
        var docs = [{_id: "a"}, {_id: "b"}];
        
        testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(db, remote) {
            db.bulkDocs({docs: docs}, {}, function(err, _) {
              db.replicate.to(testHelpers.remote, function(err, result) {
                ok(result.docs_written === docs.length, 'docs replicated ok');
                PouchDB.destroy(testHelpers.remote, function (err, result) {
                  ok(result.ok === true, 'remote was deleted');
                  db.replicate.to(testHelpers.remote, function (err, result) {
                    ok(result.docs_written === docs.length, 'docs were written again because target was deleted.');
                    start();
                  });
                });
              });
            });
        });
      });
    });
  });
});

  // This test only needs to run for one configuration, and it slows stuff
  // down
describe('replication', function () {
  downAdapters.map(function(adapter) {

    describe(adapter, function () {
      beforeEach(function () {
        testHelpers.name = testUtils.generateAdapterUrl(adapter);
      });

      it("replicate from down server test", function (start){
        testUtils.initTestDB(testHelpers.name, function(err, db) {
          db.replicate.to('http://infiniterequest.com', function (err, changes) {
            ok(err);
            start();
          });
        });
      });

      it("Test sync cancel", function (done) {
        var completed = 0;
        testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(db, remote) {
          
          var replications = db.replicate.sync(remote, {
            complete: function(err, result) {
              completed++;
              if(completed === 2) {
                done();
              }
            }
          });
          ok(replications, 'got some stuff');
          replications.cancel();
          return;
        });
      });

      it("Test syncing two endpoints (issue 838)", function (start) {
        var doc1 = {_id: 'adoc', foo:'bar'};
        var doc2 = {_id: 'anotherdoc', foo:'baz'};
        testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(db, remote) {
          var finished = false;
          
          function onComplete() {
            if (finished) {
              db.allDocs(function(err, res) {
                var db_total = res.total_rows;
                remote.allDocs(function(err, res) {
                  var remote_total = res.total_rows;
                  ok(db_total === remote_total, 'replicated all docs successfully');
                  start();
                });
              });
            } else {
              finished = true;
            }
          }

          db.put(doc1, function(err) {
            remote.put(doc2, function(err) {
              db.replicate.sync(remote, {
                complete: onComplete
              });
            });
          });
        });
      });

      it("Syncing should stop if one replication fails (issue 838)", function (start) {
        var doc1 = {_id: 'adoc', foo:'bar'};
        var doc2 = {_id: 'anotherdoc', foo:'baz'};
        testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(db, remote) {
          var replications = db.replicate.sync(remote, {
            continuous: true,

            onComplete: console.log
          });

          db.put(doc1, function(err) {
            replications.pull.cancel();
            remote.put(doc2, function(err) {
              db.allDocs(function(err, res) {
                var db_total = res.total_rows;
                remote.allDocs(function(err, res) {
                  var remote_total = res.total_rows;
                  ok(db_total < 2, 'db replication halted');
                  ok(remote_total < 2, 'remote replication halted');
                  start();
                });
              });
            });
          });
        });
      });
    });
  });
});

describe('server side replication', function () {
  // Server side replication via `server: true` between http
  interHTTPAdapters.map(function(adapters) {
    describe(adapters[0] + ':' + adapters[1], function () {
      beforeEach(function () {
        testHelpers.name = testUtils.generateAdapterUrl(adapters[0]);
        testHelpers.remote = testUtils.generateAdapterUrl(adapters[1]);
      });

      var docs = [
        {_id: "0", integer: 0, string: '0'},
        {_id: "1", integer: 1, string: '1'},
        {_id: "2", integer: 2, string: '2'}
      ];

      it("Test basic replication", function(start) {
        
        testUtils.initTestDB(testHelpers.name, function(err, db) {
          db.bulkDocs({docs: docs}, {}, function(err, results) {
            PouchDB.replicate(testHelpers.name, testHelpers.remote, {server: true}, function(err, result) {
              ok(result.ok, 'replication was ok');
              equal(result.history[0].docs_written, docs.length, 'correct # docs written');
              start();
            });
          });
        });
      });

      it("Test cancel continuous replication", function(start) {
        
        var doc1 = {_id: 'adoc', foo:'bar'};
        var doc2 = {_id: 'anotherdoc', foo:'baz'};
        testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(db, remote) {
          remote.bulkDocs({docs: docs}, {}, function(err, results) {
            var count = 0;
            var replicate = db.replicate.from(testHelpers.remote, {server: true, continuous: true});
            var changes = db.changes({
              continuous: true,
              onChange: function(change) {
                ++count;
                if (count === 3) {
                  remote.put(doc1);
                }
                if (count === 4) {
                  replicate.cancel();
                  remote.put(doc2);
                  // This setTimeout is needed to ensure no further changes come through
                  setTimeout(function() {
                    ok(count === 4, 'got no more docs');
                    changes.cancel();
                    start();
                  }, 500);
                }
              }
            });
          });
        });
      });

      it("Test consecutive replications with different query_params", function(start) {
        var myDocs = [
          {_id: "0", integer: 0, string: '0'},
          {_id: "1", integer: 1, string: '1'},
          {_id: "2", integer: 2, string: '2'},
          {_id: "3", integer: 3, string: '3'},
          {_id: "4", integer: 5, string: '5'}
        ];
        
        testUtils.initDBPair(testHelpers.name, testHelpers.remote, function(db, remote) {
          remote.bulkDocs({docs: myDocs}, {}, function(err, results) {
            var filterFun = function(doc, req) {
              if (req.query.even) {
                return doc.integer % 2 === 0;
              } else {
                return true;
              }
            };
            db.replicate.from(testHelpers.remote, {
              filter: filterFun,
              query_params: {"even": true}
            }, function(err, result) {
              equal(result.docs_written, 2, "correct # docs written");
              db.replicate.from(testHelpers.remote, {
                filter: filterFun,
                query_params: {"even": false}
              }, function(err, result) {
                equal(result.docs_written, 3, "correct # docs written after replication with different query_params");
                start();
              });
            });
          });
        });
      });
    });
  });
});
