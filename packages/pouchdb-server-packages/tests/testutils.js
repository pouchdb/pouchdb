var fs = require('node:fs');
var path = require('node:path');
var Promise = require('pouchdb-promise');
var chai = require('chai');

exports.PouchDB = require('pouchdb').defaults({
  db: require('memdown')
});

var testConfig;
var home = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
var confPath = path.join(home, '.pouchdb-plugin-helper-conf.json');
try {
  testConfig = JSON.parse(fs.readFileSync(confPath, {encoding: 'utf8'}));
} catch (err) {
  testConfig = {};
}

exports.should = chai.should();

var db;

exports.setup = function () {
  db = new exports.PouchDB('test');
  return db;
};

exports.setupWithDoc = function () {
  exports.setup();
  return db.put({
    _id: 'mytest',
    test: true
  }).then(function (info) {
    return {
      db: db,
      rev: info.rev
    };
  });
};

exports.setupWithDocAndAttachment = function () {
  var res;
  return exports.setupWithDoc().then(function (info) {
    res = info;
    var buffer = new Buffer('abcd', 'ascii');
    return db.putAttachment('attachment_test', 'text', buffer, 'text/plain');
  }).then(function (info) {
    res.attRev = info.rev;
    return res;
  });
};

exports.teardown = function () {
  return db.destroy();
};

exports.shouldThrowError = function (func) {
  return Promise.resolve().then(function () {
    return func();
  }).then(function () {
    'No error thrown while it should have been'.should.equal('');
  }).catch(function (err) {
    return err;
  });
};

exports.BASE_URL = testConfig.base_url || 'http://localhost:5984';
exports.HTTP_AUTH = testConfig.username ? {
  username: testConfig.username,
  password: testConfig.password
} : null;

exports.setupHTTP = function () {
  db = new exports.PouchDB(exports.BASE_URL + '/pouchdb-plugin-helper-db', {auth: exports.HTTP_AUTH});
  return db;
};
