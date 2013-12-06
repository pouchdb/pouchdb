/*globals initTestDB: false, emit: true, generateAdapterUrl: false */
/*globals PERSIST_DATABASES: false, initDBPair: false, utils: true */
/*globals Pouch.ajax: true, LevelPouch: true */

"use strict";

var adapter = 'http-1';
var qunit = module;
var LevelPouch;
var utils;

if (typeof module !== undefined && module.exports) {
  PouchDB = require('../lib');
  LevelPouch = require('../lib/adapters/leveldb');
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
      ok(err && err.error === 'not_found', 'Skipped setup of database');
      start();
    });
  });
});


