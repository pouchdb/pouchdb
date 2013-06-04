/*globals initTestDB: false, emit: true, generateAdapterUrl: false */
/*globals PERSIST_DATABASES: false, initDBPair: false, utils: true */
/*globals ajax: true, HTTPPouch: true */

'use strict';

var adapter = 'http-1';
var qunit = module;
var HTTPPouch;

if (typeof module !== undefined && module.exports) {
  var Pouch = require('../src/pouch.js');
  HTTPPouch = require('../src/adapters/pouch.http.js');
  var utils = require('./test.utils.js');

  for (var k in utils) {
    global[k] = global[k] || utils[k];
  }
  qunit = QUnit.module;
}

qunit('http-adapter', {
  setup: function() {
    this.name = generateAdapterUrl(adapter);
  },
  teardown: function() {
    if (!PERSIST_DATABASES) {
      stop();
      Pouch.destroy(this.name, function(err, info) {start();});
    }
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
