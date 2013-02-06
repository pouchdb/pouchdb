"use strict";

var adapters = ['local-1', 'http-1'];
var qunit = module;

// if we are running under node.js, set things up
// a little differently, and only test the leveldb adapter
if (typeof module !== undefined && module.exports) {
  var Pouch = require('../src/pouch.js')
    , LevelPouch = require('../src/adapters/pouch.leveldb.js')
    , utils = require('./test.utils.js')

  for (var k in utils) {
    global[k] = global[k] || utils[k];
  }
  qunit = QUnit.module;
}

adapters.map(function(adapter) {

  qunit('views: ' + adapter, {
    setup : function () {
      this.name = generateAdapterUrl(adapter);
    },
    teardown: function() {
      if (!PERSIST_DATABASES) {
        Pouch.destroy(this.name);
      }
    }
  });

  asyncTest("Test basic view", function() {
    initTestDB(this.name, function(err, db) {
      db.bulkDocs({docs: [{foo: 'bar'}, { _id: 'volatile', foo: 'baz' }]}, {}, function() {
        var queryFun = {
          map: function(doc) { emit(doc.foo, doc); }
        };
        db.get('volatile', function(_, doc) {
          db.remove(doc, function(_, resp) {
            db.query(queryFun, {include_docs: true, reduce: false}, function(_, res) {
              equal(res.rows.length, 1, 'Dont include deleted documents');
              res.rows.forEach(function(x, i) {
                ok(x.id, 'emitted row has id');
                ok(x.key, 'emitted row has key');
                ok(x.value, 'emitted row has value');
                ok(x.value._rev, 'emitted doc has rev');
                ok(x.doc, 'doc included');
                ok(x.doc && x.doc._rev, 'included doc has rev');
              });
              start();
            });
          });
        });
      });
    });
  });

  asyncTest("Test opts.startkey/opts.endkey", function() {
    initTestDB(this.name, function(err, db) {
      db.bulkDocs({docs: [{key: 'key1'},{key: 'key2'},{key: 'key3'},{key: 'key4'},{key: 'key5'}]}, {}, function() {
        var queryFun = {
          map: function(doc) { emit(doc.key, doc); }
        };
        db.query(queryFun, {reduce: false, startkey: 'key2'}, function(_, res) {
          equal(res.rows.length, 4, 'Startkey is inclusive');
          db.query(queryFun, {reduce: false, endkey: 'key3'}, function(_, res) {
            equal(res.rows.length, 3, 'Endkey is inclusive');
            db.query(queryFun, {reduce: false, startkey: 'key2', endkey: 'key3'}, function(_, res) {
              equal(res.rows.length, 2, 'Startkey and endkey together');
              db.query(queryFun, {reduce: false, startkey: 'key4', endkey: 'key4'}, function(_, res) {
                equal(res.rows.length, 1, 'Startkey=endkey');
                start();
              })
            })
          })
        })
      });
    });
  });

  asyncTest("Test opts.key", function() {
    initTestDB(this.name, function(err, db) {
      db.bulkDocs({docs: [{key: 'key1'},{key: 'key2'},{key: 'key3'},{key: 'key3'}]}, {}, function() {
        var queryFun = {
          map: function(doc) { emit(doc.key, doc); }
        };
        db.query(queryFun, {reduce: false, key: 'key2'}, function(_, res) {
          equal(res.rows.length, 1, 'Doc with key');
          db.query(queryFun, {reduce: false, key: 'key3'}, function(_, res) {
            equal(res.rows.length, 2, 'Multiple docs with key');
            start();
          })
        })
      });
    });
  });

  asyncTest("Test basic view collation", function() {

    var values = [];

    // special values sort before all other types
    values.push(null);
    values.push(false);
    values.push(true);

    // then numbers
    values.push(1);
    values.push(2);
    values.push(3.0);
    values.push(4);

    // then text, case sensitive
    // currently chrome uses ascii ordering and so wont handle capitals properly
    values.push("a");
    //values.push("A");
    values.push("aa");
    values.push("b");
    //values.push("B");
    values.push("ba");
    values.push("bb");

    // then arrays. compared element by element until different.
    // Longer arrays sort after their prefixes
    values.push(["a"]);
    values.push(["b"]);
    values.push(["b","c"]);
    values.push(["b","c", "a"]);
    values.push(["b","d"]);
    values.push(["b","d", "e"]);

    // then object, compares each key value in the list until different.
    // larger objects sort after their subset objects.
    values.push({a:1});
    values.push({a:2});
    values.push({b:1});
    values.push({b:2});
    values.push({b:2, a:1}); // Member order does matter for collation.
    // CouchDB preserves member order
    // but doesn't require that clients will.
    // (this test might fail if used with a js engine
    // that doesn't preserve order)
    values.push({b:2, c:2});

    initTestDB(this.name, function(err, db) {
      var docs = values.map(function(x, i) {
        return {_id: (i).toString(), foo: x};
      });
      db.bulkDocs({docs: docs}, {}, function() {
        var queryFun = {
          map: function(doc) { emit(doc.foo, null); }
        };
        db.query(queryFun, {reduce: false}, function(_, res) {
          res.rows.forEach(function(x, i) {
            ok(JSON.stringify(x.key) === JSON.stringify(values[i]), 'keys collate');
          });
          db.query(queryFun, {descending: true, reduce: false}, function(_, res) {
            res.rows.forEach(function(x, i) {
              ok(JSON.stringify(x.key) === JSON.stringify(values[values.length - 1 - i]),
                 'keys collate descending')
            });
            start();
          });
        });
      });
    });
  });

  asyncTest("Test joins", function() {
    initTestDB(this.name, function(err, db) {
      db.bulkDocs({docs: [{_id: 'mydoc', foo: 'bar'}, { doc_id: 'mydoc' }]}, {}, function() {
        var queryFun = {
          map: function(doc) {
            if (doc.doc_id) {
              emit(doc._id, {_id: doc.doc_id});
            }
          }
        };
        db.query(queryFun, {include_docs: true, reduce: false}, function(_, res) {
          console.log(res);
          ok(res.rows[0].doc, 'doc included');
          equal(res.rows[0].doc._id, 'mydoc', 'mydoc included');
          start();
        });
      });
    });
  });
});
