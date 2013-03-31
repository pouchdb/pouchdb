/*globals initTestDB: false, emit: true, generateAdapterUrl: false */
/*globals PERSIST_DATABASES: false, initDBPair: false, utils: true */
/*globals ajax: true, LevelPouch: true */
/*globals cleanupTestDatabases: false */

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
