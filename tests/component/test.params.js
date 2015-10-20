'use strict';

var http = require('http');
var url = require('url');

var PouchDB = require('../../lib');
var should = require("chai").should();

describe('test.params.js', function () {

  var server;
  var params;
  var PORT = 9615;

  before(function (done) {
    server = http.createServer(function (req, res) {
      params = url.parse(req.url,true).query;
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end('');
    });
    server.listen(PORT, done);
  });

  after(function () {
    return server.close();
  });

  it('Test default heartbeat', function () {
    var url = 'http://127.0.0.1:' + PORT;
    return new PouchDB(url).changes().then(function() {
      should.exist(params.heartbeat);
    });
  });

  it('Test custom heartbeat', function () {
    var url = 'http://127.0.0.1:' + PORT;
    return new PouchDB(url).changes({heartbeat: 10}).then(function() {
      should.equal(params.heartbeat, '10');
    });
  });

  it('Test disable heartbeat', function () {
    var url = 'http://127.0.0.1:' + PORT;
    return new PouchDB(url).changes({heartbeat: false}).then(function() {
      should.not.exist(params.heartbeat);
    });
  });

});
