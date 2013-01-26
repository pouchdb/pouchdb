"use strict";

var adapters = ['local-1', 'http-1'];
var qunit = module;

// if we are running under node.js, set things up
// a little differently, and only test the leveldb adapter
if (typeof module !== undefined && module.exports) {
  var Pouch = require('../src/pouch.js')
    , LevelPouch = require('../src/adapters/pouch.leveldb.js')
    , utils = require('./test.utils.js');

  for (var k in utils) {
    global[k] = global[k] || utils[k];
  }
  adapters = ['leveldb-1', 'http-1'];
  qunit = QUnit.module;
}

adapters.map(function(adapter) {

  qunit('spatial: ' + adapter, {
    setup : function () {
      this.name = generateAdapterUrl(adapter);
    },
    teardown: function() {
      if (!PERSIST_DATABASES) {
        Pouch.destroy(this.name);
      }
    }
  });

  var doc = {
    _id: '_design/foo',
    spatial: {
      test: 'function(doc) { if (doc.key) { emit(doc.key, doc); } }'
    }
  };


  asyncTest("Test basic spatial view", function() {
    initTestDB(this.name, function(err, db) {
    db.bulkDocs({docs: [doc, {foo: 'bar', key: [1]}, { _id: 'volatile', foo: 'baz', key: [2]}]}, {}, function() {
        db.get('volatile', function(_, doc) {
          db.remove(doc, function(_, resp) {
            db.spatial('foo/test', {start_range: [null], end_range: [null]}, function(_, res) {
              equal(res.rows.length, 1, 'Dont include deleted documents');
              res.rows.forEach(function(x, i) {
                ok(x.key, 'view row has a key');
                ok(x.value._rev, 'emitted doc has rev');
                ok(x.value._id, 'emitted doc has id');
              });
              start();
            });
          });
        });
      });
    });
  });

  asyncTest("Test opts.start_range/opts.end_range", function() {
    initTestDB(this.name, function(err, db) {
      db.bulkDocs({docs: [doc, {key: [10, 100]},{key: [20, 200]},{key: [30, 300]},{key: [40, 400]},{key: [50, 500]}]}, {}, function() {
        db.spatial('foo/test', {start_range: [21, 301], end_range: [49, 1000]}, function(_, res) {
          equal(res.rows.length, 1, 'start_range/end_range query 1');
          db.spatial('foo/test', {start_range: [1, 201], end_range: [49, 401]}, function(_, res) {
            equal(res.rows.length, 2, 'start_range/end_range query 2');
            start();
          });
        });
      });
    });
  });
});
