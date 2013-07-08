/*globals initTestDB: false, emit: true, generateAdapterUrl: false, strictEqual: false */
/*globals PERSIST_DATABASES: false, initDBPair: false, utils: true */
/*globals ajax: true, LevelPouch: true */
/*globals cleanupTestDatabases: false, cleanUpDB:false */

"use strict";

var adapters = [
  ['local-1', 'http-1'],
  ['http-1', 'http-2'],
  ['http-1', 'local-1'],
  ['local-1', 'local-2'],
  ['local-1', 'cors-1'],
  ['http-1', 'cors-2'],
  ['cors-1', 'local-1'],
  ['cors-1', 'http-2'],
  ['cors-1', 'cors-2']
];
var qunit = module;
var LevelPouch;
var HttpPouch;
var CorsPouch;

if (typeof module !== undefined && module.exports) {
  Pouch = require('../src/pouch.js');
  LevelPouch = require('../src/adapters/pouch.leveldb.js');
  HttpPouch = require('../src/adapters/pouch.http.js');
  CorsPouch = require('../src/adapters/pouch.cors.js');
  utils = require('./test.utils.js');

  for (var k in utils) {
    global[k] = global[k] || utils[k];
  }
  qunit = QUnit.module;
}

adapters.map(function(adapters) {

  qunit('replication + compaction: ' + adapters[0] + ':' + adapters[1], {
    setup: function() {
      stop();
      var self = this;
      generateAdapterUrl(adapters[0], function(local) {
        self.local = local;
        generateAdapterUrl(adapters[1], function(remote){
          self.remote = remote;
          Pouch.enableAllDbs = true;
          start();
        });
      });
    },
    teardown: function () {
      stop();
      var self = this;
      cleanUpDB(self.local, function() {
        cleanUpDB(self.remote, function() {
          cleanupTestDatabases();
        });
      });
    }
  });

  var doc = { _id: '0', integer: 0 };

  asyncTest('Testing issue #221', function() {
    var self = this;
    // Create databases.
    initDBPair(self.local, self.remote, function(local, remote) {
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
                // Check the PouchDB doc.
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

  asyncTest('Testing issue #221 again', function() {
    var self = this;
    // Create databases.
    initDBPair(self.local, self.remote, function(local, remote) {
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
