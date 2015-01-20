'use strict';

var http = require('http');
var PouchDB = require('../../lib');
var assert = require("assert");

describe('test.headers.js', function () {

  var server;
  var headers;
  var PORT = 9615;

  before(function (done) {
    server = http.createServer(function (req, res) {
      headers = req.headers;
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end('');
    });
    server.listen(PORT, done);
  });

  after(function (done) {
    server.close(done);
  });


  it('Test headers are sent correctly', function (done) {
    var opts = {ajax: {headers: {foo: 'bar'}}};
    new PouchDB('http://127.0.0.1:' + PORT, opts, function() {
      assert.equal(headers.foo, 'bar');
      done();
    });
  });

  it('Test auth params are sent correctly', function (done) {
    var opts = {auth: {username: 'foo', password: 'bar'}};
    new PouchDB('http://127.0.0.1:' + PORT, opts, function() {
      assert.equal(typeof headers.authorization, 'string');
      done();
    });
  });

});
