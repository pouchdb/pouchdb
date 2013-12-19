'use strict';

if (typeof module !== undefined && module.exports) {
  var PouchDB = require('../lib');
  var testUtils = require('./test.utils.js');
}

var db1 = testUtils.args('db1') || 'test_db';

QUnit.module("Revs Diff: " + db1, {
  setup: testUtils.cleanDbs(QUnit, [db1]),
  teardown: testUtils.cleanDbs(QUnit, [db1])
});

asyncTest("Test revs diff", function() {
  var revs = [];
  new PouchDB(db1, function(err, db) {
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

asyncTest('Missing docs should be returned with all revisions', function() {
  new PouchDB(db1, function(err, db) {
    // empty database
    var revs = ['1-a', '2-a', '2-b'];
    db.revsDiff({'foo': revs}, function(err, results) {
      ok('foo' in results, 'listed missing revs');
      deepEqual(results.foo.missing, revs, 'listed all revs');
      start();
    });
  });
});

asyncTest('Available onflicting revisions should not be missing (#939)', function() {
  var doc = {_id: '939', _rev: '1-a'};

  function createConflicts(db, callback) {
    db.put(doc, {new_edits: false}, function(err, res) {
      testUtils.putAfter(db, {_id: '939', _rev: '2-a'}, '1-a', function(err, res) {
        testUtils.putAfter(db, {_id: '939', _rev: '2-b'}, '1-a', callback);
      });
    });
  }

  new PouchDB(db1, function(err, db) {
    createConflicts(db, function() {
      db.revsDiff({'939': ['1-a', '2-a', '2-b']}, function(err, results) {
        ok(!('939' in results), 'no missing revs');
        start();
      });
    });
  });
});

asyncTest('Available deleted revisions should not missing (#935)', function() {

  function createDeletedRevision(db, callback) {
    db.put({_id: '935', _rev: '1-a'}, {new_edits: false}, function (err, info) {
      testUtils.putAfter(db, {_id: '935', _rev: '2-a', _deleted: true},
                         '1-a', callback);
    });
  }

  new PouchDB(db1, function(err, db) {
    createDeletedRevision(db, function() {
      db.revsDiff({'935': ['1-a', '2-a']}, function(err, results) {
        ok(!('935' in results), 'should not return the deleted revs');
        start();
      });
    });
  });
});
