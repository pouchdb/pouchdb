"use strict";

var adapter = 'http-1';
var qunit = module;

if (typeof module !== undefined && module.exports) {
  this.Pouch = require('../src/pouch.js');
  this.LevelPouch = require('../src/adapters/pouch.leveldb.js');
  this.utils = require('./test.utils.js');

  for (var k in this.utils) {
    global[k] = global[k] || this.utils[k];
  }
  qunit = QUnit.module;
}

qunit("http-adapter", {
  setup: function() {
    this.name = generateAdapterUrl(adapter);
  },
  teardown: function() {
    if (!PERSIST_DATABASES) {
      Pouch.destroy(this.name);
    }
  }
});



asyncTest("Create a pouch without DB setup", function() {
  var instantDB;
  instantDB = Pouch(this.name, {skipSetup: true});
  instantDB.post({test:"abc"}, function(err, info) {
    ok(err && err.error === 'not_found', 'Skipped setup of database');
    start();
  })
});


