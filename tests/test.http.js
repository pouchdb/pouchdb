/*globals initTestDB: false, emit: true, generateAdapterUrl: false */
/*globals PERSIST_DATABASES: false, initDBPair: false, utils: true, Pouch: true */
/*globals ajax: true, cleanupTestDatabases: false, cleanUpDB:false */
/*globals setupAdminAndMemberConfig:false, tearDownAdminAndMemberConfig:false */

'use strict';

var adapter = 'http-1';
var qunit = module;
var HttpPouch;

if (typeof module !== undefined && module.exports) {
  Pouch = require('../src/pouch.js');
  HttpPouch = require('../src/adapters/pouch.http.js');
  utils = require('./test.utils.js');

  for (var k in utils) {
    global[k] = global[k] || utils[k];
  }
  qunit = QUnit.module;
}

qunit('http-adapter', {
  setup: function() {
    stop();
      var self = this;
      generateAdapterUrl(adapter, function(name) {
        self.name = name;
        start();
      });
  },
  teardown: function() {
    stop();
    cleanUpDB(this.name, function () {
      cleanupTestDatabases();
    });
  }
});

asyncTest('Create a pouch without DB setup', 1, function() {
  var name = this.name;
  var instantDB;

  Pouch.destroy(name, function(err, info) {
    instantDB = new Pouch(name, {skipSetup: true});
    instantDB.post({test: 'abc'}, function(err, info) {
      ok(err && err.error === 'not_found', 'Skipped setup of database');
      start();
    });
  });
});
