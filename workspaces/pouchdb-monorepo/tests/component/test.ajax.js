'use strict';

var http = require('http');
var PouchDB = require('../../packages/node_modules/pouchdb-for-coverage');
var should = require("chai").should();

describe('test.ajax.js', function () {

  it('#6815 ajax uses cookies', function (done) {
    var server = http.createServer(function (req, res) {
      if (req.url === '/install-cookie') {
        res.writeHead(200, {'Set-Cookie': 'Test=test; Version=1; Path=/; HttpOnly'});
        res.end(JSON.stringify({ok: true}));
      } else if (req.url === '/check-cookie') {
        res.end(JSON.stringify({ok: req.headers.cookie === 'Test=test'}));
      }
    });
    server.listen(6000, function () {
      PouchDB.fetch('http://127.0.0.1:6000/install-cookie').then(function () {
        return PouchDB.fetch('http://127.0.0.1:6000/check-cookie');
      }).then(function (response) {
        return response.json();
      }).then(function (res) {
        server.close();
        should.equal(res.ok, true, "Cookie not set");
        done();
      });
    });
  });

  it('fetch handles relative uris', function (done) {
    var server = http.createServer(function (req, res) {
      res.end(JSON.stringify({ok: req.url === '/testdb/path'}));
    });
    server.listen(6000, function () {
      var db = new PouchDB('http://127.0.0.1:6000/testdb', { skip_setup: true });
      db.fetch('path').then(function (response) {
        return response.json();
      }).then(function (res) {
        server.close();
        should.equal(res.ok, true, "Fetch did not resolve uri");
        done();
      });
    });
  });

  it('fetch handles absolute uris', function (done) {
    var server = http.createServer(function (req, res) {
      res.end(JSON.stringify({ok: req.url === '/root-path'}));
    });
    server.listen(6000, function () {
      var db = new PouchDB('http://127.0.0.1:6000/testdb', { skip_setup: true });
      db.fetch('/root-path').then(function (response) {
        return response.json();
      }).then(function (res) {
        server.close();
        should.equal(res.ok, true, "Fetch did not resolve uri");
        done();
      });
    });
  });
});
