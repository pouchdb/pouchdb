const {PouchDB} = require('../testutils');
const buildHTTPPouchDB = require('../../packages/node_modules/http-pouchdb');
const should = require('chai').should();

var HTTPPouchDB = buildHTTPPouchDB(PouchDB, 'http://localhost:5984/');
var HTTPPouchDBWithAuth = buildHTTPPouchDB(PouchDB, 'http://localhost:5984/', {
  auth: {
    username: 'john',
    password: 'smith'
  }
});
var XMLHttpRequest = require('xhr2');
var Promise = require('bluebird');

describe('isHTTPPouchDB', function () {
  it('should be set on the HTTPPouchDB object', function () {
    HTTPPouchDB.isHTTPPouchDB.should.be.ok;
  });
  it('should not be set on the PouchDB object', function () {
    should.not.exist(PouchDB.isHTTPPouchDB);
  });
});

describe('constructor', function () {
  it('should create remote databases for normal db names', function () {
    var users = new HTTPPouchDB('_users');

    return users.info().then(function (info) {
      info.should.have.property('db_name');
    });
  });
});

describe('destroy', function () {
  it("should be possible using the 'class method'", function (done) {
    new HTTPPouchDB('test');
    HTTPPouchDB.destroy('test', done);
  });
  it('should be possible using the method', function (done) {
    var db = new HTTPPouchDB('test');
    db.destroy(done);
  });
});

describe('replicate', function () {
  it('should work', function () {
    HTTPPouchDB.replicate('test-a', 'test-b').on('complete', function (resp) {
      resp.status.should.equal('complete');

      return dbShouldExist('test-a').then(function () {
        return dbShouldExist('test-b');
      }).then(function () {
        return new PouchDB('http://localhost:5984/test-a').destroy();
      }).then(function () {
        return new PouchDB('test-b').destroy();
      });
    });
  });
});

function dbShouldExist(name) {
  return new Promise(function (resolve) {
    var xhr = new XMLHttpRequest();
    xhr.onload = function () {
      xhr.status.should.equal(200);
      resolve();
    };
    xhr.open('HEAD', 'http://localhost:5984/' + name);
    xhr.send();
  });
}

describe('allDbs', function () {
  it('should return the remote db list', function (done) {
    HTTPPouchDB.allDbs(function (err, dbs) {
      should.not.exist(err);
      dbs.should.contain('_users');
      dbs.should.contain('_replicator');

      done();
    });
  });

  it('should make use of opts.auth', function (done) {
    HTTPPouchDBWithAuth.allDbs(function (err, dbs) {
      should.not.exist(err);
      should.exist(dbs);
      dbs.error.should.equal('unauthorized');
      dbs.reason.should.equal('Name or password is incorrect.');

      done();
    });
  });
});
