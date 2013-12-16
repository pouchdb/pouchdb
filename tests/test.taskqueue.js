"use strict";

var adapters = ['http-1', 'local-1'];

if (typeof module !== undefined && module.exports) {
  var PouchDB = require('../lib');
  var testUtils = require('./test.utils.js');
}

adapters.map(function(adapter) {

  QUnit.module("taskqueue: " + adapter, {
    setup: function() {
      this.name = testUtils.generateAdapterUrl(adapter);
      PouchDB.enableAllDbs = true;
    },
    teardown: testUtils.cleanupTestDatabases
  });

  asyncTest("Add a doc", 1, function() {
    var name = this.name;
    PouchDB.destroy(name, function() {
      var db = testUtils.openTestAsyncDB(name);
      db.post({test:"somestuff"}, function (err, info) {
        ok(!err, 'saved a doc with post');
        start();
      });
    });
  });

  asyncTest("Query", 1, function() {
    var name = this.name;
    PouchDB.destroy(name, function() {
      var db = testUtils.openTestAsyncDB(name);
      var queryFun = {
        map: function(doc) { }
      };
      db.query(queryFun, { reduce: false }, function (_, res) {
        equal(res.rows.length, 0);
        start();
      });
    });
  });

  asyncTest("Bulk docs", 2, function() {
    var name = this.name;
    PouchDB.destroy(name, function() {
      var db = testUtils.openTestAsyncDB(name);

      db.bulkDocs({docs: [{test:"somestuff"}, {test:"another"}]}, function(err, infos) {
        ok(!infos[0].error);
        ok(!infos[1].error);
        start();
      });
    });
  });

  asyncTest("Get", 1, function() {
    var name = this.name;
    PouchDB.destroy(name, function() {
      var db = testUtils.openTestAsyncDB(name);

      db.get('0', function(err, res) {
        ok(err);
        start();
      });
    });
  });

  asyncTest("Info", 2, function() {
    var name = this.name;
    PouchDB.destroy(name, function() {
      var db = testUtils.openTestAsyncDB(name);

      db.info(function(err, info) {
        ok(info.doc_count === 0);
        ok(info.update_seq === 0);
        start();
      });
    });
  });
});
