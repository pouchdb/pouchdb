'use strict';

var http = require('http');
var PouchDB = require('../../packages/pouchdb');
var should = require("chai").should();

describe('test.headers.js', function () {

  var server;
  var headers;
  var PORT = 9615;

  before(function (done) {
    server = http.createServer(function (req, res) {
      headers = req.headers;
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end('[]');
    });
    server.listen(PORT, done);
  });

  after(function () {
    return server.close();
  });

  it('Test headers are sent correctly', function () {
    var opts = {ajax: {headers: {foo: 'bar'}}};
    var url = 'http://127.0.0.1:' + PORT;
    return new PouchDB(url, opts).info().then(function () {
      should.equal(headers.foo, 'bar');
    });
  });

  it('Test auth params are sent correctly', function () {
    var opts = {auth: {username: 'foo', password: 'bar'}};
    var url = 'http://127.0.0.1:' + PORT;
    return new PouchDB(url, opts).info().then(function () {
      should.equal(typeof headers.authorization, 'string');
    });
  });

  it('Test headers are sent correctly on GET request', function () {
    var db = new PouchDB('http://127.0.0.1:' + PORT);
    var opts = { ajax: { headers: { ick: "slick" } } };
    return db.get('fake', opts).then(function () {
      should.equal(headers.ick, 'slick');
    });
  });

  it('3491 Test headers are sent correctly on put', function () {
    var db = new PouchDB('http://127.0.0.1:' + PORT);
    var opts = { ajax: { headers: { ick: "slick" } } };
    return db.post({'fake': 'obj'}, opts).then(function () {
      should.equal(headers.ick, 'slick');
    });
  });

  it('3491 Test headers are sent correctly on changes', function () {
    var db = new PouchDB('http://127.0.0.1:' + PORT);
    var opts = { ajax: { headers: { ick: "slick" } } };
    return db.changes(opts).then(function () {
      should.equal(headers.ick, 'slick');
    });
  });

  it('3491 Test headers are sent correctly on destroy', function () {
    var db = new PouchDB('http://127.0.0.1:' + PORT);
    var opts = { ajax: { headers: { ick: "slick" } } };
    return db.destroy(opts).then(function () {
      should.equal(headers.ick, 'slick');
    });
  });

  it('Test that we combine local and global ajax options', function () {
    var opts = { ajax: { headers: { aheader: 'whyyes' } } };
    var db = new PouchDB('http://127.0.0.1:' + PORT, opts);
    var getOpts = {ajax: { headers: { ick: "slick", aheader: "override!" } } };
    return db.get('fake', getOpts).then(function () {
      should.equal(headers.ick, 'slick');
      should.equal(headers.aheader, 'override!');
    });
  });

  it('4450 Test headers are sent correctly on put', function () {
    var opts = {auth: {username: 'foo', password: 'bar'}};
    var db = new PouchDB('http://127.0.0.1:' + PORT, opts);
    return db.put({
      _id: 'doc',
      _attachments: {
        'att.txt': {
          content_type: 'text/plain',
          data: new Buffer(['Is there life on Mars?'], {type: 'text/plain'})
        }
      }
    }).then(function () {
      should.equal(headers.authorization, 'Basic Zm9vOmJhcg==');
    });
  });

});
