"use strict";

if (typeof module !== undefined && module.exports) {
  var PouchDB = require('../lib');
  var testUtils = require('./test.utils.js');
}

function makeDocs(start, end, templateDoc) {
  var templateDocSrc = templateDoc ? JSON.stringify(templateDoc) : "{}";
  if (end === undefined) {
    end = start;
    start = 0;
  }
  var docs = [];
  for (var i = start; i < end; i++) {
    /*jshint evil:true */
    var newDoc = eval("(" + templateDocSrc + ")");
    newDoc._id = (i).toString();
    newDoc.integer = i;
    newDoc.string = (i).toString();
    docs.push(newDoc);
  }
  return docs;
}

var db1 = testUtils.args('db1') || 'test_db';

QUnit.module("basics", {
  setup: testUtils.cleanDbs(QUnit, [db1]),
  teardown: testUtils.cleanDbs(QUnit, [db1])
});

var authors = [
  {name: 'Dale Harvey', commits: 253},
  {name: 'Mikeal Rogers', commits: 42},
  {name: 'Johannes J. Schmidt', commits: 13},
  {name: 'Randall Leeds', commits: 9}
];

asyncTest('Testing bulk docs', function() {
  new PouchDB(db1, function(err, db) {
    var docs = makeDocs(5);
    db.bulkDocs({docs: docs}, function(err, results) {
      ok(results.length === 5, 'results length matches');
      for (var i = 0; i < 5; i++) {
        ok(results[i].id === docs[i]._id, 'id matches');
        ok(results[i].rev, 'rev is set');
        // Update the doc
        docs[i]._rev = results[i].rev;
        docs[i].string = docs[i].string + ".00";
      }
      db.bulkDocs({docs: docs}, function(err, results) {
        ok(results.length === 5, 'results length matches');
        for (i = 0; i < 5; i++) {
          ok(results[i].id === i.toString(), 'id matches again');
          // set the delete flag to delete the docs in the next step
          docs[i]._rev = results[i].rev;
          docs[i]._deleted = true;
        }
        db.put(docs[0], function(err, doc) {
          db.bulkDocs({docs: docs}, function(err, results) {
            ok(results[0].error === 'conflict', 'First doc should be in conflict');
            ok(typeof results[0].rev === "undefined", 'no rev in conflict');
            for (i = 1; i < 5; i++) {
              ok(results[i].id === i.toString());
              ok(results[i].rev);
            }
            start();
          });
        });
      });
    });
  });
});

asyncTest('No id in bulk docs', function() {
  new PouchDB(db1, function(err, db) {
    var newdoc = {"_id": "foobar", "body": "baz"};
    db.put(newdoc, function(err, doc) {
      ok(doc.ok);
      var docs = [
        {"_id": newdoc._id, "_rev": newdoc._rev, "body": "blam"},
        {"_id": newdoc._id, "_rev": newdoc._rev, "_deleted": true}
      ];
      db.bulkDocs({docs: docs}, function(err, results) {
        ok(results[0].error === 'conflict' || results[1].error === 'conflict');
        start();
      });
    });
  });
});

asyncTest('No _rev and new_edits=false', function() {
  new PouchDB(db1, function(err, db) {
    var docs = [
      {_id: "foo", integer: 1}
    ];
    db.bulkDocs({docs: docs}, {new_edits: false}, function(err, res) {
      ok(err, "error reported");
      start();
    });
  });
});

asyncTest("Test errors on invalid doc id", function() {
  var docs = [
    {'_id': '_invalid', foo: 'bar'}
  ];
  new PouchDB(db1, function(err, db) {
    db.bulkDocs({docs: docs}, function(err, info) {
      equal(err.error, 'bad_request', 'correct error returned');
      ok(!info, 'info is empty');
      start();
    });
  });
});

asyncTest("Test two errors on invalid doc id", function() {
  var docs = [
    {'_id': '_invalid', foo: 'bar'},
    {'_id': 123, foo: 'bar'}
  ];
  new PouchDB(db1, function(err, db) {
    db.bulkDocs({docs: docs}, function(err, info) {
      equal(err.error, 'bad_request', 'correct error returned');
      equal(err.reason, PouchDB.Errors.RESERVED_ID.reason, 'correct error message returned');
      ok(!info, 'info is empty');
      start();
    });
  });
});

asyncTest('No docs', function() {
  new PouchDB(db1, function(err, db) {
    db.bulkDocs({"doc": [{"foo":"bar"}]}, function(err, result) {
      ok(err.status === 400);
      ok(err.error === 'bad_request');
      ok(err.reason === "Missing JSON list of 'docs'");
      start();
    });
  });
});

asyncTest('Jira 911', function() {
  new PouchDB(db1, function(err, db) {
    var docs = [
      {"_id":"0", "a" : 0},
      {"_id":"1", "a" : 1},
      {"_id":"1", "a" : 1},
      {"_id":"3", "a" : 3}
    ];
    db.bulkDocs({docs: docs}, function(err, results) {
      ok(results[1].id === "1", 'check ordering');
      ok(results[1].error === undefined, 'first id succeded');
      ok(results[2].error === "conflict", 'second conflicted');
      ok(results.length === 4, 'got right amount of results');
      start();
    });
  });
});

asyncTest('Test multiple bulkdocs', function() {
  new PouchDB(db1, function(err, db) {
    db.bulkDocs({docs: authors}, function (err, res) {
      db.bulkDocs({docs: authors}, function (err, res) {
        db.allDocs(function(err, result) {
          ok(result.total_rows === 8, 'correct number of results');
          start();
        });
      });
    });
  });
});

asyncTest('Bulk with new_edits=false', function() {
  new PouchDB(db1, function(err, db) {
    var docs = [
      {"_id":"foo","_rev":"2-x","_revisions":
       {"start":2,"ids":["x","a"]}
      },
      {"_id":"foo","_rev":"2-y","_revisions":
       {"start":2,"ids":["y","a"]}
      }
    ];
    db.bulkDocs({docs: docs}, {new_edits: false}, function(err, res){
      //ok(res.length === 0, "empty array returned");
      db.get("foo", {open_revs: "all"}, function(err, res){
        ok(res[0].ok._rev === "2-x", "doc1 ok");
        ok(res[1].ok._rev === "2-y", "doc2 ok");
        start();
      });
    });
  });
});

asyncTest('656 regression in handling deleted docs', function() {
  new PouchDB(db1, function(err, db) {
    db.bulkDocs({docs: [{_id: "foo", _rev: "1-a", _deleted: true}]},
                {new_edits: false}, function(err, res){
      db.get("foo", function(err, res) {
        ok(err, "deleted");
        start();
      });
    });
  });
});
