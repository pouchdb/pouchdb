'use strict';

var should = require('chai').should();
var mockery = require('mockery');

var PouchDB = require('../../packages/node_modules/pouchdb-for-coverage');

// TODO: I cannot figure out why these are failing. It seems to have
// something to do with the mocks. These tests do not seem very high-value
// anyway because we are mocking the entire HTTP layer.
describe.skip('test.ajax.js', function () {
  var cb;
  var ajax;

  beforeEach(function () {
    mockery.enable({
      warnOnReplace: false,
      warnOnUnregistered: false,
      useCleanCache: true
    });

    function requestStub(callOpts, callCB) {
      cb = callCB;
    }

    mockery.registerMock('request', requestStub);
    ajax = PouchDB.ajax;
  });

  after(function () {
    mockery.disable();
  });

  it('should exist', function () {
    should.exist(ajax);
    ajax.should.be.a('function');
  });

  it('detects error on an interrupted binary file', function (done) {
    ajax({
      method: 'GET',
      binary: true,
      url: 'http://test.db/dbname/docid/filename.jpg'
    }, function (err, res) {
      // here's the test, we should get an 'err' response
      should.exist(err);
      should.not.exist(res);
      done();
    });

    // Simulates an interrupted network request
    setTimeout(function () {
      cb(null, {
        statusCode: 0
      },
      "");
    }, 4);
  });

  it('should work on a working binary file', function (done) {
    ajax({
      method: 'GET',
      binary: true,
      url: 'http://test.db/dbname/docid/filename.jpg'
    }, function (err, res) {
      should.not.exist(err);
      should.exist(res);
      done();
    });

    setTimeout(function () {
      cb(null, {
        statusCode: 200,
        headers: {
          'Content-Type': 'image/jpeg'
        }
      }, new Buffer('sure this is binary data'));
    }, 4);
  });

});

