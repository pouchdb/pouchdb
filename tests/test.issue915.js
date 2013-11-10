/*globals initTestDB: false, emit: true, generateAdapterUrl: false */
/*globals PERSIST_DATABASES: false, initDBPair: false, utils: true */
/*globals ajax: true, LevelPouch: true */

"use strict";

var qunit = module;
var LevelPouch;
var utils;
var fs;

if (typeof module !== undefined && module.exports) {
  Pouch = require('../src/pouch.js');
  LevelPouch = require('../src/adapters/pouch.leveldb.js');
  utils = require('./test.utils.js');
  fs = require('fs');

  for (var k in utils) {
    global[k] = global[k] || utils[k];
  }
  qunit = QUnit.module;
}

qunit("Remove DB", {
  setup: function() {
    //Create a dir
    fs.mkdirSync('veryimportantfiles');
  },
  teardown: function() {
      Pouch.destroy('name');
      fs.rmdirSync('veryimportantfiles');
  }
});



asyncTest("Create a pouch without DB setup", function() {
  var instantDB;
  instantDB = new Pouch('name', {skipSetup: true}, function() {
    Pouch.destroy('veryimportantfiles', function( error, response ) {
        equal(error.reason, 'Database not found', 'should return Database not found error');
        equal(fs.existsSync('veryimportantfiles'), true, 'veryimportantfiles was not removed');
        start();
      });
  });
});


