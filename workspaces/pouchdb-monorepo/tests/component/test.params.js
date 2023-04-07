'use strict';

var http = require('http');
var url = require('url');

var PouchDB = require('../../packages/node_modules/pouchdb-for-coverage');
var should = require("chai").should();

describe('test.params.js', function () {

  var server;
  var params;
  var PORT = 9615;

  before(function (done) {
    server = http.createServer(function (req, res) {
      params = url.parse(req.url,true).query;
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end('{"results":[{"seq":1,"id":"foo","changes":[{"rev":"1-a"}]}], "last_seq":1}');
    });
    server.listen(PORT, done);
  });

  after(function () {
    return server.close();
  });

  it('Test default heartbeat', function () {
    var url = 'http://127.0.0.1:' + PORT;
    return new PouchDB(url).changes().then(function () {
      should.not.exist(params.heartbeat);
    });
  });

  it('Test default heartbeat for live changes', function () {
    var url = 'http://127.0.0.1:' + PORT;
    var changes = new PouchDB(url).changes({live: true});
    changes.on('change', function () {
      changes.cancel();
    }).then(function () {
      should.exist(params.heartbeat);
    });
  });

  it('Test custom heartbeat', function () {
    var url = 'http://127.0.0.1:' + PORT;
    return new PouchDB(url).changes({heartbeat: 10}).then(function () {
      should.equal(params.heartbeat, '10');
    });
  });

  it('Test disable heartbeat', function () {
    var url = 'http://127.0.0.1:' + PORT;
    return new PouchDB(url).changes({heartbeat: false}).then(function () {
      should.not.exist(params.heartbeat);
    });
  });

  it('Test disable timeout', function () {
    var url = 'http://127.0.0.1:' + PORT;
    return new PouchDB(url).changes({timeout: false}).then(function () {
      should.not.exist(params.timeout);
    });
  });

});
