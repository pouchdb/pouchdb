/*globals initTestDB: false, emit: true, generateAdapterUrl: false */
/*globals PERSIST_DATABASES: false, initDBPair: false, utils: true */
/*globals ajax: true, LevelPouch: true */

"use strict";

var adapters = [
  ['local-1', 'http-1']
];
var qunit = module;

if (typeof module !== undefined && module.exports) {
  Pouch = require('../src/pouch.js');
  LevelPouch = require('../src/adapters/pouch.leveldb.js');
  utils = require('./test.utils.js');
  
  for (var k in utils) {
    global[k] = global[k] || utils[k];
  }
  qunit = QUnit.module;
}

adapters.map(function(adapters) {

  qunit('replication + compaction', {
    setup: function() {
      this.local = generateAdapterUrl(adapters[0]);
      this.remote = generateAdapterUrl(adapters[1]);
    },
    teardown: function() {
      if (!PERSIST_DATABASES) {
        Pouch.destroy(this.local);
        Pouch.destroy(this.remote);
      }
    }
  });

  var doc = { _id: '0', integer: 0 };

  asyncTest('Testing issue #221', function() {
    var self = this;
    // Feature detection for pouchdb-server
    ajax({ url: 'http://localhost:2020/' }, function (err, ret) {
      if (!ret.couchdb) {
        ok(true, 'Test not applicable to backend.');
        return start();
      }
      // Create databases.
      initDBPair(self.local, self.remote, function(local, remote) {
        // Write a doc in CouchDB.
        remote.put(doc, {}, function(err, results) {
          // Update the doc.
          doc._rev = results.rev;
          doc.integer = 1;
          remote.put(doc, {}, function(err, results) {
            // Compact the db.
            remote.compact(function(data, status, jqXHR) {
              // Wait until compaction has affected the doc.
              var interval;
              var checkDoc = function() {
                remote.get(doc._id,{revs_info:true},function(err, data) {
                  var correctRev = data._revs_info[0];
                  if (data._revs_info[1].status === 'missing') {
                    // We already got a successful compaction, but did a whole
                    // new request before we figured it out, yay races
                    if (!interval) {
                      return;
                    }
                    clearInterval(interval);
                    interval = null;
                    // Replicate to PouchDB.
                    local.replicate.from(remote, function(err, results) {
                      // Check the PouchDB doc.
                      local.get(doc._id, function(err, results) {
                        ok(results._rev === correctRev.rev,
                           'correct rev stored after replication');
                        ok(results.integer === 1,
                           'correct content stored after replication');
                        start();
                      });
                    });
                  }
                });
              };
              interval = setInterval(checkDoc, 100);
            });
          });
        });
      });
    });
  });

  asyncTest('Testing issue #221 again', function() {
    var self = this;
    // Feature detection for pouchdb-server
    ajax({ url: 'http://localhost:2020/' }, function (err, ret) {
      if (!ret.couchdb) {
        ok(true, 'Test not applicable to backend.');
        return start();
      }
      // Create databases.
      initDBPair(self.local, self.remote, function(local, remote) {
        // Write a doc in CouchDB.
        remote.put(doc, {}, function(err, results) {
          doc._rev = results.rev;
          // Second doc so we get 2 revisions from replicate.
          remote.put(doc, {}, function(err, results) {
            doc._rev = results.rev;
            local.replicate.from(remote, function(err, results) {
              doc.integer = 1;
              // One more change
              remote.put(doc, {}, function(err, results) {
                // Testing if second replications fails now
                local.replicate.from(remote, function(err, results) {
                  local.get(doc._id, function(err, results) {
                    ok(results.integer === 1, 'correct content stored after replication');
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
