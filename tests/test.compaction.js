/*globals initTestDB: false, emit: true, generateAdapterUrl: false */
/*globals PERSIST_DATABASES: false, initDBPair: false, utils: true, putTree: false */
/*globals ajax: true, LevelPouch: true, makeDocs: false, strictEqual: false */
/*globals cleanupTestDatabases: false */

"use strict";

var adapters = ['local-1', 'http-1'];
var autoCompactionAdapters = ['local-1'];

var qunit = module;
var LevelPouch;

// if we are running under node.js, set things up
// a little differently, and only test the leveldb adapter
if (typeof module !== undefined && module.exports) {
  Pouch = require('../src/pouch.js');
  LevelPouch = require('../src/adapters/pouch.leveldb.js');
  utils = require('./test.utils.js');

  for (var k in utils) {
    global[k] = global[k] || utils[k];
  }
  qunit = QUnit.module;
}

adapters.map(function(adapter) {
  qunit('compaction: ' + adapter, {
    setup : function () {
      this.name = generateAdapterUrl(adapter);
      Pouch.enableAllDbs = true;
    },
    teardown: cleanupTestDatabases
  });

  asyncTest('Compation document with no revisions to remove', function() {
    initTestDB(this.name, function(err, db) {
      var doc = {_id: "foo", value: "bar"};
      db.put(doc, function(err, res) {
        db.compact(function(){
          ok(true, "compaction finished");
          db.get("foo", function(err, doc) {
            ok(!err, "document not deleted");
            start();
          });
        });
      });
    });
  });

  asyncTest('Compation on empty db', function() {
    initTestDB(this.name, function(err, db) {
      db.compact(function(){
        ok(true, "compaction finished");
        start();
      });
    });
  });

  asyncTest('Simple compation test', function() {
    initTestDB(this.name, function(err, db) {
      var doc = {_id: "foo", value: "bar"};

      db.post(doc, function(err, res) {
        var rev1 = res.rev;
        doc._rev = rev1;
        doc.value = "baz";
        db.post(doc, function(err, res) {
          var rev2 = res.rev;
          db.compact(function(){
            ok(true, "compaction finished");
            db.get("foo", {rev: rev1}, function(err, doc){
              ok(err.status === 404 && err.error === "not_found", "compacted document is missing");
              db.get("foo", {rev: rev2}, function(err, doc){
                ok(!err, "newest revision does not get compacted");
                start();
              });
            });
          });
        });
      });
    });
  });

  var checkBranch = function(db, docs, callback) {
    function check(i) {
      var doc = docs[i];
      db.get(doc._id, {rev: doc._rev}, function(err, doc) {
        if (i < docs.length - 1) {
          ok(err && err.status === 404, "compacted!");
          check(i+1);
        } else {
          ok(!err, "not compacted!");
          callback();
        }
      });
    }
    check(0);
  };

  var checkTree = function(db, tree, callback) {
    function check(i) {
      checkBranch(db, tree[i], function() {
        if (i < tree.length - 1) {
          check(i + 1);
        } else {
          callback();
        }
      });
    }
    check(0);
  };

  var exampleTree = [
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
      {_id: "foo", _rev: "2-g", value: "foo g"},
      {_id: "foo", _rev: "3-h", value: "foo h"},
      {_id: "foo", _rev: "4-i", value: "foo i"},
      {_id: "foo", _rev: "5-j", _deleted: true, value: "foo j"}
    ]
  ];

  var exampleTree2 = [
    [
      {_id: "bar", _rev: "1-m", value: "bar m"},
      {_id: "bar", _rev: "2-n", value: "bar n"},
      {_id: "bar", _rev: "3-o", _deleted: true, value: "foo o"}
  ],
  [
    {_id: "bar", _rev: "2-n", value: "bar n"},
    {_id: "bar", _rev: "3-p", value: "bar p"},
    {_id: "bar", _rev: "4-r", value: "bar r"},
    {_id: "bar", _rev: "5-s", value: "bar s"}
  ],
  [
    {_id: "bar", _rev: "3-p", value: "bar p"},
    {_id: "bar", _rev: "4-t", value: "bar t"},
    {_id: "bar", _rev: "5-u", value: "bar u"}
  ]
  ];

  asyncTest('Compact more complicated tree', function() {
    initTestDB(this.name, function(err, db) {
      putTree(db, exampleTree, function() {
        db.compact(function() {
          checkTree(db, exampleTree, function() {
            ok(1, "checks finished");
            start();
          });
        });
      });
    });
  });

  asyncTest('Compact two times more complicated tree', function() {
    initTestDB(this.name, function(err, db) {
      putTree(db, exampleTree, function() {
        db.compact(function() {
          db.compact(function() {
            checkTree(db, exampleTree, function() {
              ok(1, "checks finished");
              start();
            });
          });
        });
      });
    });
  });

  asyncTest('Compact database with at least two documents', function() {
    initTestDB(this.name, function(err, db) {
      putTree(db, exampleTree, function() {
        putTree(db, exampleTree2, function() {
          db.compact(function() {
            checkTree(db, exampleTree, function() {
              checkTree(db, exampleTree2, function() {
                ok(1, "checks finished");
                start();
              });
            });
          });
        });
      });
    });
  });

  asyncTest('Compact deleted document', function() {
    initTestDB(this.name, function(err, db) {
      db.put({_id: "foo"}, function(err, res) {
        var firstRev = res.rev;
        db.remove({_id: "foo", _rev: firstRev}, function(err, res) {
          db.compact(function() {
            db.get("foo", {rev: firstRev}, function(err, res) {
              ok(err, "got error");
              strictEqual(err.reason, "missing", "correct reason");
              start();
            });
          });
        });
      });
    });
  });

  if (autoCompactionAdapters.indexOf(adapter) > -1) {
    asyncTest('Auto-compaction test', function() {
      initTestDB(this.name, {auto_compaction: true}, function(err, db) {
        var doc = {_id: "doc", val: "1"};
        db.post(doc, function(err, res) {
          var rev1 = res.rev;
          doc._rev = rev1;
          doc.val = "2";
          db.post(doc, function(err, res) {
            var rev2 = res.rev;
            doc._rev = rev2;
            doc.val = "3";
            db.post(doc, function(err, res) {
              var rev3 = res.rev;
              db.get("doc", {rev: rev1}, function(err, doc) {
                strictEqual(err.status, 404, "compacted document is missing");
                strictEqual(err.error, "not_found", "compacted document is missing");
                db.get("doc", {rev: rev2}, function(err, doc) {
                  ok(!err, "leaf's parent does not get compacted");
                  db.get("doc", {rev: rev3}, function(err, doc) {
                    ok(!err, "leaf revision does not get compacted");
                    start();
                  });
                });
              });
            });
          });
        });
      });
    });
  }
});
