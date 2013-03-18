/*globals initTestDB: false, emit: true, generateAdapterUrl: false */
/*globals PERSIST_DATABASES: false, initDBPair: false, utils: true */
/*globals ajax: true, LevelPouch: true */

"use strict";

var adapter = 'http-1';
var qunit = module;

if (typeof module !== undefined && module.exports) {
  Pouch = require('../src/pouch.js');
  LevelPouch = require('../src/adapters/pouch.leveldb.js');
  utils = require('./test.utils.js');

  for (var k in utils) {
    global[k] = global[k] || utils[k];
  }
  qunit = QUnit.module;
}

qunit("http-adapter", {
  setup: function() {
    this.name = generateAdapterUrl(adapter);
  },
  teardown: function() {
    if (!PERSIST_DATABASES) {
      stop();
      Pouch.destroy(this.name, function() { start(); });
    }
  }
});



asyncTest("Create a pouch without DB setup", function() {
  var instantDB;
  var name = this.name;
  Pouch.destroy(name, function() {
    instantDB = new Pouch(name, {skipSetup: true});
    instantDB.post({test:"abc"}, function(err, info) {
      ok(err && err.error === 'not_found', 'Skipped setup of database');
      start();
    });
  });
});


