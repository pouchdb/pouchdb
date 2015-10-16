'use strict';

var http = require('http');
var PouchDB = require('../../lib');
var should = require("chai").should();

describe('test.auth.js', function () {

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

  after(function () {
    return server.close();
  });

  it('Test auth headers are sent correctly', function () {
    var opts = {auth: {username: 'foo', password: 'bar'}};
    var url = 'http://127.0.0.1:' + PORT;
    return new PouchDB(url, opts).info().then(function() {
      should.equal(headers.authorization, 'Basic Zm9vOmJhcg==');
    });
  });

  it('Test auth headers via url are sent correctly', function () {
    var url = 'http://foo:bar@127.0.0.1:' + PORT;
    return new PouchDB(url).info().then(function() {
      should.equal(headers.authorization, 'Basic Zm9vOmJhcg==');
    });
  });

});
