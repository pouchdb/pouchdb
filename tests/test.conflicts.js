/*globals initTestDB: false, emit: true, generateAdapterUrl: false */
/*globals PERSIST_DATABASES: false, initDBPair: false, utils: true */
/*globals ajax: true, LevelPouch: true */
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

  qunit('conflicts: ' + adapter, {
    setup : function () {
      this.name = generateAdapterUrl(adapter);
      Pouch.enableAllDbs = true;
    },
    teardown: cleanupTestDatabases
  });

  asyncTest('Testing conflicts', function() {
    initTestDB(this.name, function(err, db) {
      var doc = {_id: 'foo', a:1, b: 1};
      db.put(doc, function(err, res) {
        doc._rev = res.rev;
        ok(res.ok, 'Put first document');
        db.get('foo', function(err, doc2) {
          ok(doc._id === doc2._id && doc._rev && doc2._rev, 'Docs had correct id + rev');
          doc.a = 2;
          doc2.a = 3;
          db.put(doc, function(err, res) {
            ok(res.ok, 'Put second doc');
            db.put(doc2, function(err) {
              ok(err.error === 'conflict', 'Put got a conflicts');
              db.changes({
                complete: function(err, results) {
                  ok(results.results.length === 1, 'We have one entry in changes');
                  doc2._rev = undefined;
                  db.put(doc2, function(err) {
                    ok(err.error === 'conflict', 'Another conflict');
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

  asyncTest('Testing conflicts', function() {
    var doc = {_id: 'fubar', a:1, b: 1};
    initTestDB(this.name, function(err, db) {
      db.put(doc, function(err, ndoc) {
        doc._rev = ndoc.rev;
        db.remove(doc, function() {
          delete doc._rev;
          db.put(doc, function(err, ndoc) {
            if (err) {
              ok(false);
              start();
              return;
            }
            ok(ndoc.ok, 'written previously deleted doc without rev');
            start();
          });
        });
      });
    });
  });

});
