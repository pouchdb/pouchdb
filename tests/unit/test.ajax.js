'use strict';

var should = require('chai').should();
var mockery = require('mockery');

describe('test.ajax.js', function () {
  var opts;
  var cb;
  var ajax;

  beforeEach(function() {
    mockery.enable({
      warnOnReplace: false,
      warnOnUnregistered: false,
      useCleanCache: true
    });

    function requestStub(callOpts, callCB) {
      opts = callOpts;
      cb = callCB;
    }

    mockery.registerMock('request', requestStub);
    ajax = require('../../lib/deps/ajax/ajax-core');
  });

  it('should exist', function () {
    should.exist(ajax);
    ajax.should.be.a('function');
  });

  it('detects error on an interrupted binary file', function(done) {
    ajax({
      method: 'GET',
      binary: true,
      url: 'http://test.db/dbname/docid/filename.jpg'
    }, function(err, res) {
      // here's the test, we should get an 'err' response
      should.exist(err);
      should.not.exist(res);
      done();
    });

    // Simulates an interrupted network request
    setTimeout(function() {
      cb(null, {
        statusCode: 0
      },
      "");
    }, 4);
  });

  it('should work on a working binary file', function(done) {
    ajax({
      method: 'GET',
      binary: true,
      url: 'http://test.db/dbname/docid/filename.jpg'
    }, function(err, res) {
      should.not.exist(err);
      should.exist(res);
      done();
    });

    setTimeout(function() {
      cb(null, {
        statusCode: 200,
        headers: {
          'Content-Type': 'image/jpeg'
        }
      }, new Buffer('sure this is binary data'));
    }, 4);
  });

});

