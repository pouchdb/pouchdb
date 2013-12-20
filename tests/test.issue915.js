"use strict";

if (typeof module !== undefined && module.exports) {
  var PouchDB = require('../lib');
  var utils = require('./test.utils.js');
  var fs = require('fs');
}

QUnit.module("Remove DB", {
  setup: function() {
    //Create a dir
    fs.mkdirSync('veryimportantfiles');
  },
  teardown: function() {
    PouchDB.destroy('name');
    fs.rmdirSync('veryimportantfiles');
  }
});



asyncTest("Create a pouch without DB setup", function() {
  var instantDB;
  instantDB = new PouchDB('name', {skipSetup: true}, function() {
    PouchDB.destroy('veryimportantfiles', function( error, response ) {
      equal(error.message, 'Database not found', 'should return Database not found error');
      equal(fs.existsSync('veryimportantfiles'), true, 'veryimportantfiles was not removed');
      start();
    });
  });
});


