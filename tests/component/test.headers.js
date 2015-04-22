'use strict';

var http = require('http');
var PouchDB = require('../../lib');
var should = require("chai").should();
require('bluebird').onPossiblyUnhandledRejection(function (e, promise) {
  throw e;
});

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

  after(function () {
    return server.close();
  });

  it('Test headers are sent correctly', function () {
    var opts = {ajax: {headers: {foo: 'bar'}}};
    return new PouchDB('http://127.0.0.1:' + PORT, opts).then(function() {
      should.equal(headers.foo, 'bar');
    });
  });

  it('Test auth params are sent correctly', function () {
    var opts = {auth: {username: 'foo', password: 'bar'}};
    return new PouchDB('http://127.0.0.1:' + PORT, opts).then(function() {
      should.equal(typeof headers.authorization, 'string');
    });
  });

  it('Test headers are sent correctly on GET request', function() {
    var db = new PouchDB('http://127.0.0.1:' + PORT);
    var opts = { ajax: { headers: { ick: "slick" } } };
    return db.get('fake', opts).then(function() {
      should.equal(headers.ick, 'slick');
    });
  });

  it('Test that we combine ajax options both globally and locally on GET',
     function() {
    var opts = { ajax: { headers: { aheader: 'whyyes' } } };
    var db = new PouchDB('http://127.0.0.1:' + PORT, opts);
    var getOpts = {ajax: { headers: { ick: "slick", aheader: "override!" } } };
    return db.get('fake', getOpts).then(function() {
      should.equal(headers.ick, 'slick');
      should.equal(headers.aheader, 'override!');
    });
  });
});
