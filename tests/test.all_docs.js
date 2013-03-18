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

  qunit('all_docs: ' + adapter, {
    setup : function () {
      this.name = generateAdapterUrl(adapter);
    },
    teardown: function() {
      if (!PERSIST_DATABASES) {
        stop();
        Pouch.destroy(this.name, function() { start(); });
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

  asyncTest('Testing all docs', function() {
    initTestDB(this.name, function(err, db) {
      writeDocs(db, JSON.parse(JSON.stringify(origDocs)), function() {
        db.allDocs(function(err, result) {
          var rows = result.rows;
          ok(result.total_rows === 4, 'correct number of results');
          for(var i=0; i < rows.length; i++) {
            ok(rows[i].id >= "0" && rows[i].id <= "4", 'correct ids');
          }
          db.allDocs({startkey:"2", include_docs: true}, function(err, all) {
            ok(all.rows.length === 2, 'correct number when opts.startkey set');
            ok(all.rows[0].id === "2" && all.rows[1].id, 'correct docs when opts.startkey set');
            // TODO: implement offset
            //ok(all.offset == 2, 'offset correctly set');
            var opts = {startkey: "org.couchdb.user:", endkey: "org.couchdb.user;"};
            db.allDocs(opts, function(err, raw) {
              ok(raw.rows.length === 0, 'raw collation');
              var ids = ["0","3","1","2"];
              db.changes({
                complete: function(err, changes) {
                  changes.results.forEach(function(row, i) {
                    ok(row.id === ids[i], 'seq order');
                  });
                  db.changes({
                    descending: true,
                    complete: function(err, changes) {
                      ids = ["2","1","3","0"];
                      changes.results.forEach(function(row, i) {
                        ok(row.id === ids[i], 'descending=true');
                      });
                      start();
                    }
                  });
                }
              });
            });
          });
        });
      });
    });
  });

  asyncTest('Testing allDocs opts.keys', function() {
    initTestDB(this.name, function(err, db) {
      writeDocs(db, JSON.parse(JSON.stringify(origDocs)), function() {
        var keys = ["3", "1"];
        db.allDocs({keys: keys}, function(err, result) {
          var rows = result.rows;
          ok(rows.length === 2, 'correct number of rows');
          ok(rows[0].id === "3" && rows[1].id === "1", 'correct rows returned');
          keys = ["2", "0", "1000"];
          db.allDocs({keys: keys}, function(err, result) {
            var rows = result.rows;
            ok(rows.length === 3, 'correct number of rows');
            ok(rows[0].key === "2", 'correct first row');
            ok(rows[1].key === "0", 'correct second row');
            ok(rows[2].key === "1000" && rows[2].error === "not_found", 'correct third (non-existent) row - has error field');
            db.allDocs({keys: keys, descending: true}, function(err, result) {
              var rows = result.rows;
              ok(rows.length === 3, 'correct number of rows (desc)');
              ok(rows[2].key === "2", 'correct first row (desc)');
              ok(rows[1].key === "0", 'correct second row (desc)');
              ok(rows[0].key === "1000" && rows[0].error === "not_found", 'correct third (non-existent) row - has error field (desc)');
              db.allDocs({keys: keys, startkey: "a"}, function(err, result) {
                ok(err, 'error correctly reported - startkey is incompatible with keys');
                db.allDocs({keys: keys, endkey: "a"}, function(err, result) {
                  ok(err, 'error correctly reported - endkey is incompatible with keys');
                  db.allDocs({keys: []}, function(err, result) {
                    ok(!err && result.rows.length === 0, 'correct answer if keys is empty');
                    db.get("2", function(err, doc){
                      db.remove(doc, function(err, doc){
                        db.allDocs({keys: keys, include_docs: true}, function(err, result){
                          var rows = result.rows;
                          ok(rows.length === 3, 'correct number of rows');
                          ok(rows[0].key === "2" && rows[0].value.deleted, 'deleted doc reported properly');
                          ok(rows[1].key === "0", 'correct second doc');
                          ok(rows[2].key === "1000" && rows[2].error === "not_found", 'correct missing doc');
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

  asyncTest('Testing deleting in changes', function() {
    initTestDB(this.name, function(err, db) {
      writeDocs(db, JSON.parse(JSON.stringify(origDocs)), function() {
        db.get('1', function(err, doc) {
          db.remove(doc, function(err, deleted) {
            ok(deleted.ok, 'deleted');
            db.changes({
              complete: function(err, changes) {
                ok(changes.results.length === 4);
                ok(changes.results[3].id === "1");
                ok(changes.results[3].deleted);
                start();
              }
            });
          });
        });
      });
    });
  });

  asyncTest('Testing updating in changes', function() {
    initTestDB(this.name, function(err, db) {
      writeDocs(db, JSON.parse(JSON.stringify(origDocs)), function() {
        db.get('3', function(err, doc) {
          doc.updated = 'totally';
          db.put(doc, function(err, doc) {
            db.changes({
              complete: function(err, changes) {
                ok(changes.results.length === 4);
                ok(changes.results[3].id === "3");
                start();
              }
            });
          });
        });
      });
    });
  });

  asyncTest('Testing include docs', function() {
    initTestDB(this.name, function(err, db) {
      writeDocs(db, JSON.parse(JSON.stringify(origDocs)), function() {
        db.changes({
          include_docs: true,
          complete: function(err, changes) {
            equal(changes.results[0].doc.a, 1);
            start();
          }
        });
      });
    });
  });

  asyncTest('Testing conflicts', function() {
    initTestDB(this.name, function(err, db) {
      writeDocs(db, JSON.parse(JSON.stringify(origDocs)), function() {
        // add conflicts
        var conflictDoc1 = {
          _id: "3", _rev: "2-aa01552213fafa022e6167113ed01087", value: "X"
        };
        var conflictDoc2 = {
          _id: "3", _rev: "2-ff01552213fafa022e6167113ed01087", value: "Z"
        };
        db.put(conflictDoc1, {new_edits: false}, function(err, doc) {
          db.put(conflictDoc2, {new_edits: false}, function(err, doc) {
            db.get('3', function(err, winRev) {
              equal(winRev._rev, conflictDoc2._rev, "correct wining revision on get");
              var opts = {include_docs: true, conflicts: true, style: 'all_docs'};
              db.changes({
                include_docs: true,
                conflicts: true,
                style: 'all_docs',
                complete: function(err, changes) {
                  var result = changes.results[3];
                  ok("3" === result.id, 'changes are ordered');
                  equal(3, result.changes.length, 'correct number of changes');
                  ok(result.doc._rev === conflictDoc2._rev,
                     'correct winning revision');
                  equal("3", result.doc._id, 'correct doc id');
                  equal(winRev._rev, result.doc._rev,
                        'include doc has correct rev');
                  equal(true, result.doc._conflicts instanceof Array,
                        'include docs contains conflicts');
                  equal(2, result.doc._conflicts.length, 'correct number of changes');
                  db.allDocs({include_docs: true, conflicts: true}, function(err, res) {
                    var row = res.rows[3];
                    equal(4, res.rows.length, 'correct number of changes');
                    equal("3", row.key, 'correct key');
                    equal("3", row.id, 'correct id');
                    equal(row.value.rev, winRev._rev, 'correct rev');
                    equal(row.doc._rev, winRev._rev, 'correct rev');
                    equal("3", row.doc._id, 'correct order');
                    ok(row.doc._conflicts instanceof Array);
                    equal(2, row.doc._conflicts.length, 'Correct number of conflicts');
                    start();
                  });
                }
              });
            });
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

  asyncTest('Testing get with open_revs', function() {
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

  asyncTest('Test basic collation', function() {
    initTestDB(this.name, function(err, db) {
      var docs = {docs: [{_id: "Z", foo: "Z"}, {_id: "a", foo: "a"}]};
      db.bulkDocs(docs, function(err, res) {
        db.allDocs({startkey: 'Z', endkey: 'Z'}, function(err, result) {
          equal(result.rows.length, 1, 'Exclude a result');
          start();
        });
      });
    });
  });

});
