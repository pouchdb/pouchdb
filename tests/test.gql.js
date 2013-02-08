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
          db.gql(queryFun, function(_, res) {
            equal(res.rows.length, 2, "Correct number of rows");
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
          db.gql(queryFun, function(_, res) {
            equal(res.rows.length, 2, "Correct number of rows");
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
          db.gql(queryFun, function(_, res) {
            equal(res.rows.length, 2, "Correct number of rows");
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
          db.gql(queryFun, function(_, res) {
            equal(res.rows.length, 2, "Correct number of rows");
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

  asyncTest("Test where with no results", function() {
    initTestDB(this.name, function(err, db) {
      db.bulkDocs({docs: [{foo: "bar", what: "field"}, { _id: "volatile", foo: "baz" }]},{},
        function() {
          var queryFun = {
            select: "foo, what, _id",
            where: "bravo"
          };
          db.gql(queryFun, function(_, res) {
            equal(res.rows.length, 0, "Correct number of rows");
            start();
          });
        });
    });
  });

  asyncTest("Test where boolean operators and precedence (no parenthesis)", function() {
    initTestDB(this.name, function(err, db) {
      db.bulkDocs({docs: [{charizard: false, charmander: true}, {charizard: true, charmeleon: true }, 
      {charmeleon: true, charmander: true, charizard: false}]},{},
        function() {
          var queryFun = {
            select: "*",
            where: "charizard aNd charmander oR charmeleon"
          };
          db.gql(queryFun, function(_, res) {
            equal(res.rows.length, 2, "Correct number of rows");
            res.rows.forEach(function(x, i) {
              ok(x.charmeleon, "emitted row has charmeleon");
            });
          });
          start();
        });
    });
  });

  asyncTest("Test where boolean operators and precedence (with parenthesis)", function() {
    initTestDB(this.name, function(err, db) {
      db.bulkDocs({docs: [{charizard: false, charmander: true}, {charizard: true, charmeleon: true }, 
      {charmeleon: true, charmander: true, charizard: false}]},{},
        function() {
          var queryFun = {
            select: "*",
            where: "charizard aNd (charmander oR charmeleon)"
          };
          db.gql(queryFun, function(_, res) {
            equal(res.rows.length, 1, "Correct number of rows");
            res.rows.forEach(function(x, i) {
              ok(x.charizard, "emitted row has charizard");
            });
          });
          start();
        });
    });
  });

  asyncTest("Test where boolean operators with not", function() {
    initTestDB(this.name, function(err, db) {
      db.bulkDocs({docs: [{charizard: false, charmander: true}, {charizard: true, charmeleon: false}, 
      {charmeleon: true, charmander: false, charizard: true, bulbasaur: false}, 
      {charmeleon: true, charmander: false, charizard: true, bulbasaur: true}]},{},
        function() {
          var queryFun = {
            select: "*",
            where: "charizard aNd (charmander oR (charmeleon and NOT bulbasaur))"
          };
          db.gql(queryFun, function(_, res) {
            equal(res.rows.length, 1, "Correct number of rows");
            res.rows.forEach(function(x, i) {
              ok(x.charizard, "emitted row has charizard");
              ok(!x.bulbasaur, "emitted row has no bulbasaur");
            });
          });
          start();
        });
    });
  });

  asyncTest("Test where inequalities", function() {
    initTestDB(this.name, function(err, db) {
      db.bulkDocs({docs: [{charizard: 50, charmander: 30, haunter: true}, {charizard: 40, charmander: 50}, 
      {charizard: 700, charmander: 22}]},{},
        function() {
          var queryFun = {
            select: "*",
            where: "charizard >=charmander and (charmander <>  22)"
          };
          db.gql(queryFun, function(_, res) {
            equal(res.rows.length, 1, "Correct number of rows");
            res.rows.forEach(function(x, i) {
              ok(x.haunter, "emitted row has haunter");
            });
          });
          start();
        });
    });
  });

  asyncTest("Test where math", function() {
    initTestDB(this.name, function(err, db) {
      db.bulkDocs({docs: [{charizard: 50, charmander: 24, charmeleon: 2, haunter:true},
      {charizard: 40, charmeleon: .5, charmander: 50}, 
      {charizard: 7, charmeleon: 20, charmander: 15}]},{},
        function() {
          var queryFun = {
            select: "*",
            where: "charizard <=charmander * charmeleon + 2 and (charmander - 7 !=  24/3)"
          };
          db.gql(queryFun, function(_, res) {
            equal(res.rows.length, 1, "Correct number of rows");
            res.rows.forEach(function(x, i) {
              ok(x.haunter, "emitted row has haunter");
            });
          });
          start();
        });
    });
  });
  
});
