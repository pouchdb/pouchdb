"use strict";

var adapter = 'http-1';

if (typeof module !== undefined && module.exports) {
  var PouchDB = require('../lib');
  var testUtils = require('./test.utils.js');
}

QUnit.module("http-adapter", {
  setup: function() {
    this.name = testUtils.generateAdapterUrl(adapter);
  },
  teardown: function() {
    if (!testUtils.PERSIST_DATABASES) {
      PouchDB.destroy(this.name);
    }
  }
});



asyncTest("Create a pouch without DB setup", function() {
  var instantDB;
  var name = this.name;
  PouchDB.destroy(name, function() {
    instantDB = new PouchDB(name, {skipSetup: true});
    instantDB.post({test:"abc"}, function(err, info) {
      ok(err && err.name === 'not_found', 'Skipped setup of database');
      start();
    });
  });
});


