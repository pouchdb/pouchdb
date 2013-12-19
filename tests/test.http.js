"use strict";

var adapter = 'http-1';

if (typeof module !== undefined && module.exports) {
  var PouchDB = require('../lib');
  var testUtils = require('./test.utils.js');
}

var db1 = testUtils.args('db1') || 'http://127.0.0.1:5984/test_db';

QUnit.module("Changes: " + db1, {
  setup: testUtils.cleanDbs(QUnit, [db1]),
  teardown: testUtils.cleanDbs(QUnit, [db1])
});

asyncTest("Create a pouch without DB setup", function() {
  PouchDB.destroy(db1, function() {
    var instantDB = new PouchDB(db1, {skipSetup: true});
    instantDB.post({test:"abc"}, function(err, info) {
      ok(err && err.error === 'not_found', 'Skipped setup of database');
      start();
    });
  });
});


