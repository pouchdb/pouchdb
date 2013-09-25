/*globals initTestDB: false, emit: true, generateAdapterUrl: false */
/*globals PERSIST_DATABASES: false, putAfter */
/*globals cleanupTestDatabases: false */

"use strict";

var adapters = ['http-1', 'local-1'];
var qunit = module;
var LevelPouch;

// if we are running under node.js, set things up
// a little differently, and only test the leveldb adapter
if (typeof module !== undefined && module.exports) {
  var Pouch = require('../src/pouch.js');
  var LevelPouch = require('../src/adapters/pouch.leveldb.js');
  var utils = require('./test.utils.js');

  for (var k in utils) {
    global[k] = global[k] || utils[k];
  }
  qunit = QUnit.module;
}

adapters.map(function(adapter) {

  qunit("revs diff:" + adapter, {
    setup : function () {
      this.name = generateAdapterUrl(adapter);
      Pouch.enableAllDbs = true;
    },
    teardown: cleanupTestDatabases
  });

  asyncTest("Test revs diff", function() {
    var revs = [];
    initTestDB(this.name, function(err, db) {
      db.post({test: "somestuff", _id: 'somestuff'}, function (err, info) {
        revs.push(info.rev);
        db.put({_id: info.id, _rev: info.rev, another: 'test'}, function(err, info2) {
          revs.push(info2.rev);
          db.revsDiff({'somestuff': revs}, function(err, results) {
            ok(!('somestuff' in results), 'werent missing any revs');
            revs.push('2-randomid');
            db.revsDiff({'somestuff': revs}, function(err, results) {
              ok('somestuff' in results, 'listed missing revs');
              ok(results.somestuff.missing.length === 1, 'listed currect number of');
              start();
            });
          });
        });
      });
    });
  });

  asyncTest('Missing docs should be returned with all revisions being asked for',
    function() {
      initTestDB(this.name, function(err, db) {
        // empty database
        var revs = ['1-a', '2-a', '2-b'];
        db.revsDiff({'foo': revs}, function(err, results) {
          ok('foo' in results, 'listed missing revs');
          deepEqual(results.foo.missing, revs, 'listed all revs');
          start();
        });
      });
  });

  asyncTest('Conflicting revisions that are available should not be marked as' +
    ' missing (#939)', function() {
    var doc = {_id: '939', _rev: '1-a'};

    function createConflicts(db, callback) {
      db.put(doc, {new_edits: false}, function(err, res) {
        putAfter(db, {_id: '939', _rev: '2-a'}, '1-a', function(err, res) {
            putAfter(db, {_id: '939', _rev: '2-b'}, '1-a', callback);
        });
      });
    }

    initTestDB(this.name, function(err, db) {
      createConflicts(db, function() {
        db.revsDiff({'939': ['1-a', '2-a', '2-b']}, function(err, results) {
          ok(!('939' in results), 'no missing revs');
          start();
        });
      });
    });
  });

  asyncTest('Deleted revisions that are available should not be marked as' +
    ' missing (#935)', function() {

    function createDeletedRevision(db, callback) {
      db.put({_id: '935', _rev: '1-a'}, {new_edits: false}, function (err, info) {
        putAfter(db, {_id: '935', _rev: '2-a', _deleted: true}, '1-a', callback);
      });
    }

    initTestDB(this.name, function(err, db) {
      createDeletedRevision(db, function() {
        db.revsDiff({'935': ['1-a', '2-a']}, function(err, results) {
          ok(!('935' in results), 'should not return the deleted revs');
          start();
        });
      });
    });
  });
});
