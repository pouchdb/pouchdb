"use strict";

var fs = require('fs');


describe("Remove DB", function () {
  beforeEach(function(done) {
    //Create a dir
    fs.mkdir('veryimportantfiles', function () {
        done();
      });
  });
  afterEach(function(done) {
    PouchDB.destroy('name', function(){
      fs.rmdir('veryimportantfiles', function () {
        done();
      });
    });
  })

  it("Create a pouch without DB setup", function(done) {
    new PouchDB('name', {skipSetup: true}, function() {
      PouchDB.destroy('veryimportantfiles', function( error, response ) {
        error.message.should.equal('Database not found', 'should return Database not found error');
        fs.exists('veryimportantfiles', function (resp) {
          resp.should.equal(true, 'veryimportantfiles was not removed');
          done();
        });
      });
    });
  });
});