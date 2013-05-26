/*globals initTestDB: false, emit: true, generateAdapterUrl: false, putTree: false, putBranch: false */
/*globals PERSIST_DATABASES: false, initDBPair: false, utils: true */
/*globals ajax: true, LevelPouch: true, makeDocs: false, strictEqual: false, notStrictEqual: false */
/*globals cleanupTestDatabases: false */

"use strict";

var adapters = ['http-1', 'local-1'];
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

  qunit('get: ' + adapter, {
    setup : function () {
      this.name = generateAdapterUrl(adapter);
      Pouch.enableAllDbs = true;
    },
    teardown: cleanupTestDatabases
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
            strictEqual(err.error, "not_found", "correct error");
            strictEqual(err.reason, "deleted", "correct reason");
            start();
          });
        });
      });
    });
  });

  asyncTest("Get local_seq of document", function() {
    initTestDB(this.name, function(err, db) {
      db.post({test:"somestuff"}, function(err, info1) {
        db.get(info1.id, {local_seq: true}, function(err, res) {
          ok(res);
          strictEqual(res._local_seq, 1);
          db.post({test:"someotherstuff"}, function(err, info2) {
            db.get(info2.id, {local_seq: true}, function(err, res) {
              ok(res);
              strictEqual(res._local_seq, 2);
              start();
            });
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

  asyncTest('Testing get with rev', 10, function() {
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
                  strictEqual(doc._rev, "2-aaa", "rev ok");
                  strictEqual(doc.value, "x", "value ok");
                  db.get("3", {rev: "3-bbb"}, function(err, doc){
                    strictEqual(doc._rev, "3-bbb", "rev ok");
                    strictEqual(doc.value, "y", "value ok");
                    db.get("3", {rev: "4-ccc"}, function(err, doc){
                      strictEqual(doc._rev, "4-ccc", "rev ok");
                      strictEqual(doc.value, "z", "value ok");
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

  asyncTest("Testing rev format", 2, function() {
    var revs = [];
    initTestDB(this.name, function(err, db) {
      db.post({test: "somestuff"}, function (err, info) {
        revs.unshift(info.rev.split('-')[1]);
        db.put({_id: info.id, _rev: info.rev, another: 'test1'}, function(err, info2) {
          revs.unshift(info2.rev.split('-')[1]);
          db.put({_id: info.id, _rev: info2.rev, last: 'test2'}, function(err, info3) {
            revs.unshift(info3.rev.split('-')[1]);
            db.get(info.id, {revs:true}, function(err, doc) {
              strictEqual(doc._revisions.start, 3, 'correct starting position');
              deepEqual(revs, doc._revisions.ids, 'correct revs returned');
              start();
            });
          });
        });
      });
    });
  });

  asyncTest("Test opts.revs=true with rev other than winning", 5, function() {
    initTestDB(this.name, function(err, db) {
      var docs = [
        {_id: "foo", _rev: "1-a", value: "foo a"},
        {_id: "foo", _rev: "2-b", value: "foo b"},
        {_id: "foo", _rev: "3-c", value: "foo c"},
        {_id: "foo", _rev: "4-d", value: "foo d"}
      ];
      putBranch(db, docs, function() {
        db.get("foo", {rev: "3-c", revs: true}, function(err, doc) {
          strictEqual(doc._revisions.ids.length, 3, "correct revisions length");
          strictEqual(doc._revisions.start, 3, "correct revisions start");
          strictEqual(doc._revisions.ids[0], "c", "correct rev");
          strictEqual(doc._revisions.ids[1], "b", "correct rev");
          strictEqual(doc._revisions.ids[2], "a", "correct rev");
          start();
        });
      });
    });
  });

  asyncTest("Test opts.revs=true return only winning branch", 6, function() {
    initTestDB(this.name, function(err, db) {
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
        ]
      ];
      putTree(db, simpleTree, function() {
        db.get("foo", {revs: true}, function(err, doc) {
          strictEqual(doc._revisions.ids.length, 4, "correct revisions length");
          strictEqual(doc._revisions.start, 4, "correct revisions start");
          strictEqual(doc._revisions.ids[0], "f", "correct rev");
          strictEqual(doc._revisions.ids[1], "e", "correct rev");
          strictEqual(doc._revisions.ids[2], "d", "correct rev");
          strictEqual(doc._revisions.ids[3], "a", "correct rev");
          start();
        });
      });
    });
  });

  asyncTest("Test get with simple revs_info", 1, function() {
    initTestDB(this.name, function(err, db) {
      db.post({test: "somestuff"}, function (err, info) {
        db.put({_id: info.id, _rev: info.rev, another: 'test'}, function(err, info) {
          db.put({_id: info.id, _rev: info.rev, a: 'change'}, function(err, info2) {
            db.get(info.id, {revs_info:true}, function(err, doc) {
              strictEqual(doc._revs_info.length, 3, 'updated a doc with put');
              start();
            });
          });
        });
      });
    });
  });

  asyncTest("Test get with revs_info on tree", 4, function() {
    initTestDB(this.name, function(err, db) {
      var simpleTree = [
        [
          {_id: "foo", _rev: "1-a", value: "foo a"},
          {_id: "foo", _rev: "2-b", value: "foo b"},
          {_id: "foo", _rev: "3-c", value: "foo c"}
        ],
        [
          {_id: "foo", _rev: "1-a", value: "foo a"},
          {_id: "foo", _rev: "2-d", value: "foo d"},
          {_id: "foo", _rev: "3-e", _deleted: true}
        ]
      ];
      putTree(db, simpleTree, function() {
        db.get("foo", {revs_info: true}, function(err, doc) {
          var revs = doc._revs_info;
          strictEqual(revs.length, 3, "correct number of revs");
          strictEqual(revs[0].rev, "3-c", "rev ok");
          strictEqual(revs[1].rev, "2-b", "rev ok");
          strictEqual(revs[2].rev, "1-a", "rev ok");
          start();
        });
      });
    });
  });

  asyncTest("Test get with revs_info on compacted tree", 7, function() {
    initTestDB(this.name, function(err, db) {
      var simpleTree = [
        [
          {_id: "foo", _rev: "1-a", value: "foo a"},
          {_id: "foo", _rev: "2-b", value: "foo d"},
          {_id: "foo", _rev: "3-c", value: "foo c"}
        ],
        [
          {_id: "foo", _rev: "1-a", value: "foo a"},
          {_id: "foo", _rev: "2-d", value: "foo d"},
          {_id: "foo", _rev: "3-e", _deleted: true}
        ]
      ];
      putTree(db, simpleTree, function() {
        db.compact(function(err, ok) {
          db.get("foo", {revs_info: true}, function(err, doc) {
            var revs = doc._revs_info;
            strictEqual(revs.length, 3, "correct number of revs");
            strictEqual(revs[0].rev, "3-c", "rev ok");
            strictEqual(revs[0].status, "available", "not compacted");
            strictEqual(revs[1].rev, "2-b", "rev ok");
            strictEqual(revs[1].status, "missing", "compacted");
            strictEqual(revs[2].rev, "1-a", "rev ok");
            strictEqual(revs[2].status, "missing", "compacted");
            start();
          });
        });
      });
    });
  });


  asyncTest("Test get with conflicts", 3, function() {
    initTestDB(this.name, function(err, db) {
      var simpleTree = [
        [
          {_id: "foo", _rev: "1-a", value: "foo a"},
          {_id: "foo", _rev: "2-b", value: "foo b"}
        ],
        [
          {_id: "foo", _rev: "1-a", value: "foo a"},
          {_id: "foo", _rev: "2-c", value: "foo c"}
        ],
        [
          {_id: "foo", _rev: "1-a", value: "foo a"},
          {_id: "foo", _rev: "2-d", value: "foo d", _deleted: true}
        ]
      ];
      putTree(db, simpleTree, function() {
        db.get("foo", {conflicts: true}, function(err, doc) {
          strictEqual(doc._rev, "2-c", "correct rev");
          strictEqual(doc._conflicts.length, 1, "just one conflict");
          strictEqual(doc._conflicts[0], "2-b", "just one conflict");
          start();
        });
      });
    });
  });

  asyncTest("Retrieve old revision", 6, function() {
    initTestDB(this.name, function(err, db) {
      ok(!err, 'opened the pouch');
      db.post({version: "first"}, function (err, info) {
        var firstrev = info.rev;
        ok(!err, 'saved a doc with post');
        db.put({_id: info.id, _rev: info.rev, version: 'second'}, function(err, info2) {
          ok(!err, 'no error');
          notStrictEqual(info2.rev, info._rev, 'updated a doc with put');
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

  asyncTest('Testing get open_revs="all"', 8, function() {
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
                db.get("3", {open_revs: "all"}, function(err, res){
                  var i;
                  res = res.map(function(row){
                    return row.ok;
                  });
                  res.sort(function(a, b){
                    return a._rev === b._rev ? 0 : a._rev < b._rev ? -1 : 1;
                  });

                  strictEqual(res.length, conflicts.length, 'correct number of open_revs');
                  for (i = 0; i < conflicts.length; i++){
                    strictEqual(conflicts[i]._rev, res[i]._rev, 'correct rev');
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

  asyncTest('Testing get with some open_revs', 11, function() {
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
                db.get("3", {open_revs: ["2-aaa", "5-nonexistent", "3-bbb"]}, function(err, res){
                  var i;
                  res.sort(function(a, b){
                    if (a.ok) {
                      if (b.ok) {
                        var x = a.ok._rev, y = b.ok._rev;
                        return x === y ? 0 : x < y ? -1 : 1;
                      } else {
                        return -1;
                      }
                    }
                    return 1;
                  });

                  strictEqual(res.length, 3, 'correct number of open_revs');

                  ok(res[0].ok, "first key has ok");
                  strictEqual(res[0].ok._rev, "2-aaa", "ok");

                  ok(res[1].ok, "second key has ok");
                  strictEqual(res[1].ok._rev, "3-bbb", "ok");

                  ok(res[2].missing, "third key has missing");
                  strictEqual(res[2].missing, "5-nonexistent", "ok");

                  start();
                });
              });
            });
          });
        });
      });
    });
  });

  asyncTest('Testing get with open_revs and revs', 4, function() {
    initTestDB(this.name, function(err, db) {
      var docs = [
        [
          {_id: "foo", _rev: "1-a", value: "foo a"},
          {_id: "foo", _rev: "2-b", value: "foo b"}
        ],
        [
          {_id: "foo", _rev: "1-a", value: "foo a"},
          {_id: "foo", _rev: "2-c", value: "foo c"}
        ]
      ];
      putTree(db, docs, function() {
        db.get("foo", {open_revs: ["2-b"], revs: true}, function(err, res) {
          var doc = res[0].ok;
          ok(doc, "got doc");
          ok(doc._revisions, "got revisions");
          strictEqual(doc._revisions.ids.length, 2, "got two revs");
          strictEqual(doc._revisions.ids[0], "b", "got correct rev");
          start();
        });
      });
    });
  });

  asyncTest('Testing get with open_revs on nonexistent doc', 3, function() {
    initTestDB(this.name, function(err, db) {
      db.get("nonexistent", {open_revs: ["2-whatever"]}, function(err, res) {
        strictEqual(res.length, 1, "just one result");
        strictEqual(res[0].missing, "2-whatever", "just one result");

        db.get("nonexistent", {open_revs: "all"}, function(err, res) {
          strictEqual(res.length, 0, "no open revisions");
          start();
        });
      });
    });
  });

  asyncTest('Testing get with open_revs with wrong params', 4, function() {
    initTestDB(this.name, function(err, db) {
      db.put({_id: "foo"}, function(err, res) {
        db.get("foo", {open_revs: {"whatever": "which is", "not an array": "or all string"}}, function(err, res) {
          ok(err, "got error");
          strictEqual(err.error, "unknown_error", "correct error"); // unfortunately!

          db.get("foo", {open_revs: ["1-almost", "2-correct", "keys"]}, function(err, res) {
            ok(err, "got error");
            strictEqual(err.error, "bad_request", "correct error");
            start();
          });
        });
      });
    });
  });

});
