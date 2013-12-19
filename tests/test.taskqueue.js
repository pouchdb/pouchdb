"use strict";

if (typeof module !== undefined && module.exports) {
  var PouchDB = require('../lib');
  var testUtils = require('./test.utils.js');
}

var db1 = testUtils.args('db1') || 'test_db';

QUnit.module("basics", {
  setup: testUtils.cleanDbs(QUnit, [db1]),
  teardown: testUtils.cleanDbs(QUnit, [db1])
});

asyncTest("Add a doc", 1, function() {
  var db = new PouchDB(db1);
  db.post({test:"somestuff"}, function (err, info) {
    ok(!err, 'saved a doc with post');
    start();
  });
});

asyncTest("Query", 1, function() {
  var db = new PouchDB(db1);
  var queryFun = {
    map: function(doc) { }
  };
  db.query(queryFun, { reduce: false }, function (_, res) {
    equal(res.rows.length, 0);
    start();
  });
});

asyncTest("Bulk docs", 2, function() {
  var db = new PouchDB(db1);
  db.bulkDocs({docs: [{test:"somestuff"}, {test:"another"}]}, function(err, infos) {
    ok(!infos[0].error);
    ok(!infos[1].error);
    start();
  });
});

asyncTest("Get", 1, function() {
  var db = new PouchDB(db1);
  db.get('0', function(err, res) {
    ok(err);
    start();
  });
});

asyncTest("Info", 2, function() {
  var db = new PouchDB(db1);
  db.info(function(err, info) {
    ok(info.doc_count === 0);
    ok(info.update_seq === 0);
    start();
  });
});
