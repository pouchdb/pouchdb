/*globals initTestDB: false, emit: true, generateAdapterUrl: false */
/*globals PERSIST_DATABASES: false, initDBPair: false, utils: true */
/*globals ajax: true, LevelPouch: true, makeDocs: false */

"use strict";

var adapter = 'local-1';
var qunit = module;

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

qunit('compaction: ' + adapter, {
  setup : function () {
    this.name = generateAdapterUrl(adapter);
  },
  teardown: function() {
    if (!PERSIST_DATABASES) {
      Pouch.destroy(this.name);
    }
  }
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

// docs will be inserted one after another
// starting from root
var insertBranch = function(db, rootRev, docs, callback) {
  function insert(i) {
    var prev = i > 0 ? docs[i-1]._rev : rootRev;
    putAfter(db, docs[i], prev, function() {
      if (i < docs.length - 1) {
        insert(i+1);
      } else {
        callback();
      }
    });
  }
  insert(0);
};

var checkBranch = function(db, docs, callback) {
  function check(i) {
    var doc = docs[i];
    db.get(doc._id, {rev: doc._rev}, function(err, doc) {
      if (i < docs.length - 1) {
        ok(err.status === 404, "compacted!");
        check(i+1);
      } else {
        ok(!err, "not compacted!");
        callback();
      }
    });
  }
  check(0);
};

asyncTest('Compact more complicated tree', function() {
  initTestDB(this.name, function(err, db) {
    var root = 
      {_id: "foo", _rev: "1-a", value: "foo a"};
    var branch1 = [
      {_id: "foo", _rev: "2-b", value: "foo b"},
      {_id: "foo", _rev: "3-c", value: "foo c"}
    ];
    var branch2 = [
      {_id: "foo", _rev: "2-d", value: "foo d"},
      {_id: "foo", _rev: "3-e", value: "foo e"},
      {_id: "foo", _rev: "4-f", value: "foo f"}
    ];
    var branch3 = [
      {_id: "foo", _rev: "2-g", value: "foo g"},
      {_id: "foo", _rev: "3-h", value: "foo h"},
      {_id: "foo", _rev: "4-i", value: "foo i"},
      {_id: "foo", _rev: "5-j", _deleted: true, value: "foo j"}
    ];
    db.put(root, function() {
      insertBranch(db, "1-a", branch1, function() {
        insertBranch(db, "1-a", branch2, function() {
          insertBranch(db, "1-a", branch3, function() {
            db.compact(function() {
              checkBranch(db, branch1, function() {
                checkBranch(db, branch2, function() {
                  checkBranch(db, branch3, function() {
                    ok(1, "checks finished");
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
