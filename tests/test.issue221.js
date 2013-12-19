"use strict";

if (typeof module !== undefined && module.exports) {
  var PouchDB = require('../lib');
  var testUtils = require('./test.utils.js');
}

var db1 = testUtils.args('db1') || 'test_db';
var db2 = testUtils.args('db2') || 'test_db2';

QUnit.module("Replication + Compaction: " + db1 + ' -> ' + db2, {
  setup: testUtils.cleanDbs(QUnit, [db1, db2]),
  teardown: testUtils.cleanDbs(QUnit, [db1, db2])
});

var doc = { _id: '0', integer: 0 };

asyncTest('Testing issue #221', function() {
  // Create databases.
  var local = new PouchDB(db1, function() {
    var remote = new PouchDB(db2, function() {
    // Write a doc in CouchDB.
    remote.put(doc, function(err, results) {
      // Update the doc.
      doc._rev = results.rev;
      doc.integer = 1;
      remote.put(doc, function(err, results) {
        // Compact the db.
        remote.compact(function() {
          remote.get(doc._id, {revs_info:true},function(err, data) {
            var correctRev = data._revs_info[0];
            local.replicate.from(remote, function(err, results) {
              // Check the Pouch doc.
              local.get(doc._id, function(err, results) {
                strictEqual(results._rev, correctRev.rev,
                            'correct rev stored after replication');
                strictEqual(results.integer, 1,
                            'correct content stored after replication');
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

asyncTest('Testing issue #221 again', function() {
  var self = this;
  // Create databases.
  var local = new PouchDB(db1, function() {
    var remote = new PouchDB(db2, function() {
    // Write a doc in CouchDB.
    remote.put(doc, function(err, results) {
      doc._rev = results.rev;
      // Second doc so we get 2 revisions from replicate.
      remote.put(doc, function(err, results) {
        doc._rev = results.rev;
        local.replicate.from(remote, function(err, results) {
          doc.integer = 1;
          // One more change
          remote.put(doc, function(err, results) {
            // Testing if second replications fails now
            local.replicate.from(remote, function(err, results) {
              local.get(doc._id, function(err, results) {
                strictEqual(results.integer, 1, 'correct content stored after replication');
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
