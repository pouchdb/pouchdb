"use strict";

if (typeof module !== undefined && module.exports) {
  var PouchDB = require('../lib');
  var testUtils = require('./test.utils.js');
}

var db1 = testUtils.args('db1') || 'test_db';
var db2 = testUtils.args('db2') || 'test_db2';

QUnit.module("basics", {
  setup: testUtils.cleanDbs(QUnit, [db1, db2]),
  teardown: testUtils.cleanDbs(QUnit, [db1, db2])
});

var docs = [
  {_id: "0", integer: 0, string: '0'},
  {_id: "1", integer: 1, string: '1'},
  {_id: "2", integer: 2, string: '2'}
];

asyncTest("Test basic pull replication", function() {
  new PouchDB(db1, function(err, db) {
    var remote = new PouchDB(db2);
    remote.bulkDocs({docs: docs}, {}, function(err, results) {
      db.replicate.from(db2, function(err, result) {
        ok(result.ok, 'replication was ok');
        ok(result.docs_written === docs.length, 'correct # docs written');
        start();
      });
    });
  });
});


asyncTest("Test basic pull replication plain api", function() {
  new PouchDB(db1, function(err, db) {
    var remote = new PouchDB(db2);
    remote.bulkDocs({docs: docs}, {}, function(err, results) {
      PouchDB.replicate(db2, db1, {}, function(err, result) {
        ok(result.ok, 'replication was ok');
        equal(result.docs_written, docs.length, 'correct # docs written');
        start();
      });
    });
  });
});

asyncTest("Test basic pull replication plain api 2", function() {
  new PouchDB(db1, function(err, db) {
    var remote = new PouchDB(db2);
    remote.bulkDocs({docs: docs}, {}, function(err, results) {
      PouchDB.replicate(db2, db1, {complete: function(err, result) {
        ok(result.ok, 'replication was ok');
        equal(result.docs_written, docs.length, 'correct # docs written');
        start();
      }});
    });
  });
});

