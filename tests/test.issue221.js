"use strict";

var adapters = [
  ['local-1', 'http-1'],
  ['http-1', 'http-2'],
  ['http-1', 'local-1'],
  ['local-1', 'local-2']
];
var testHelpers = {};
describe('replication + compaction', function () {

  adapters.map(function(adapters) {

    describe(adapters[0] + ':' + adapters[1], function () {
      beforeEach(function() {
        testHelpers.local = testUtils.generateAdapterUrl(adapters[0]);
        testHelpers.remote = testUtils.generateAdapterUrl(adapters[1]);
        PouchDB.enableAllDbs = true;
      });
      afterEach(testUtils.cleanupTestDatabases);

      var doc = { _id: '0', integer: 0 };

      it('Testing issue #221', function(done) {
        // Create databases.
        testUtils.initDBPair(testHelpers.local, testHelpers.remote, function(local, remote) {
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
                      results._rev.should.equal(correctRev.rev,
                                  'correct rev stored after replication');
                      results.integer.should.equal(1,
                                  'correct content stored after replication');
                      done();
                    });
                  });
                });
              });
            });
          });
        });
      });

      it('Testing issue #221 again', function(done) {
        // Create databases.
        testUtils.initDBPair(testHelpers.local, testHelpers.remote, function(local, remote) {
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
                      results.integer.should.equal(1, 'correct content stored after replication');
                      done();
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
