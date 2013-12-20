"use strict";

if (typeof module !== undefined && module.exports) {
  var testUtils = require('./test.utils.js');
  var PouchDB = require('../lib');
}

QUnit.module("Test DB Setup");

asyncTest("Test we can find CouchDB with admin credentials", 2, function() {
  PouchDB.ajax({
    url: testUtils.couchHost() + '/_session'
  }, function(err, res) {
    if (err) {
      ok(false, 'There was an error accessing your CouchDB instance');
      return start();
    }
    ok(res.ok, 'Found CouchDB');
    ok(res.userCtx.roles.indexOf('_admin') !== -1, 'Found admin permissions');
    start();
  });
});