asyncTest("Local DB contains documents", function() {
  new PouchDB(db1, function(err, db) {
    var remote = new PouchDB(db2);
    remote.bulkDocs({docs: docs}, {}, function(err, _) {
      db.bulkDocs({docs: docs}, {}, function(err, _) {
        db.replicate.from(db2, function(err, _) {
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
  new PouchDB(db1, function(err, db) {
    var remote = new PouchDB(db2);
    db.bulkDocs({docs: docs}, {}, function(err, results) {
      db.replicate.to(db2, function(err, result) {
        ok(result.ok, 'replication was ok');
        ok(result.docs_written === docs.length, 'correct # docs written');
        start();
      });
    });
  });
});

asyncTest("Test basic push replication take 2", function() {
  new PouchDB(db1, function(err, db) {
    var remote = new PouchDB(db2);
    db.bulkDocs({docs: docs}, {}, function(err, _) {
      db.replicate.to(db2, function(err, _) {
        remote.allDocs(function(err, result) {
          ok(result.rows.length === docs.length, 'correct # docs written');
          start();
        });
      });
    });
  });
});

// asyncTest("Test basic push replication sequence tracking", function() {
//   new PouchDB(db1, function(err, db) {
//     var remote = new PouchDB(db2);
//     var doc1 = {_id: 'adoc', foo:'bar'};
//     db.put(doc1, function(err, result) {
//       db.replicate.to(db2, function(err, result) {
//         equal(result.docs_read, 1, 'correct # changed docs read on first replication');
//         db.replicate.to(db2, function(err, result) {
//           equal(result.docs_read, 0, 'correct # changed docs read on second replication');
//           db.replicate.to(db2, function(err, result) {
//             equal(result.docs_read, 0, 'correct # changed docs read on third replication');
//             start();
//           });
//         });
//       });
//     });
//   });
// });

asyncTest("Test checkpoint", function() {
  new PouchDB(db1, function(err, db) {
    var remote = new PouchDB(db2);
    remote.bulkDocs({docs: docs}, {}, function(err, results) {
      db.replicate.from(db2, function(err, result) {
        ok(result.ok, 'replication was ok');
        ok(result.docs_written === docs.length, 'correct # docs written');
        db.replicate.from(db2, function(err, result) {
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
  new PouchDB(db1, function(err, db) {
    var remote = new PouchDB(db2);
    remote.bulkDocs({docs: docs}, {}, function(err, results) {
      var changeCount = docs.length;
      var changes = db.changes({
        continuous: true,
        onChange: function(change) {
          if (--changeCount) {
            return;
          }
          replication.cancel();
          changes.cancel();
          db.replicate.from(db2, {complete: function(err, details) {
            equal(details.docs_read, 0, 'We restarted from checkpoint');
            start();
          }});
        }
      });
      var replication = db.replicate.from(db2, {continuous: true});
    });
  });
});

asyncTest("Test continuous push checkpoint", function() {
  new PouchDB(db1, function(err, db) {
    var remote = new PouchDB(db2);
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
          db.replicate.to(db2, {complete: function(err, details) {
            equal(details.docs_read, 0, 'We restarted from checkpoint');
            start();
          }});
        }
      });
      var replication = db.replicate.to(db2, {continuous: true});
    });
  });
});

asyncTest("Test checkpoint 2", function() {
  var doc = {_id: "3", count: 0};
  new PouchDB(db1, function(err, db) {
    var remote = new PouchDB(db2);
    remote.put(doc, {}, function(err, results) {
      db.replicate.from(db2, function(err, result) {
        ok(result.ok, 'replication was ok');
        doc._rev = results.rev;
        doc.count++;
        remote.put(doc, {}, function(err, results) {
          doc._rev = results.rev;
          doc.count++;
          remote.put(doc, {}, function(err, results) {
            db.replicate.from(db2, function(err, result) {
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
  var doc = {_id: "3", count: 0};
  new PouchDB(db1, function(err, db) {
    var remote = new PouchDB(db2);
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


// asyncTest('Testing allDocs with some conflicts (issue #468)', function() {
//   // we indeed needed replication to create failing test here!
//   new PouchDB(db1, function(err, db) {
//     var remote = new PouchDB(db2);
//     var doc = {
//       _id: "foo",
//       _rev: "1-a",
//       value: "generic"
//     };
//     db1.put(doc, {new_edits: false}, function(err, res) {
//       db2.put(doc, {new_edits: false}, function(err, res) {
//         testUtils.putAfter(db2, {_id: "foo", _rev: "2-b", value: "db2"}, "1-a", function(err, res) {
//           testUtils.putAfter(db1, {_id: "foo", _rev: "2-c", value: "whatever"}, "1-a", function(err,res) {
//             testUtils.putAfter(db1, {_id: "foo", _rev: "3-c", value: "db1"}, "2-c", function(err, res) {
//               db1.get("foo", function(err, doc) {
//                 ok(doc.value === "db1", "db1 has correct value (get)");
//                 db2.get("foo", function(err, doc) {
//                   ok(doc.value === "db2", "db2 has correct value (get)");
//                   PouchDB.replicate(db1, db2, function() {
//                     PouchDB.replicate(db2, db1, function() {
//                       db1.get("foo", function(err, doc) {
//                         ok(doc.value === "db1", "db1 has correct value (get after replication)");
//                         db2.get("foo", function(err, doc) {
//                           ok(doc.value === "db1", "db2 has correct value (get after replication)");
//                           db1.allDocs({include_docs: true}, function(err, res) { // redundant but we want to test it
//                             ok(res.rows[0].doc.value === "db1", "db1 has correct value (allDocs)");
//                             db2.allDocs({include_docs: true}, function(err, res) {
//                               ok(res.rows[0].doc.value === "db1", "db2 has correct value (allDocs)");

//                               start();
//                             });
//                           });
//                         });
//                       });
//                     });
//                   });
//                 });
//               });
//             });
//           });
//         });
//       });
//     });
//   });
// });


// CouchDB will not generate a conflict here, it uses a deteministic
// method to generate the revision number, however we cannot copy its
// method as it depends on erlangs internal data representation
asyncTest("Test basic conflict", function() {
  var doc1 = {_id: 'adoc', foo:'bar'};
  var doc2 = {_id: 'adoc', bar:'baz'};
  new PouchDB(db1, function(err, db) {
    var remote = new PouchDB(db2);
    db.put(doc1, function(err, localres) {
      remote.put(doc2, function(err, remoteres) {
        db.replicate.to(db2, function(err, _) {
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
  var doc1 = {_id: 'adoc', foo:'bar'};
  var doc2 = {_id: 'adoc', bar:'baz'};
  new PouchDB(db1, function(err, db) {
    var remote = new PouchDB(db2);
    db.put(doc1, function(err, localres) {
      remote.put(doc2, function(err, remoteres) {
        db.replicate.to(db2, function(err, _) {

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
  var doc1 = {_id: 'adoc', foo:'bar'};
  new PouchDB(db1, function(err, db) {
    var remote = new PouchDB(db2);
    remote.bulkDocs({docs: docs}, {}, function(err, results) {
      var count = 0;
      var rep = db.replicate.from(db2, {continuous: true});
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
  var doc1 = {_id: 'adoc', foo:'bar'};
  new PouchDB(db1, function(err, db) {
    var remote = new PouchDB(db2);
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
  var doc1 = {_id: 'adoc', foo:'bar'};
  var doc2 = {_id: 'anotherdoc', foo:'baz'};
  new PouchDB(db1, function(err, db) {
    var remote = new PouchDB(db2);
    remote.bulkDocs({docs: docs}, {}, function(err, results) {
      var count = 0;
      var replicate = db.replicate.from(db2, {continuous: true});
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

  new PouchDB(db1, function(err, db) {
    var remote = new PouchDB(db2);
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

  new PouchDB(db1, function(err, db) {
    var remote = new PouchDB(db2);
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

  new PouchDB(db1, function(err, db) {
    var remote = new PouchDB(db2);
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

  new PouchDB(db1, function(err, db) {
    var remote = new PouchDB(db2);
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

  new PouchDB(db1, function(err, db) {
    var remote = new PouchDB(db2);
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
  var changes = 0;
  var onChange = function(c) {
    changes++;
    ok(true, 'Got change notification');
    if (changes === 3) {
      ok(true, 'Got all change notification');
      start();
    }
  };
  new PouchDB(db1, function(err, db) {
    var remote = new PouchDB(db2);
    remote.bulkDocs({docs: docs}, {}, function(err, results) {
      db.replicate.from(remote, {onChange: onChange});
    });
  });
});

asyncTest("Replication with remote conflict", function() {
  var doc = {_id: 'test', test: "Remote 1"}, winningRev;

  new PouchDB(db1, function(err, db) {
    var remote = new PouchDB(db2);
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

  new PouchDB(db1, function(err, db) {
    var remote = new PouchDB(db2);
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
  var docs = [];
  var num = 30;
  for (var i = 0; i < num; i++) {
    docs.push({_id: 'doc_' + i, foo: 'bar_' + i});
  }
  new PouchDB(db1, function(err, db) {
    var remote = new PouchDB(db2);
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

// asyncTest("Ensure checkpoint after deletion", function() {
//   var db1name = this.name;
//   var adoc = {'_id' :'adoc'};
//   var newdoc = {'_id' :'newdoc'};
//   new PouchDB(db1, function(err, db) {
//     var remote = new PouchDB(db2);
//     db1.post(adoc, function() {
//       PouchDB.replicate(db1, db2, {complete: function() {
//         PouchDB.destroy(db1name, function() {
//           var fresh = new PouchDB(db1name);
//           fresh.post(newdoc, function() {
//             PouchDB.replicate(fresh, db2, {complete: function() {
//               db2.allDocs(function(err, docs) {
//                 equal(docs.rows.length, 2, 'Woot, got both');
//                 start();
//               });
//             }});
//           });
//         });
//       }});
//     });
//   });
// });

asyncTest("issue #909 Filtered replication bails at paging limit", function() {
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
  new PouchDB(db1, function(err, db) {
    var remote = new PouchDB(db2);
    remote.bulkDocs({docs: docs}, {}, function(err, results) {
      db.replicate.from(db2, {continuous: false, doc_ids: docList}, function(err, result) {
        ok(result.ok, 'replication was ok');
        ok(result.docs_written === docList.length, 'correct # docs written');
        start();
      });
    });
  });
});

// test a basic "initialize pouch" scenario when couch instance contains deleted revisions
// currently testing idb-http only
asyncTest("doc count after multiple replications with deleted revisions.", function() {
  ok(true);
  return start();
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

    new PouchDB(db2, function(err, dbr){
      rebuildDocuments(dbr, docs, function(){
        new PouchDB(db1, function(err, db){
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
  new PouchDB(db1, function(err, db) {
    var remote = new PouchDB(db2);
    // Rinse, repeat our workflow...
    workflow(db1, db2, runs);
  });
});

asyncTest("issue #300 rev id unique per doc", 3, function() {
  var docs = [{_id: "a"}, {_id: "b"}];
  new PouchDB(db1, function(err, db) {
    var remote = new PouchDB(db2);
    remote.bulkDocs({docs: docs}, {}, function(err, _){
      db.replicate.from(db2, function(err, _){
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

// asyncTest("issue #585 Store checkpoint on target db.", function() {
//   var docs = [{_id: "a"}, {_id: "b"}];
//   new PouchDB(db1, function(err, db) {
//     var remote = new PouchDB(db2);
//     db.bulkDocs({docs: docs}, {}, function(err, _) {
//       db.replicate.to(db2, function(err, result) {
//         ok(result.docs_written === docs.length, 'docs replicated ok');
//         PouchDB.destroy(db2, function (err, result) {
//           ok(result.ok === true, 'remote was deleted');
//           db.replicate.to(db2, function (err, result) {
//             ok(result.docs_written === docs.length,
//                'docs were written again because target was deleted.');
//             start();
//           });
//         });
//       });
//     });
//   });
// });

// This test only needs to run for one configuration, and it slows stuff
// down
asyncTest("replicate from down server test", function (){
  expect(1);
  new PouchDB(db1, function(err, db) {
    db.replicate.to('http://infiniterequest.com', function (err, changes) {
      ok(err);
      start();
    });
  });
});

// Server side replication via `server: true` between http
var docs = [
  {_id: "0", integer: 0, string: '0'},
  {_id: "1", integer: 1, string: '1'},
  {_id: "2", integer: 2, string: '2'}
];

// asyncTest("Test basic replication", function() {
//   new PouchDB(db1, function(err, db) {
//     db.bulkDocs({docs: docs}, {}, function(err, results) {
//       PouchDB.replicate(db1, db2, {server: true}, function(err, result) {
//         ok(result.ok, 'replication was ok');
//         equal(result.history[0].docs_written, docs.length, 'correct # docs written');
//         start();
//       });
//     });
//   });
// });

// asyncTest("Test cancel continuous replication", function() {
//   var doc1 = {_id: 'adoc', foo:'bar'};
//   var doc2 = {_id: 'anotherdoc', foo:'baz'};
//   new PouchDB(db1, function(err, db) {
//     var remote = new PouchDB(db2);
//     remote.bulkDocs({docs: docs}, {}, function(err, results) {
//       var count = 0;
//       var replicate = db.replicate.from(db2, {server: true, continuous: true});
//       var changes = db.changes({
//         continuous: true,
//         onChange: function(change) {
//           ++count;
//           if (count === 3) {
//             remote.put(doc1);
//           }
//           if (count === 4) {
//             replicate.cancel();
//             remote.put(doc2);
//             // This setTimeout is needed to ensure no further changes come through
//             setTimeout(function() {
//               ok(count === 4, 'got no more docs');
//               changes.cancel();
//               start();
//             }, 500);
//           }
//         }
//       });
//     });
//   });
// });
