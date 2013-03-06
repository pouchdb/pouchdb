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

