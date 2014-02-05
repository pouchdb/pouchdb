"use strict";


var PouchDB = require('../lib');
var fs = require('fs');


QUnit.module("Remove DB", {
  setup: function(done) {
    //Create a dir
    fs.mkdir('veryimportantfiles', done);
  },
  teardown: function(done) {
    PouchDB.destroy('name', function(){
      fs.rmdir('veryimportantfiles', done);
    });
  }
});



asyncTest("Create a pouch without DB setup", function(done) {
  new PouchDB('name', {skipSetup: true}, function() {
    PouchDB.destroy('veryimportantfiles', function( error, response ) {
      equal(error.message, 'Database not found', 'should return Database not found error');
      equal(fs.existsSync('veryimportantfiles'), true, 'veryimportantfiles was not removed');
      done();
    });
  });
});


