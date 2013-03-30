/*globals initTestDB: false, emit: true, generateAdapterUrl: false */
/*globals PERSIST_DATABASES: false */
/*globals cleanupTestDatabases: false */

"use strict";

var adapters = ['local-1'];
var qunit = module;

// if we are running under node.js, set things up
// a little differently, and only test the leveldb adapter
if (typeof module !== undefined && module.exports) {
  var Pouch = require('../src/pouch.js'),
  LevelPouch = require('../src/adapters/pouch.leveldb.js'),
  utils = require('./test.utils.js');

  for (var k in utils) {
    global[k] = global[k] || utils[k];
  }
  adapters = ['leveldb-1', 'http-1'];
  qunit = QUnit.module; }

adapters.map(function(adapter) {
  qunit('gql: ' + adapter, {
    setup : function () {
      this.name = generateAdapterUrl(adapter);
      Pouch.enableAllDbs = true;
    },
    teardown: cleanupTestDatabases
  });

  asyncTest("Test select *", function() {
    initTestDB(this.name, function(err, db) {
      db.bulkDocs({docs: [{foo: "bar", what: "field"}, { _id: "volatile", foo: "baz",
      what: "test" }]},{},
        function() {
          var queryFun = {
            select: "*"
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
            select: "foo"
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
            select: "foo, _id"
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
            select: "foo, what, _id"
          };
          db.gql(queryFun, function(_, res) {
            equal(res.rows.length, 2, "Correct number of rows");
            res.rows.forEach(function(x, i) {
              equal(Object.keys(x).length, 3, "correct number of columns in row");
              ok(x.foo, "emitted row has foo");
              ok(x._id, "emitted row has id");
              if (x.what !== null){
                equal(x.what, "field", "What field is correct");
              }
            });
            start();
          });
        });
    });
  });

  asyncTest("Test select with parsing errors", function() {
    initTestDB(this.name, function(err, db) {
      db.bulkDocs(
        {docs: [{foo: "bar", what: "field"}, { _id: "volatile", foo: "baz" }]},{},
        function() {
          var queryFun = {
            select: "foo(, what, _id"
          };
          db.gql(queryFun, function(error, res) {
            equal(error.error, "parsing_error", "Correct error received");
            equal(res, undefined, "Result is not defined");
          });
          start(); });
    });
  });

  asyncTest("Test select with backquotes", function() {
    initTestDB(this.name, function(err, db) {
      db.bulkDocs(
        {docs: [{"name!": "pencil", price: 2, discount: 0.7, vendor: "store1"},
          {"name!": "pen", price:3, discount: 2, vendor: "store2"} ]},{},
          function() {
            var queryFun = {
              select: "`name!`, price-discount, upper(vendor)"
            };
            db.gql(queryFun, function(error, res){
              equal(res.rows.length, 2, "Correct number of rows");
              res.rows.forEach(function(x, i) {
                equal(Object.keys(x).length, 3, "correct number of columns in row");
                if (x['name!'] === "pen") {
                  equal(x["price - discount"], 1, "Correct value for price-discount");
                  equal(x["upper(vendor)"], "STORE2", "Correct value for upper(vendor)");
                } else {
                  equal(x["price - discount"], 1.3, "Correct value for price-discount");
                  equal(x["upper(vendor)"], "STORE1", "Correct value for upper(vendor)");
                }
              });
              start();
            });
          });
    });
  });

  asyncTest("Test not null and select *", function() {
    initTestDB(this.name, function(err, db) {
      db.bulkDocs(
        {docs: [{name: "charmander", type: "Fire"},
          {type: "Fire", attack:"tail whip"},
          {name: "charizard", type: "Fire", attack:"slash"} ]},{},
          function() {
            var queryFun = {
              select: "*",
              where: "type='Fire' and name is not null"
            };
            db.gql(queryFun, function(error, res){
              equal(res.rows.length, 2, "Correct number of rows");
              res.rows.forEach(function(x, i) {
                if (x['name'] === "charizard") {
                  equal(x["attack"], "slash", "Correct value for charizard attack");
                } else {
                  ok(!x["attack"], "Charmander has no attack");
                }
              });
              start();
            });
          });
    });
  });

  asyncTest("Test unwrapped identifier in select", function() {
    initTestDB(this.name, function(err, db) {
      db.bulkDocs(
        {docs: [{charizard: 50, dept: "eng", lunch:"2"}, {charizard: 40, lunch: "1", dept: "market"},
          {charizard: 99, dept: "eng", lunch: 1}, {charizard: 7, dept: "eng", lunch: 2}]},{},
          function() {
            var queryFun = {
              select: "dept, charizard",
              groupBy: "dept",
              pivot: "lunch"
            };
            db.gql(queryFun, function(error, res) {
              equal(error.error, "select_error", "Correct error received");
              equal(res, undefined, "Result is not defined");
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
            start();
          });
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
            start();
          });
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
            start();
          });
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
            start();
          });
        });
    });
  });

  asyncTest("Test where inequalities with strings", function() {
    initTestDB(this.name, function(err, db) {
      db.bulkDocs({docs: [{charizard: 50, charmander: "porygon"}, {charizard: 40, charmander: "Zubat"}]},{},
        function() {
          var queryFun = {
            select: "*",
            where: "charmander > 'abra'"
          };
          db.gql(queryFun, function(_, res) {
            equal(res.rows.length, 1, "Correct number of rows");
            res.rows.forEach(function(x, i) {
              equal(x.charizard, 50, "Correct value for charizard selected");
            });
            start();
          });
        });
    });
  });

  asyncTest("Test where math", function() {
    initTestDB(this.name, function(err, db) {
      db.bulkDocs({docs: [{charizard: 50, charmander: 24, charmeleon: 2, haunter:true},
      {charizard: 40, charmeleon: 0.5, charmander: 50},
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
            start();
          });
        });
    });
  });

  asyncTest("Test aggregation functions", function() {
    initTestDB(this.name, function(err, db) {
      db.bulkDocs({docs: [{charizard: 50}, {charizard: 40}, {charizard: 7}]},{},
        function() {
          var queryFun = {
            select: "max(charizard), min(charizard), average(charizard), count(charizard), sum(charizard)"
          };
          db.gql(queryFun, function(_, res) {
            equal(res.rows.length, 1, "Correct number of rows");
            res.rows.forEach(function(x, i) {
              equal(x["max(charizard)"], 50, "Max computed correctly");
              equal(x["min(charizard)"], 7, "Min computed correctly");
              equal(x["average(charizard)"], (97/3), "Average computed correctly");
              equal(x["count(charizard)"], 3, "Count computed correctly");
              equal(x["sum(charizard)"], 97, "Sum computed correctly");
            });
            start();
          });
        });
    });
  });

  asyncTest("Test null checker", function() {
    initTestDB(this.name, function(err, db) {
      db.bulkDocs({docs: [{charizard: null}, {charmander: 40}, {charizard: 7}, {charizard: false}]},{},
        function() {
          var queryFun = {
            select: "*",
            where: "charizard is not nUlL"
          };
          db.gql(queryFun, function(_, res) {
            equal(res.rows.length, 2, "Correct number of rows");
            res.rows.forEach(function(x, i) {
              if(x.charizard){
                equal(x.charizard, 7, "Correct row selected");
              } else {
                equal(x.charizard, false, "Correct row selected");
              }
            });
            start();
          });
        });
    });
  });

  asyncTest("Test basic group by", function() {
    initTestDB(this.name, function(err, db) {
      db.bulkDocs({docs: [{charizard: 50, charmander: 24, charmeleon: 2, haunter:true},
      {charizard: 40, charmeleon: 2, charmander: 50}, {charizard: 7, charmeleon: 20, charmander: 15}]},{},
        function() {
          var queryFun = {
            select: "max(charizard), charmeleon",
            groupBy: "charmeleon"
          };
          db.gql(queryFun, function(_, res) {
            equal(res.rows.length, 2, "Correct number of rows");
            res.rows.forEach(function(x, i) {
              if(x.charmeleon === 2){
                equal(x["max(charizard)"], 50, "Correct aggregate value for charizard when charmeleon is 2");
              } else {
                equal(x["max(charizard)"], 7, "Correct aggregate value for charizard when charmeleon is 20");
              }
            });
            start();
          });
        });
    });
  });

  asyncTest("Test basic pivot", function() {
    initTestDB(this.name, function(err, db) {
      db.bulkDocs({docs: [{charizard: 50, charmeleon: "hello"}, {charizard: 40, charmeleon: "hello"},
      {charizard: 7, charmeleon: "world", charmander: 15}]},{},
        function() {
          var queryFun = {
            select: "max(charizard)",
            pivot: "charmeleon"
          };
          db.gql(queryFun, function(_, res) {
            equal(res.rows.length, 1, "Correct number of rows");
            res.rows.forEach(function(x, i) {
              equal(x["hello max(charizard)"],50, "Correct aggregate value for charizard, charmeleon is 'hello'");
              equal(x["world max(charizard)"],7, "Correct aggregate value for charizard, charmeleon is 'world'");
            });
            start();
          });
        });
    });
  });

  asyncTest("Test double pivot", function() {
    initTestDB(this.name, function(err, db) {
      db.bulkDocs({docs: [{charizard: 50, charmeleon: "hello", abra: 2},
      {charizard: 40, charmeleon: "hello", abra: 3},
      {charizard: 99, charmeleon: "hello", abra: 3},
      {charizard: 7, charmeleon: "world", charmander: 15, abra: 3}]},{},
        function() {
          var queryFun = {
            select: "max(charizard)",
            pivot: "charmeleon, abra"
          };
          db.gql(queryFun, function(_, res) {
            equal(res.rows.length, 1, "Correct number of rows");
            res.rows.forEach(function(x, i) {
              if(x["hello, 3 max(charizard)"]){
                equal(x["hello, 3 max(charizard)"], 99, "Correct aggregate value for charizard, "+
                "charmeleon is 'hello', abra is 3");
                equal(x["world, 3 max(charizard)"], 7, "Correct aggregate value for charizard, "+
                "charmeleon is 'world', abra is 3");
                equal(x["hello, 2 max(charizard)"], 50, "Correct aggregate value for charizard, "+
                "charmeleon is 'hello', abra is 2");
              } else {
                equal(x["3, hello max(charizard)"], 99, "Correct aggregate value for charizard, "+
                "charmeleon is 'hello', abra is 3");
                equal(x["3, world max(charizard)"], 7, "Correct aggregate value for charizard, "+
                "charmeleon is 'world', abra is 3");
                equal(x["2, hello max(charizard)"], 50, "Correct aggregate value for charizard, "+
                "charmeleon is 'hello', abra is 2");
              }
            });
            start();
          });
        });
    });
  });

  asyncTest("Test pivot clause that shares identifiers with select", function() {
    initTestDB(this.name, function(err, db) {
      db.bulkDocs(
        {docs: [{charizard: 50, dept: "eng", lunch:"2"}, {charizard: 40, lunch: "1", dept: "market"},
          {charizard: 99, dept: "eng", lunch: 1}, {charizard: 7, dept: "eng", lunch: 2}]},{},
          function() {
            var queryFun = {
              select: "dept, max(lunch)",
              groupBy: "dept",
              pivot: "lunch"
            };
            db.gql(queryFun, function(error, res) {
              equal(error.error, "pivot_error", "Correct error received");
              equal(res, undefined, "Result is not defined");
              start();
            });
          });
    });
  });

  asyncTest("Test group by and pivot together", function() {
    initTestDB(this.name, function(err, db) {
      db.bulkDocs(
        {docs: [{charizard: 50, dept: "eng", lunch:"2"}, {charizard: 40, lunch: "1", dept: "market"},
          {charizard: 99, dept: "eng", lunch: 1}, {charizard: 7, dept: "eng", lunch: 2}]},{},
        function() {
          var queryFun = {
            select: "dept, max(charizard)",
            groupBy: "dept",
            pivot: "lunch"
          };
          db.gql(queryFun, function(_, res) {
            equal(res.rows.length, 2, "Correct number of rows");
            res.rows.forEach(function(x, i) {
              if(x.dept === "eng"){
                equal(x["1 max(charizard)"], 99, "Correct aggregate value for charizard where lunch is 1");
                equal(x["2 max(charizard)"], 50, "Correct aggregate value for charizard where lunch is 2");
              } else {
                equal(x["1 max(charizard)"], 40, "Correct aggregate value for charizard where lunch is 1");
              }
            });
            start();
          });
        });
    });
  });

  asyncTest("Test basic label", function() {
    initTestDB(this.name, function(err, db) {
      db.bulkDocs(
        {docs: [{charizard: 50, dept: "eng", lunch:"2"}, {charizard: 40, lunch: "1", dept: "market"},
          {charizard: 99, dept: "eng", lunch: 1}, {charizard: 7, dept: "eng", lunch: 2}]},{},
        function() {
          var queryFun = {
            select: 'upper(dept), charizard',
            label: "upper(dept) 'Department', charizard 'Maximum Charizard!'"
          };
          db.gql(queryFun, function(_, res) {
            equal(res.rows.length, 4, "Correct number of rows");
            res.rows.forEach(function(x, i) {
              ok(x.Department, "Department label applied correctly");
              ok(x["Maximum Charizard!"], "Maximum Charizard! label applied correctly");
              ok(!x.charizard, "Regular charizard label not present.");
            });
            start();
          });
        });
    });
  });
});
