"use strict";

var adapters = ['local-1'];
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
  adapters = ['leveldb-1', 'http-1']
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

  asyncTest("Test select *", function() {
    initTestDB(this.name, function(err, db) {
      db.bulkDocs({docs: [{foo: "bar", what: "field"}, { _id: "volatile", foo: "baz", 
      what: "test" }]},{},
        function() {
          var queryFun = {
            select: "*",
          };
          db.query(queryFun, function(_, res) {
            equal(res.rows.length, 2, "Correct number of rows");
            console.log(res);
            res.rows.forEach(function(x, i) {
              ok(x._id, "emitted row has id");
              ok(x._rev, "emitted row has key");
              ok(x.foo, "emitted row has foo");
              ok(x.what, "emitted row has what");
            });
            start();
          });
        });
    });
  });

  asyncTest("Test select with one row", function() {
    initTestDB(this.name, function(err, db) {
      db.bulkDocs({docs: [{foo: "bar", what: "field"}, { _id: "volatile", foo: "baz" }]},{},
        function() {
          var queryFun = {
            select: "foo",
          };
          db.query(queryFun, function(_, res) {
            equal(res.rows.length, 2, "Correct number of rows");
            console.log(res);
            res.rows.forEach(function(x, i) {
              equal(Object.keys(x).length, 1, "correct number of columns in row");
              ok(x.foo, "emitted row has foo");
            });
            start();
          });
        });
    });
  });

  asyncTest("Test select with two columns", function() {
    initTestDB(this.name, function(err, db) {
      db.bulkDocs({docs: [{foo: "bar", what: "field"}, { _id: "volatile", foo: "baz" }]},{},
        function() {
          var queryFun = {
            select: "foo, _id",
          };
          db.query(queryFun, function(_, res) {
            equal(res.rows.length, 2, "Correct number of rows");
            console.log(res);
            res.rows.forEach(function(x, i) {
              equal(Object.keys(x).length, 2, "correct number of columns in row");
              ok(x.foo, "emitted row has foo");
              ok(x._id, "emitted row has id");
            });
            start();
          });
        });
    });
  });

  asyncTest("Test select with missing column", function() {
    initTestDB(this.name, function(err, db) {
      db.bulkDocs({docs: [{foo: "bar", what: "field"}, { _id: "volatile", foo: "baz" }]},{},
        function() {
          var queryFun = {
            select: "foo, what, _id",
          };
          db.query(queryFun, function(_, res) {
            equal(res.rows.length, 2, "Correct number of rows");
            console.log(res);
            res.rows.forEach(function(x, i) {
              equal(Object.keys(x).length, 3, "correct number of columns in row");
              ok(x.foo, "emitted row has foo");
              ok(x._id, "emitted row has id");
              //TODO: should this be undefined or something else?
              if (x.what !== undefined){
                ok(x.what, "emitted row has what");
              }
            });
            start();
          });
        });
    });
  });
});
