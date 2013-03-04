/*globals initTestDB: false, emit: true, generateAdapterUrl: false */
/*globals PERSIST_DATABASES: false, initDBPair: false, openTestDB: false, putAfter: false */

"use strict";

var adapters = [
  ['local-1', 'http-1'],
  ['http-1', 'http-2'],
  ['http-1', 'local-1'],
  ['local-1', 'local-2']];
var qunit = module;

var downAdapters = ['local-1'];
var deletedDocAdapters = [['local-1', 'http-1']];

// if we are running under node.js, set things up
// a little differently, and only test the leveldb adapter
if (typeof module !== undefined && module.exports) {
  var Pouch = require('../src/pouch.js');
  var LevelPouch = require('../src/adapters/pouch.leveldb.js');
  var utils = require('./test.utils.js');

  for (var k in utils) {
    global[k] = global[k] || utils[k];
  }
  qunit = QUnit.module;
  downAdapters = [];
}

adapters.map(function(adapters) {

  qunit('replication: ' + adapters[0] + ':' + adapters[1], {
    setup : function () {
      this.name = generateAdapterUrl(adapters[0]);
      this.remote = generateAdapterUrl(adapters[1]);
    },
    teardown: function() {
      if (!PERSIST_DATABASES) {
        Pouch.destroy(this.name);
        Pouch.destroy(this.remote);
      }
    }
  });

  var docs = [
    {_id: "0", integer: 0, string: '0'},
    {_id: "1", integer: 1, string: '1'},
    {_id: "2", integer: 2, string: '2'}
  ];

  asyncTest("Test basic pull replication", function() {
    console.info('Starting Test: Test basic pull replication');
    var self = this;
    initDBPair(this.name, this.remote, function(db, remote) {
      remote.bulkDocs({docs: docs}, {}, function(err, results) {
        db.replicate.from(self.remote, function(err, result) {
          ok(result.ok, 'replication was ok');
          ok(result.docs_written === docs.length, 'correct # docs written');
          start();
        });
      });
    });
  });

  asyncTest("Local DB contains documents", function() {
    console.info('Starting Test: Local DB contains documents');
    var self = this;
    initDBPair(this.name, this.remote, function(db, remote) {
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
    console.info('Starting Test: Test basic push replication');
    var self = this;
    initDBPair(this.name, this.remote, function(db, remote) {
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
    console.info('Starting Test: Test basic push replication take 2');
    var self = this;
    initDBPair(this.name, this.remote, function(db, remote) {
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
    console.info('Starting Test: Test basic push replication sequence tracking');
    var self = this;
    initDBPair(this.name, this.remote, function(db, remote) {
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
    console.info('Starting Test: Test checkpoint');
    var self = this;
    initDBPair(this.name, this.remote, function(db, remote) {
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

  asyncTest("Test checkpoint 2", function() {
    console.info('Starting Test: Test checkpoint 2');
    var self = this;
    var doc = {_id: "3", count: 0};
    initDBPair(this.name, this.remote, function(db, remote) {
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
    console.info('Starting Test: Test checkpoint 3 :)');
    var self = this;
    var doc = {_id: "3", count: 0};
    initDBPair(this.name, this.remote, function(db, remote) {
      db.put(doc, {}, function(err, results) {
        Pouch.replicate(db, remote, {}, function(err, result) {
          ok(result.ok, 'replication was ok');
          doc._rev = results.rev;
          doc.count++;
          db.put(doc, {}, function(err, results) {
            doc._rev = results.rev;
            doc.count++;
            db.put(doc, {}, function(err, results) {
              Pouch.replicate(db, remote, {}, function(err, result) {
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
    initDBPair(this.name, this.remote, function(db1, db2) {
      var doc = {
        _id: "foo",
        _rev: "1-a",
        value: "generic"
      };
      db1.put(doc, {new_edits: false}, function(err, res) {
        db2.put(doc, {new_edits: false}, function(err, res) {
          putAfter(db2, {_id: "foo", _rev: "2-b", value: "db2"}, "1-a", function(err, res) {
            putAfter(db1, {_id: "foo", _rev: "2-c", value: "whatever"}, "1-a", function(err,res) {
              putAfter(db1, {_id: "foo", _rev: "3-c", value: "db1"}, "2-c", function(err, res) {
                db1.get("foo", function(err, doc) {
                  ok(doc.value === "db1", "db1 has correct value (get)");
                  db2.get("foo", function(err, doc) {
                    ok(doc.value === "db2", "db2 has correct value (get)");
                    Pouch.replicate(db1, db2, function() {
                      Pouch.replicate(db2, db1, function() {
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
    console.info('Starting Test: Test basic conflict');
    var self = this;
    var doc1 = {_id: 'adoc', foo:'bar'};
    var doc2 = {_id: 'adoc', bar:'baz'};
    initDBPair(this.name, this.remote, function(db, remote) {
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
    console.info("Starting Test: Testing _conflicts key");

    var self = this;
    var doc1 = {_id: 'adoc', foo:'bar'};
    var doc2 = {_id: 'adoc', bar:'baz'};
    initDBPair(this.name, this.remote, function(db, remote) {
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


  asyncTest("Test basic continous pull replication", function() {
    console.info('Starting Test: Test basic continous pull replication');
    var self = this;
    var doc1 = {_id: 'adoc', foo:'bar'};
    initDBPair(this.name, this.remote, function(db, remote) {
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

  asyncTest("Test basic continous push replication", function() {
    console.info('Starting Test: Test basic continous push replication');
    var self = this;
    var doc1 = {_id: 'adoc', foo:'bar'};
    initDBPair(this.name, this.remote, function(db, remote) {
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
    console.info('Starting Test: Test cancel pull replication');
    var self = this;
    var doc1 = {_id: 'adoc', foo:'bar'};
    var doc2 = {_id: 'anotherdoc', foo:'baz'};
    initDBPair(this.name, this.remote, function(db, remote) {
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
    console.info('Starting Test: Replication filter');
    var docs1 = [
      {_id: "0", integer: 0},
      {_id: "1", integer: 1},
      {_id: "2", integer: 2},
      {_id: "3", integer: 3}
    ];

    initDBPair(this.name, this.remote, function(db, remote) {
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
    console.info('Starting Test: Replication with different filters');
    var more_docs = [
      {_id: '3', integer: 3, string: '3'},
      {_id: '4', integer: 4, string: '4'}
    ];

    initDBPair(this.name, this.remote, function(db, remote) {
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

  asyncTest("Replication with same filters", function() {
    console.info('Starting Test: Replication with same filters');
    var more_docs = [
      {_id: '3', integer: 3, string: '3'},
      {_id: '4', integer: 4, string: '4'}
    ];

    initDBPair(this.name, this.remote, function(db, remote) {
      remote.bulkDocs({docs: docs}, function(err, info) {
        db.replicate.from(remote, {
          filter: function(doc) { return doc.integer % 2 === 0; }
        }, function(err, response){
          db.allDocs(function(err, docs) {console.log(docs);});
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
    console.info('Starting Test: Replication with deleted doc');

    var docs1 = [
      {_id: "0", integer: 0},
      {_id: "1", integer: 1},
      {_id: "2", integer: 2},
      {_id: "3", integer: 3},
      {_id: "4", integer: 4, _deleted: true}
    ];

    initDBPair(this.name, this.remote, function(db, remote) {
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
    console.info('Starting Test: replication notifications');
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
    initDBPair(this.name, this.remote, function(db, remote) {
      remote.bulkDocs({docs: docs}, {}, function(err, results) {
        db.replicate.from(self.remote, {onChange: onChange});
      });
    });
  });

  asyncTest("Replication with remote conflict", function() {
    var doc = {_id: 'test', test: "Remote 1"},
        winningRev;

    initDBPair(this.name, this.remote, function(db, remote) {
      remote.post(doc, function(err, resp) {
        doc._rev = resp.rev;
        Pouch.replicate(remote, db, function(err, resp) {
          doc.test = "Local 1";
          db.put(doc, function(err, resp) {
            doc.test = "Remote 2";
            remote.put(doc, function(err, resp) {
              doc._rev = resp.rev;
              doc.test = "Remote 3";
              remote.put(doc, function(err, resp) {
                winningRev = resp.rev;
                Pouch.replicate(db, remote, function(err, resp) {
                  Pouch.replicate(remote, db, function(err, resp) {
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

  asyncTest("Replicate large number of docs", function() {
    var docs = [];
    var num = 20;
    for (var i = 0; i < num; i++) {
      docs.push({_id: 'doc_' + i, foo: 'bar_' + i});
    }
    initDBPair(this.name, this.remote, function(db, remote) {
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

});

// test a basic "initialize pouch" scenario when couch instance contains deleted revisions
// currently testing idb-http only
deletedDocAdapters.map(function(adapters) {
  qunit('replication: ' + adapters[0] + ':' + adapters[1], {
    setup : function () {
      this.name = generateAdapterUrl(adapters[0]);
      this.remote = generateAdapterUrl(adapters[1]);
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
            if (err) {
              console.error(err);
            }
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

      openTestDB(remote, function(err, dbr){
        rebuildDocuments(dbr, docs, function(){
          openTestDB(name, function(err, db){
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
    initDBPair(self.name, self.remote, function(){
      // Rinse, repeat our workflow...
      workflow(self.name, self.remote, runs);
    });
  });
});

// This test only needs to run for one configuration, and it slows stuff
// down
downAdapters.map(function(adapter) {

  qunit('replication: ' + adapter, {
    setup : function () {
      this.name = generateAdapterUrl(adapter);
    }
  });

  asyncTest("replicate from down server test", function (){
    expect(1);
    initTestDB(this.name, function(err, db) {
      db.replicate.to('http://infiniterequest.com', function (err, changes) {
        ok(err);
        start();
      });
    });
  });
});
