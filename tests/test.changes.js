/*globals initTestDB: false, emit: true, generateAdapterUrl: false */
/*globals PERSIST_DATABASES: false, initDBPair: false, utils: true */
/*globals ajax: true, LevelPouch: true, putTree: false, deepEqual: false */
/*globals cleanupTestDatabases: false, strictEqual: false, writeDocs: false */

"use strict";

var adapters = ['http-1', 'local-1'];
var qunit = module;
var is_browser = true;
var LevelPouch;

if (typeof module !== undefined && module.exports) {
  Pouch = require('../src/pouch.js');
  LevelPouch = require('../src/adapters/pouch.leveldb.js');
  utils = require('./test.utils.js');

  for (var k in utils) {
    global[k] = global[k] || utils[k];
  }
  qunit = QUnit.module;
  is_browser = false;
}

adapters.map(function(adapter) {

  QUnit.module("changes: " + adapter, {
    setup : function () {
      this.name = generateAdapterUrl(adapter);
      Pouch.enableAllDbs = true;
    },
    teardown: cleanupTestDatabases
  });

  asyncTest("All changes", function () {
    initTestDB(this.name, function(err, db) {
      db.post({test:"somestuff"}, function (err, info) {
        db.changes({
          onChange: function (change) {
            ok(!change.doc, 'If we dont include docs, dont include docs');
            ok(change.seq, 'Received a sequence number');
            start();
          }
        });
      });
    });
  });

  asyncTest("Changes Since", function () {
    var docs = [
      {_id: "0", integer: 0},
      {_id: "1", integer: 1},
      {_id: "2", integer: 2},
      {_id: "3", integer: 3}
    ];
    initTestDB(this.name, function(err, db) {
      db.bulkDocs({docs: docs}, function(err, info) {
        db.changes({
          since: 2,
          complete: function(err, results) {
            equal(results.results.length, 2, 'Partial results');
            start();
          }
        });
      });
    });
  });

  asyncTest("Changes Since and limit", function () {
      var docs = [
      {_id: "0", integer: 0},
      {_id: "1", integer: 1},
      {_id: "2", integer: 2},
      {_id: "3", integer: 3}
    ];
    initTestDB(this.name, function(err, db) {
      db.bulkDocs({docs: docs}, function(err, info) {
        db.changes({
          since: 2,
          limit: 1,
          complete: function(err, results) {
            equal(results.results.length, 1, 'Partial results');
            start();
          }
        });
      });
    });
  });

  asyncTest("Changes limit", function () {
    var docs1 = [
      {_id: "0", integer: 0},
      {_id: "1", integer: 1},
      {_id: "2", integer: 2},
      {_id: "3", integer: 3}
    ];

    var docs2 = [
      {_id: "2", integer: 11},
      {_id: "3", integer: 12}
    ];

    initTestDB(this.name, function(err, db) {
      // we use writeDocs since bulkDocs looks to have undefined
      // order of doing insertions
      writeDocs(db, docs1, function(err, info) {
        docs2[0]._rev = info[2].rev;
        docs2[1]._rev = info[3].rev;
        db.put(docs2[0], function(err, info) {
          db.put(docs2[1], function(err, info) {
            db.changes({
              limit: 2,
              since: 2,
              include_docs: true,
              complete: function(err, results) {
                strictEqual(results.last_seq, 6, 'correct last_seq');

                results = results.results;

                strictEqual(results.length, 2, '2 results');

                strictEqual(results[0].id, '2', 'correct first id');
                strictEqual(results[0].seq, 5, 'correct first seq');
                strictEqual(results[0].doc.integer, 11, 'correct first integer');

                strictEqual(results[1].id, '3', 'correct second id');
                strictEqual(results[1].seq, 6, 'correct second seq');
                strictEqual(results[1].doc.integer, 12, 'correct second integer');

                start();
              }
            });
          });
        });
      });
    });
  });

  asyncTest("Changes limit and filter", function(){
    var docs = [
      {_id: "0", integer: 0},
      {_id: "1", integer: 1},
      {_id: "2", integer: 2},
      {_id: "3", integer: 3},
      {_id: "4", integer: 4},
      {_id: "5", integer: 5},

      {_id: '_design/foo', integer: 4, filters: {
         even: 'function(doc) { return doc.integer % 2 === 1; }'
       }
      }
    ];

    initTestDB(this.name, function(err, db) {
      writeDocs(db, docs, function(err, info) {
        db.changes({
          filter: 'foo/even',
          limit: 2,
          since: 2,
          include_docs: true,
          complete: function(err, results) {
            strictEqual(results.results.length, 2, 'correct # results');

            strictEqual(results.results[0].id, '3', 'correct first id');
            strictEqual(results.results[0].seq, 4, 'correct first seq');
            strictEqual(results.results[0].doc.integer, 3, 'correct first integer');

            strictEqual(results.results[1].id, '5', 'correct second id');
            strictEqual(results.results[1].seq, 6, 'correct second seq');
            strictEqual(results.results[1].doc.integer, 5, 'correct second integer');
            start();
          }
        });
      });
    });
  });

  asyncTest("Changes last_seq", function() {
    var docs = [
      {_id: "0", integer: 0},
      {_id: "1", integer: 1},
      {_id: "2", integer: 2},
      {_id: "3", integer: 3},

      {_id: '_design/foo', integer: 4, filters: {
         even: 'function(doc) { return doc.integer % 2 === 1; }'
       }
      }
    ];

    initTestDB(this.name, function(err, db) {
      db.changes({
        complete: function(err, results) {
          strictEqual(results.last_seq, 0, 'correct last_seq');
          db.bulkDocs({docs: docs}, function(err, info) {
            db.changes({
              complete: function(err, results) {
                strictEqual(results.last_seq, 5, 'correct last_seq');
                db.changes({
                  filter: 'foo/even',
                  complete: function(err, results) {
                    strictEqual(results.last_seq, 5, 'filter does not change last_seq');
                    strictEqual(results.results.length, 2, 'correct # of changes'); 
                    start();
                  }
                });
              }
            });
          });
        }
      });
    });
  });

  asyncTest("Changes with style = all_docs", function() {
    var simpleTree = [
      [
        {_id: "foo", _rev: "1-a", value: "foo a"},
        {_id: "foo", _rev: "2-b", value: "foo b"},
        {_id: "foo", _rev: "3-c", value: "foo c"}
    ],
    [
      {_id: "foo", _rev: "1-a", value: "foo a"},
      {_id: "foo", _rev: "2-d", value: "foo d"},
      {_id: "foo", _rev: "3-e", value: "foo e"},
      {_id: "foo", _rev: "4-f", value: "foo f"}
    ],
    [
      {_id: "foo", _rev: "1-a", value: "foo a"},
      {_id: "foo", _rev: "2-g", value: "foo g", _deleted: true}
    ]
    ];

    initTestDB(this.name, function(err, db) {
      putTree(db, simpleTree, function() {
        db.changes({
          // without specifying all_docs it should return only winning rev
          complete: function(err, res) {
            strictEqual(res.results[0].changes.length, 1, 'only one el in changes');
            strictEqual(res.results[0].changes[0].rev, '4-f', 'which is winning rev');

            db.changes({
              style: "all_docs",
              complete: function(err, res) {
                strictEqual(res.results[0].changes.length, 3, 'correct changes size');

                var changes = res.results[0].changes;
                changes.sort(function(a, b){
                  return a.rev < b.rev;
                });

                deepEqual(changes[0], {rev: "4-f"}, 'correct rev');
                deepEqual(changes[1], {rev: "3-c"}, 'correct rev');
                deepEqual(changes[2], {rev: "2-g"}, 'correct rev');

                start();
              }
            });
          }
        });
      });
    });
  });

  asyncTest("Changes limit = 0", function () {
      var docs = [
      {_id: "0", integer: 0},
      {_id: "1", integer: 1},
      {_id: "2", integer: 2},
      {_id: "3", integer: 3}
    ];
    initTestDB(this.name, function(err, db) {
      db.bulkDocs({docs: docs}, function(err, info) {
        db.changes({
          limit: 0,
          complete: function(err, results) {
            equal(results.results.length, 1, 'Partial results');
            start();
          }
        });
      });
    });
  });

  // Note for the following test that CouchDB's implementation of /_changes
  // with `descending=true` ignores any `since` parameter.
  asyncTest("Descending changes", function () {
    initTestDB(this.name, function(err, db) {
      db.post({ _id: "0", test: "ing" }, function (err, res) {
        db.post({ _id: "1", test: "ing" }, function (err, res) {
          db.post({ _id: "2", test: "ing" }, function (err, res) {
            db.changes({
              descending: true,
              since: 1,
              complete: function(err, results) {
                equal(results.results.length, 3);
                var ids = ["2", "1", "0"];
                results.results.forEach(function (row, i) {
                  equal(row.id, ids[i], 'All results, descending order');
                });
                start();
              }
            });
          });
        });
      });
    });
  });

  asyncTest("Changes doc", function () {
    initTestDB(this.name, function(err, db) {
      db.post({test:"somestuff"}, function (err, info) {
        db.changes({
          include_docs: true,
          onChange: function (change) {
            ok(change.doc);
            equal(change.doc._id, change.id);
            equal(change.doc._rev, change.changes[change.changes.length - 1].rev);
            start();
          }
        });
      });
    });
  });

  asyncTest("Continuous changes", function() {
    initTestDB(this.name, function(err, db) {
      var count = 0;
      var changes = db.changes({
        onChange: function(change) {
          count += 1;
          ok(!change.doc, 'If we dont include docs, dont include docs');
          equal(count, 1, 'Only receive a single change');
          changes.cancel();
          start();
        },
        continuous: true
      });
      db.post({test:"adoc"});
    });
  });

  asyncTest("Multiple watchers", function() {
    initTestDB(this.name, function(err, db) {
      var count = 0;
      function checkCount() {
        equal(count, 2, 'Should have received exactly one change per listener');
        start();
      }
      var changes1 = db.changes({
        onChange: function(change) {
          count += 1;
          changes1.cancel();
          changes1 = null;
          if (!changes2) {
            checkCount();
          }
        },
        continuous: true
      });
      var changes2 = db.changes({
        onChange: function(change) {
          count += 1;
          changes2.cancel();
          changes2 = null;
          if (!changes1) {
            checkCount();
          }
        },
        continuous: true
      });
      db.post({test:"adoc"});
    });
  });

  if (is_browser) {
    asyncTest("Continuous changes across windows", function() {
      var search = window.location.search
        .replace(/[?&]testFiles=[^&]+/, '')
        .replace(/[?&]testNumber=[^&]+/, '')
        .replace(/[?&]dbname=[^&]+/, '') +
          '&testFiles=postTest.js&dbname=' + encodeURIComponent(this.name);
      initTestDB(this.name, function(err, db) {
        var count = 0;
        var tab;
        var changes = db.changes({
          onChange: function(change) {
            count += 1;
            equal(count, 1, 'Received a single change');
            changes.cancel();
            if (tab) {
              tab.close();
            }
            start();
          },
          continuous: true
        });
        var iframe = document.createElement('iframe');
        iframe.src = 'test.html?' + search.replace(/^[?&]+/, '');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
      });
    });
  }

  asyncTest("Continuous changes doc", function() {
    initTestDB(this.name, function(err, db) {
      var changes = db.changes({
        onChange: function(change) {
          ok(change.doc, 'doc included');
          ok(change.doc._rev, 'rev included');
          changes.cancel();
          start();
        },
        continuous: true,
        include_docs: true
      });
      db.post({test:"adoc"});
    });
  });

  asyncTest("Cancel changes", function() {
    initTestDB(this.name, function(err, db) {
      var count = 0;
      var changes = db.changes({
        onChange: function(change) {
          count += 1;
          if (count === 1) {
            changes.cancel();
            db.post({test:"another doc"}, function(err, info) {
              // This setTimeout ensures that once we cancel a change we dont recieve
              // subsequent callbacks, so it is needed
              setTimeout(function() {
                equal(count, 1);
                start();
              }, 200);
            });
          }
        },
        continuous: true
      });
      db.post({test:"adoc"});
    });
  });

  asyncTest("Changes filter", function() {

    var docs1 = [
      {_id: "0", integer: 0},
      {_id: "1", integer: 1},
      {_id: "2", integer: 2},
      {_id: "3", integer: 3}
    ];

    var docs2 = [
      {_id: "4", integer: 4},
      {_id: "5", integer: 5},
      {_id: "6", integer: 6},
      {_id: "7", integer: 7}
    ];

    initTestDB(this.name, function(err, db) {
      var count = 0;
      db.bulkDocs({docs: docs1}, function(err, info) {
        var changes = db.changes({
          filter: function(doc) { return doc.integer % 2 === 0; },
          onChange: function(change) {
            count += 1;
            if (count === 4) {
              ok(true, 'We got all the docs');
              changes.cancel();
              start();
            }
          },
          continuous: true
        });
        db.bulkDocs({docs: docs2});
      });
    });
  });

  asyncTest("Changes filter with query params", function() {

    var docs1 = [
      {_id: "0", integer: 0},
      {_id: "1", integer: 1},
      {_id: "2", integer: 2},
      {_id: "3", integer: 3}
    ];

    var docs2 = [
      {_id: "4", integer: 4},
      {_id: "5", integer: 5},
      {_id: "6", integer: 6},
      {_id: "7", integer: 7}
    ];

    var params = {
      "abc": true
    };

    initTestDB(this.name, function(err, db) {
      var count = 0;
      db.bulkDocs({docs: docs1}, function(err, info) {
        var changes = db.changes({
          filter: function(doc, req) {
            if (req.query.abc) {
              return doc.integer % 2 === 0;
            }
          },
          query_params: params,
          onChange: function(change) {
            count += 1;
            if (count === 4) {
              ok(true, 'We got all the docs');
              changes.cancel();
              start();
            }
          },
          continuous: true
        });
        db.bulkDocs({docs: docs2});
      });
    });
  });

  asyncTest("Non-continuous changes filter", function() {

    var docs1 = [
      {_id: "0", integer: 0},
      {_id: "1", integer: 1},
      {_id: "2", integer: 2},
      {_id: "3", integer: 3}
    ];

    initTestDB(this.name, function(err, db) {
      db.bulkDocs({docs: docs1}, function(err, info) {
        db.changes({
          filter: function (doc) {
            return doc.integer % 2 === 0;
          },
          complete: function (err, changes) {
            // Should get docs 0 and 2 if the filter has been applied correctly.
            equal(changes.results.length, 2, "should only get 2 changes");
            start();
          }
        });
      });
    });
  });

  asyncTest("Changes to same doc are grouped", function() {
    var docs1 = [
      {_id: "0", integer: 0},
      {_id: "1", integer: 1},
      {_id: "2", integer: 2},
      {_id: "3", integer: 3}
    ];

    var docs2 = [
      {_id: "2", integer: 11},
      {_id: "3", integer: 12}
    ];

    initTestDB(this.name, function(err, db) {
      db.bulkDocs({docs: docs1}, function(err, info) {
        docs2[0]._rev = info[2].rev;
        docs2[1]._rev = info[3].rev;
        db.put(docs2[0], function(err, info) {
          db.put(docs2[1], function(err, info) {
            db.changes({
              include_docs: true,
              complete: function(err, changes) {
                ok(changes, "got changes");
                ok(changes.results, "changes has results array");
                equal(changes.results.length, 4, "should get only 4 changes");
                equal(changes.results[2].seq, 5, "results have sequence number");
                equal(changes.results[2].id, "2");
                equal(changes.results[2].changes.length, 1, "Should include the current revision for a doc");
                equal(changes.results[2].doc.integer, 11, "Includes correct revision of the doc");

                start();
              }
            });
          });
        });
      });
    });
  });

  asyncTest("Changes with conflicts are handled correctly", function() {
    var docs1 = [
      {_id: "0", integer: 0},
      {_id: "1", integer: 1},
      {_id: "2", integer: 2},
      {_id: "3", integer: 3}
    ];

    var docs2 = [
      {_id: "2", integer: 11},
      {_id: "3", integer: 12}
    ];

    var localname = this.name, remotename = this.name + "-remote";

    initDBPair(localname, remotename, function(localdb, remotedb) {
      localdb.bulkDocs({docs: docs1}, function(err, info) {
        docs2[0]._rev = info[2].rev;
        var rev1 = docs2[1]._rev = info[3].rev;
        localdb.put(docs2[0], function(err, info) {
          localdb.put(docs2[1], function(err, info) {
            var rev2 = info.rev;
            Pouch.replicate(localdb, remotedb, function(err, done) {
              // update remote once, local twice, then replicate from
              // remote to local so the remote losing conflict is later in the tree
              localdb.put({_id: "3", _rev: rev2, integer: 20}, function(err, resp) {
                var rev3local = resp.rev;
                localdb.put({_id: "3", _rev: rev3local, integer: 30}, function(err, resp) {
                  var rev4local = resp.rev;
                  remotedb.put({_id: "3", _rev: rev2, integer: 100}, function(err, resp) {
                    var remoterev = resp.rev;
                    Pouch.replicate(remotedb, localdb, function(err, done) {
                      localdb.changes({
                        include_docs: true,
                        style: 'all_docs',
                        conflicts: true,
                        complete: function(err, changes) {
                          ok(changes, "got changes");
                          ok(changes.results, "changes has results array");
                          equal(changes.results.length, 4, "should get only 4 changes");
                          var ch = changes.results[3];
                          equal(ch.id, "3");
                          equal(ch.changes.length, 2, "Should include both conflicting revisions");
                          equal(ch.doc.integer, 30, "Includes correct value of the doc");
                          equal(ch.doc._rev, rev4local, "Includes correct revision of the doc");
                          deepEqual(ch.changes, [{rev:rev4local}, {rev:remoterev}], "Includes correct changes array");
                          ok(ch.doc._conflicts, "Includes conflicts");
                          equal(ch.doc._conflicts.length, 1, "Should have 1 conflict");
                          equal(ch.doc._conflicts[0], remoterev, "Conflict should be remote rev");

                          start();
                        }
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

  asyncTest("Change entry for a deleted doc", function() {
    var docs1 = [
      {_id: "0", integer: 0},
      {_id: "1", integer: 1},
      {_id: "2", integer: 2},
      {_id: "3", integer: 3}
    ];

    initTestDB(this.name, function(err, db) {
      db.bulkDocs({docs: docs1}, function(err, info) {
        var rev = info[3].rev;
        db.remove({_id: "3", _rev: rev}, function(err, info) {
          db.changes({
            include_docs: true,
            complete: function(err, changes) {
              ok(changes, 'got Changes');
              equal(changes.results.length, 4, "should get only 4 changes");
              var ch = changes.results[3];
              equal(ch.id, "3", "Have correct doc");
              equal(ch.seq, 5, "Have correct sequence");
              equal(ch.deleted, true, "Shows doc as deleted");
              start();
            }
          });
        });
      });
    });
  });

});
