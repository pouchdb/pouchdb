"use strict";

var adapters = [
  ['local-1', 'http-1'],
  ['http-1', 'http-2'],
  ['http-1', 'local-1'],
  ['local-1', 'local-2']];

var downAdapters = ['local-1'];
var deletedDocAdapters = [['local-1', 'http-1']];
var interHTTPAdapters = [['http-1', 'http-2']];

if (typeof module !== 'undefined' && module.exports) {
  var PouchDB = require('../lib');
  var testUtils = require('./test.utils.js');
  downAdapters = [];
}

adapters.map(function(adapters) {

  QUnit.module('replication: ' + adapters[0] + ':' + adapters[1], {
    setup : function () {
      this.name = testUtils.generateAdapterUrl(adapters[0]);
      this.remote = testUtils.generateAdapterUrl(adapters[1]);
      PouchDB.enableAllDbs = true;
    },
    teardown: testUtils.cleanupTestDatabases
  });

  var docs = [
    {_id: "0", integer: 0, string: '0'},
    {_id: "1", integer: 1, string: '1'},
    {_id: "2", integer: 2, string: '2'}
  ];

  asyncTest("Test basic pull replication", function() {
    var self = this;
    testUtils.initDBPair(this.name, this.remote, function(db, remote) {
      remote.bulkDocs({docs: docs}, {}, function(err, results) {
        db.replicate.from(self.remote, function(err, result) {
          ok(result.ok, 'replication was ok');
          ok(result.docs_written === docs.length, 'correct # docs written');
          start();
        });
      });
    });
  });

  asyncTest("Test basic pull replication plain api", function() {
    var self = this;
    testUtils.initDBPair(this.name, this.remote, function(db, remote) {
      remote.bulkDocs({docs: docs}, {}, function(err, results) {
        PouchDB.replicate(self.remote, self.name, {}, function(err, result) {
          ok(result.ok, 'replication was ok');
          equal(result.docs_written, docs.length, 'correct # docs written');
          start();
        });
      });
    });
  });

  asyncTest("Test basic pull replication plain api 2", function() {
    var self = this;
    testUtils.initDBPair(this.name, this.remote, function(db, remote) {
      remote.bulkDocs({docs: docs}, {}, function(err, results) {
        PouchDB.replicate(self.remote, self.name, {complete: function(err, result) {
          ok(result.ok, 'replication was ok');
          equal(result.docs_written, docs.length, 'correct # docs written');
          start();
        }});
      });
    });
  });

  asyncTest("Local DB contains documents", function() {
    var self = this;
    testUtils.initDBPair(this.name, this.remote, function(db, remote) {
      remote.bulkDocs({docs: docs}, {}, function(err, _) {
        db.bulkDocs({docs: docs}, {}, function(err, _) {
          db.replicate.from(self.remote, function(err, _) {
            db.allDocs(function(err, result) {
              ok(result.rows.length === docs.length, 'correct # docs exist');
              start();
            });
          });
        });
      });
    });
  });

  asyncTest("Test basic push replication", function() {
    var self = this;
    testUtils.initDBPair(this.name, this.remote, function(db, remote) {
      db.bulkDocs({docs: docs}, {}, function(err, results) {
        db.replicate.to(self.remote, function(err, result) {
          ok(result.ok, 'replication was ok');
          ok(result.docs_written === docs.length, 'correct # docs written');
          start();
        });
      });
    });
  });

  asyncTest("Test basic push replication take 2", function() {
    var self = this;
    testUtils.initDBPair(this.name, this.remote, function(db, remote) {
      db.bulkDocs({docs: docs}, {}, function(err, _) {
        db.replicate.to(self.remote, function(err, _) {
          remote.allDocs(function(err, result) {
            ok(result.rows.length === docs.length, 'correct # docs written');
            start();
          });
        });
      });
    });
  });

  asyncTest("Test basic push replication sequence tracking", function() {
    var self = this;
    testUtils.initDBPair(this.name, this.remote, function(db, remote) {
      var doc1 = {_id: 'adoc', foo:'bar'};
      db.put(doc1, function(err, result) {
        db.replicate.to(self.remote, function(err, result) {
          equal(result.docs_read, 1, 'correct # changed docs read on first replication');
          db.replicate.to(self.remote, function(err, result) {
            equal(result.docs_read, 0, 'correct # changed docs read on second replication');
            db.replicate.to(self.remote, function(err, result) {
              equal(result.docs_read, 0, 'correct # changed docs read on third replication');
              start();
            });
          });
        });
      });
    });
  });

  asyncTest("Test checkpoint", function() {
    var self = this;
    testUtils.initDBPair(this.name, this.remote, function(db, remote) {
      remote.bulkDocs({docs: docs}, {}, function(err, results) {
        db.replicate.from(self.remote, function(err, result) {
          ok(result.ok, 'replication was ok');
          ok(result.docs_written === docs.length, 'correct # docs written');
          db.replicate.from(self.remote, function(err, result) {
            ok(result.ok, 'replication was ok');
            equal(result.docs_written, 0, 'correct # docs written');
            equal(result.docs_read, 0, 'no docs read');
            start();
          });
        });
      });
    });
  });

  asyncTest("Test continuous pull checkpoint", function() {
    var self = this;
    testUtils.initDBPair(this.name, this.remote, function(db, remote) {
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
            db.replicate.from(self.remote, {complete: function(err, details) {
              equal(details.docs_read, 0, 'We restarted from checkpoint');
              start();
            }});
          }
        });
        var replication = db.replicate.from(self.remote, {continuous: true});
      });
    });
  });

  asyncTest("Test continuous push checkpoint", function() {
    var self = this;
    testUtils.initDBPair(this.name, this.remote, function(db, remote) {
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
            db.replicate.to(self.remote, {complete: function(err, details) {
              equal(details.docs_read, 0, 'We restarted from checkpoint');
              start();
            }});
          }
        });
        var replication = db.replicate.to(self.remote, {continuous: true});
      });
    });
  });

  asyncTest("Test checkpoint 2", function() {
    var self = this;
    var doc = {_id: "3", count: 0};
    testUtils.initDBPair(this.name, this.remote, function(db, remote) {
      remote.put(doc, {}, function(err, results) {
        db.replicate.from(self.remote, function(err, result) {
          ok(result.ok, 'replication was ok');
          doc._rev = results.rev;
          doc.count++;
          remote.put(doc, {}, function(err, results) {
            doc._rev = results.rev;
            doc.count++;
            remote.put(doc, {}, function(err, results) {
              db.replicate.from(self.remote, function(err, result) {
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

  asyncTest("Test checkpoint 3 :)", function() {
    var self = this;
    var doc = {_id: "3", count: 0};
    testUtils.initDBPair(this.name, this.remote, function(db, remote) {
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


  asyncTest('Testing allDocs with some conflicts (issue #468)', function() {
    // we indeed needed replication to create failing test here!
    testUtils.initDBPair(this.name, this.remote, function(db1, db2) {
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
  asyncTest("Test basic conflict", function() {
    var self = this;
    var doc1 = {_id: 'adoc', foo:'bar'};
    var doc2 = {_id: 'adoc', bar:'baz'};
    testUtils.initDBPair(this.name, this.remote, function(db, remote) {
      db.put(doc1, function(err, localres) {
        remote.put(doc2, function(err, remoteres) {
          db.replicate.to(self.remote, function(err, _) {
            remote.get('adoc', {conflicts: true}, function(err, result) {
              ok(result._conflicts, 'result has a conflict');
              start();
            });
          });
        });
      });
    });
  });


  asyncTest("Test _conflicts key", function() {
    var self = this;
    var doc1 = {_id: 'adoc', foo:'bar'};
    var doc2 = {_id: 'adoc', bar:'baz'};
    testUtils.initDBPair(this.name, this.remote, function(db, remote) {
      db.put(doc1, function(err, localres) {
        remote.put(doc2, function(err, remoteres) {
          db.replicate.to(self.remote, function(err, _) {

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


  asyncTest("Test basic continuous pull replication", function() {
    var self = this;
    var doc1 = {_id: 'adoc', foo:'bar'};
    testUtils.initDBPair(this.name, this.remote, function(db, remote) {
      remote.bulkDocs({docs: docs}, {}, function(err, results) {
        var count = 0;
        var rep = db.replicate.from(self.remote, {continuous: true});
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

  asyncTest("Test basic continuous push replication", function() {
    var self = this;
    var doc1 = {_id: 'adoc', foo:'bar'};
    testUtils.initDBPair(this.name, this.remote, function(db, remote) {
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

  asyncTest("Test cancel pull replication", function() {
    var self = this;
    var doc1 = {_id: 'adoc', foo:'bar'};
    var doc2 = {_id: 'anotherdoc', foo:'baz'};
    testUtils.initDBPair(this.name, this.remote, function(db, remote) {
      remote.bulkDocs({docs: docs}, {}, function(err, results) {
        var count = 0;
        var replicate = db.replicate.from(self.remote, {continuous: true});
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

  asyncTest("Replication filter", function() {
    var docs1 = [
      {_id: "0", integer: 0},
      {_id: "1", integer: 1},
      {_id: "2", integer: 2},
      {_id: "3", integer: 3}
    ];

    testUtils.initDBPair(this.name, this.remote, function(db, remote) {
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


  asyncTest("Replication with different filters", function() {
    var more_docs = [
      {_id: '3', integer: 3, string: '3'},
      {_id: '4', integer: 4, string: '4'}
    ];

    testUtils.initDBPair(this.name, this.remote, function(db, remote) {
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

  asyncTest("Replication doc ids", function() {
    var thedocs = [
      {_id: '3', integer: 3, string: '3'},
      {_id: '4', integer: 4, string: '4'},
      {_id: '5', integer: 5, string: '5'}
    ];

    testUtils.initDBPair(this.name, this.remote, function(db, remote) {
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

  asyncTest("Replication with same filters", function() {
    var more_docs = [
      {_id: '3', integer: 3, string: '3'},
      {_id: '4', integer: 4, string: '4'}
    ];

    testUtils.initDBPair(this.name, this.remote, function(db, remote) {
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

  asyncTest("Replication with deleted doc", function() {
    var docs1 = [
      {_id: "0", integer: 0},
      {_id: "1", integer: 1},
      {_id: "2", integer: 2},
      {_id: "3", integer: 3},
      {_id: "4", integer: 4, _deleted: true}
    ];

    testUtils.initDBPair(this.name, this.remote, function(db, remote) {
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

  asyncTest("Replication notifications", function() {
    var self = this;
    var changes = 0;
    var onChange = function(c) {
      changes++;
      ok(true, 'Got change notification');
      if (changes === 3) {
        ok(true, 'Got all change notification');
        start();
      }
    };
    testUtils.initDBPair(this.name, this.remote, function(db, remote) {
      remote.bulkDocs({docs: docs}, {}, function(err, results) {
        db.replicate.from(self.remote, {onChange: onChange});
      });
    });
  });

  asyncTest("Replication with remote conflict", function() {
    var doc = {_id: 'test', test: "Remote 1"},
        winningRev;

    testUtils.initDBPair(this.name, this.remote, function(db, remote) {
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

  asyncTest("Replication of multiple remote conflicts (#789)", function() {
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

    testUtils.initDBPair(this.name, this.remote, function(db, remote) {
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

  asyncTest("Replicate large number of docs", function() {
    this.timeout(15000);
    var docs = [];
    var num = 30;
    for (var i = 0; i < num; i++) {
      docs.push({_id: 'doc_' + i, foo: 'bar_' + i});
    }
    testUtils.initDBPair(this.name, this.remote, function(db, remote) {
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

  asyncTest("Ensure checkpoint after deletion", function() {
    var db1name = this.name;
    var adoc = {'_id' :'adoc'};
    var newdoc = {'_id' :'newdoc'};
    testUtils.initDBPair(this.name, this.remote, function(db1, db2) {
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

  asyncTest("issue #909 Filtered replication bails at paging limit", function() {
    var self = this;
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
    testUtils.initDBPair(this.name, this.remote, function(db, remote) {
      remote.bulkDocs({docs: docs}, {}, function(err, results) {
        db.replicate.from(self.remote, {continuous: false, doc_ids: docList}, function(err, result) {
          ok(result.ok, 'replication was ok');
          ok(result.docs_written === docList.length, 'correct # docs written');
          start();
        });
      });
    });
  });

  asyncTest("(#1240) - get error", function () {
    var self = this;

    // 10 test documents
    var num = 10;
    var docs = [];
    for (var i = 0; i < num; i++) {
      docs.push({_id: 'doc_' + i, foo: 'bar_' + i});
    }

    // Set up test databases
    testUtils.initDBPair(this.name, this.remote, function(db, remote) {
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

  asyncTest("(#1240) - bulkWrite error", function () {
    var self = this;

    // 10 test documents
    var num = 10;
    var docs = [];
    for (var i = 0; i < num; i++) {
      docs.push({_id: 'doc_' + i, foo: 'bar_' + i});
    }

    // Set up test databases
    testUtils.initDBPair(this.name, this.remote, function(db, remote) {
      // Initialize remote with test documents
      remote.bulkDocs({docs: docs}, {}, function(err, results) {
        var bulkDocs = db.bulkDocs;

        function first_replicate() {
          // Mock bulkDocs to fail writing doc_3 (fourth doc)
          db.bulkDocs = function() {
            if(arguments[0].docs[0]._id === 'doc_3') {
              arguments[2].apply(null, [{
                status: 500,
                error: 'mock bulkDocs error',
                reason: 'Simulated error for test'
              }]);
            } else {
              bulkDocs.apply(this, arguments);
            }
          };
          // Replicate and confirm failure, docs_written and target docs
          db.replicate.from(remote, function(err, result) {
            ok(err !== null, 'Replication fails with an error');
            ok(result !== null, 'Replication has a result');
            strictEqual(result.docs_written, 3, 'Three docs written');
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
          // Restore buldDocs to original
          db.bulkDocs = bulkDocs;
          // Replicate and confirm success, docs_written and target docs
          db.replicate.from(remote, function(err, result) {
            ok(err === null, 'Replication completes without error');
            ok(result !== null, 'Replication has a result');
            strictEqual(result.docs_written, 7, 'Seven docs written');
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

  asyncTest("(#1307) - replicate empty database", function () {
    var self = this;

    // Set up test databases
    testUtils.initDBPair(this.name, this.remote, function(db, remote) {
      db.replicate.from(remote, function(err, result) {
        ok(!err, 'No error');
        ok(!!result, 'Result');
        strictEqual(result.docs_written, 0, 'No docs written');
        start();
      });
    });
  });

});

// test a basic "initialize pouch" scenario when couch instance contains deleted revisions
// currently testing idb-http only
deletedDocAdapters.map(function(adapters) {
  QUnit.module('replication: ' + adapters[0] + ':' + adapters[1], {
    setup : function () {
      this.name = testUtils.generateAdapterUrl(adapters[0]);
      this.remote = testUtils.generateAdapterUrl(adapters[1]);
    }
  });

  asyncTest("doc count after multiple replications with deleted revisions.", function() {
    var self = this;
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
    testUtils.initDBPair(self.name, self.remote, function(){
      // Rinse, repeat our workflow...
      workflow(self.name, self.remote, runs);
    });
  });

  asyncTest("issue #300 rev id unique per doc", 3, function() {
    var docs = [{_id: "a"}, {_id: "b"}];
    var self = this;
    testUtils.initDBPair(this.name, this.remote, function(db, remote) {
      remote.bulkDocs({docs: docs}, {}, function(err, _){
        db.replicate.from(self.remote, function(err, _){
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

  asyncTest("issue #585 Store checkpoint on target db.", function() {
    var docs = [{_id: "a"}, {_id: "b"}];
    var self = this;
    testUtils.initDBPair(this.name, this.remote, function(db, remote) {
        db.bulkDocs({docs: docs}, {}, function(err, _) {
          db.replicate.to(self.remote, function(err, result) {
            ok(result.docs_written === docs.length, 'docs replicated ok');
            PouchDB.destroy(self.remote, function (err, result) {
              ok(result.ok === true, 'remote was deleted');
              db.replicate.to(self.remote, function (err, result) {
                ok(result.docs_written === docs.length, 'docs were written again because target was deleted.');
                start();
              });
            });
          });
        });
    });
  });
});

// This test only needs to run for one configuration, and it slows stuff
// down
downAdapters.map(function(adapter) {

  QUnit.module('replication: ' + adapter, {
    setup : function () {
      this.name = testUtils.generateAdapterUrl(adapter);
    }
  });

  asyncTest("replicate from down server test", function (){
    expect(1);
    testUtils.initTestDB(this.name, function(err, db) {
      db.replicate.to('http://infiniterequest.com', function (err, changes) {
        ok(err);
        start();
      });
    });
  });
});

// Server side replication via `server: true` between http
interHTTPAdapters.map(function(adapters) {
  QUnit.module('server side replication: ' + adapters[0] + ':' + adapters[1], {
    setup : function () {
      this.name = testUtils.generateAdapterUrl(adapters[0]);
      this.remote = testUtils.generateAdapterUrl(adapters[1]);
    }
  });

  var docs = [
    {_id: "0", integer: 0, string: '0'},
    {_id: "1", integer: 1, string: '1'},
    {_id: "2", integer: 2, string: '2'}
  ];

  asyncTest("Test basic replication", function() {
    var self = this;
    testUtils.initTestDB(this.name, function(err, db) {
      db.bulkDocs({docs: docs}, {}, function(err, results) {
        PouchDB.replicate(self.name, self.remote, {server: true}, function(err, result) {
          ok(result.ok, 'replication was ok');
          equal(result.history[0].docs_written, docs.length, 'correct # docs written');
          start();
        });
      });
    });
  });

  asyncTest("Test cancel continuous replication", function() {
    var self = this;
    var doc1 = {_id: 'adoc', foo:'bar'};
    var doc2 = {_id: 'anotherdoc', foo:'baz'};
    testUtils.initDBPair(this.name, this.remote, function(db, remote) {
      remote.bulkDocs({docs: docs}, {}, function(err, results) {
        var count = 0;
        var replicate = db.replicate.from(self.remote, {server: true, continuous: true});
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

  asyncTest("Test consecutive replications with different query_params", function() {
    var myDocs = [
      {_id: "0", integer: 0, string: '0'},
      {_id: "1", integer: 1, string: '1'},
      {_id: "2", integer: 2, string: '2'},
      {_id: "3", integer: 3, string: '3'},
      {_id: "4", integer: 5, string: '5'}
    ];
    var self = this;
    testUtils.initDBPair(this.name, this.remote, function(db, remote) {
      remote.bulkDocs({docs: myDocs}, {}, function(err, results) {
        var filterFun = function(doc, req) {
          if (req.query.even) {
            return doc.integer % 2 === 0;
          } else {
            return true;
          }
        };
        db.replicate.from(self.remote, {
          filter: filterFun,
          query_params: {"even": true}
        }, function(err, result) {
          equal(result.docs_written, 2, "correct # docs written");
          db.replicate.from(self.remote, {
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
