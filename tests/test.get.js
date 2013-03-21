/*globals initTestDB: false, emit: true, generateAdapterUrl: false */
/*globals PERSIST_DATABASES: false, initDBPair: false, utils: true */
/*globals ajax: true, LevelPouch: true, makeDocs: false */

"use strict";

var adapters = ['http-1', 'local-1'];
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

adapters.map(function(adapter) {

  qunit('get: ' + adapter, {
    setup : function () {
      this.name = generateAdapterUrl(adapter);
    },
    teardown: function() {
      if (!PERSIST_DATABASES) {
        Pouch.destroy(this.name);
      }
    }
  });

  var origDocs = [
    {_id:"0",a:1,b:1},
    {_id:"3",a:4,b:16},
    {_id:"1",a:2,b:4},
    {_id:"2",a:3,b:9}
  ];

  function writeDocs(db, docs, callback) {
    if (!docs.length) {
      return callback();
    }
    var doc = docs.shift();
    db.put(doc, function(err, doc) {
      ok(doc.ok, 'docwrite returned ok');
      writeDocs(db, docs, callback);
    });
  }

  asyncTest("Get doc", 2, function() {
    initTestDB(this.name, function(err, db) {
      db.post({test:"somestuff"}, function(err, info) {
        db.get(info.id, function(err, doc) {
          ok(doc.test);
          db.get(info.id+'asdf', function(err) {
            ok(err.error);
            start();
          });
        });
      });
    });
  });

  asyncTest("Get design doc", 2, function() {
    initTestDB(this.name, function(err, db) {
      db.put({_id: '_design/someid', test:"somestuff"}, function(err, info) {
        db.get(info.id, function(err, doc) {
          ok(doc.test);
          db.get(info.id+'asdf', function(err) {
            ok(err.error);
            start();
          });
        });
      });
    });
  });

  asyncTest("Check error of deleted document", 2, function() {
    initTestDB(this.name, function(err, db) {
      db.post({test:"somestuff"}, function(err, info) {
        db.remove({_id:info.id, _rev:info.rev}, function(err, res) {
          db.get(info.id, function(err, res) {
            ok(err.error === "not_found", "correct error");
            ok(err.reason === "deleted", "correct reason");
            start();
          });
        });
      });
    });
  });

  asyncTest("Get revisions of removed doc", 1, function() {
    initTestDB(this.name, function(err, db) {
      db.post({test:"somestuff"}, function(err, info) {
        var rev = info.rev;
        db.remove({test:"somestuff", _id:info.id, _rev:info.rev}, function(doc) {
          db.get(info.id, {rev: rev}, function(err, doc) {
            ok(!err, 'Recieved deleted doc with rev');
            start();
          });
        });
      });
    });
  });

  asyncTest('Testing get with rev', function() {
    initTestDB(this.name, function(err, db) {
      writeDocs(db, JSON.parse(JSON.stringify(origDocs)), function() {
        db.get("3", function(err, parent){
          // add conflicts
          var pRevId = parent._rev.split('-')[1];
          var conflicts = [
            {_id: "3", _rev: "2-aaa", value: "x", _revisions: {start: 2, ids: ["aaa", pRevId]}},
            {_id: "3", _rev: "3-bbb", value: "y", _deleted: true, _revisions: {start: 3, ids: ["bbb", "some", pRevId]}},
            {_id: "3", _rev: "4-ccc", value: "z", _revisions: {start: 4, ids: ["ccc", "even", "more", pRevId]}}
          ];
          db.put(conflicts[0], {new_edits: false}, function(err, doc) {
            db.put(conflicts[1], {new_edits: false}, function(err, doc) {
              db.put(conflicts[2], {new_edits: false}, function(err, doc) {
                db.get("3", {rev: "2-aaa"}, function(err, doc){
                  ok(doc._rev === "2-aaa" && doc.value === "x", 'rev ok');
                  db.get("3", {rev: "3-bbb"}, function(err, doc){
                    ok(doc._rev === "3-bbb" && doc.value === "y", 'rev ok');
                    db.get("3", {rev: "4-ccc"}, function(err, doc){
                      ok(doc._rev === "4-ccc" && doc.value === "z", 'rev ok');
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

  asyncTest("Testing rev format (revs)", 2, function() {
    console.info('testing: Rev format');
    var revs = [];
    initTestDB(this.name, function(err, db) {
      db.post({test: "somestuff"}, function (err, info) {
        revs.unshift(info.rev.split('-')[1]);
        db.put({_id: info.id, _rev: info.rev, another: 'test1'}, function(err, info2) {
          revs.unshift(info2.rev.split('-')[1]);
          db.put({_id: info.id, _rev: info2.rev, last: 'test2'}, function(err, info3) {
            revs.unshift(info3.rev.split('-')[1]);
            db.get(info.id, {revs:true}, function(err, doc) {
              ok(doc._revisions.start === 3, 'correct starting position');
              deepEqual(revs, doc._revisions.ids, 'correct revs returned');
              start();
            });
          });
        });
      });
    });
  });


  asyncTest("Check revisions", 1, function() {
    initTestDB(this.name, function(err, db) {
      db.post({test: "somestuff"}, function (err, info) {
        db.put({_id: info.id, _rev: info.rev, another: 'test'}, function(err, info) {
          db.put({_id: info.id, _rev: info.rev, a: 'change'}, function(err, info2) {
            db.get(info.id, {revs_info:true}, function(err, doc) {
              ok(doc._revs_info.length === 3, 'updated a doc with put');
              start();
            });
          });
        });
      });
    });
  });

  asyncTest("Retrieve old revision", function() {
    initTestDB(this.name, function(err, db) {
      ok(!err, 'opened the pouch');
      db.post({version: "first"}, function (err, info) {
        var firstrev = info.rev;
        ok(!err, 'saved a doc with post');
        db.put({_id: info.id, _rev: info.rev, version: 'second'}, function(err, info2) {
          ok(!err && info2.rev !== info._rev, 'updated a doc with put');
          db.get(info.id, {rev: info.rev}, function(err, oldRev) {
            equal(oldRev.version, 'first', 'Fetched old revision');
            db.get(info.id, {rev: '1-nonexistentRev'}, function(err, doc){
              ok(err, 'Non existent row error correctly reported');
              start();
            });
          });
        });
      });
    });
  });

  asyncTest('testing get with open_revs', function() {
    initTestDB(this.name, function(err, db) {
      writeDocs(db, JSON.parse(JSON.stringify(origDocs)), function() {
        db.get("3", function(err, parent){
          // add conflicts
          var previd = parent._rev.split('-')[1];
          var conflicts = [
            {_id: "3", _rev: "2-aaa", value: "x", _revisions: {start: 2, ids: ["aaa", previd]}},
            {_id: "3", _rev: "3-bbb", value: "y", _deleted: true, _revisions: {start: 3, ids: ["bbb", "some", previd]}},
            {_id: "3", _rev: "4-ccc", value: "z", _revisions: {start: 4, ids: ["ccc", "even", "more", previd]}}
          ];
          db.put(conflicts[0], {new_edits: false}, function(err, doc) {
            db.put(conflicts[1], {new_edits: false}, function(err, doc) {
              db.put(conflicts[2], {new_edits: false}, function(err, doc) {
                db.get("3", {open_revs: "all", revs: true}, function(err, res){
                  var i;
                  res = res.map(function(row){
                    return row.ok;
                  });
                  res.sort(function(a, b){
                    return a._rev === b._rev ? 0 : a._rev < b._rev ? -1 : 1;
                  });

                  ok(res.length === conflicts.length, 'correct number of open_revs');
                  for (i = 0; i < conflicts.length; i++){
                    ok(conflicts[i]._rev === res[i]._rev, 'correct rev');
                  }
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
