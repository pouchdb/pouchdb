
var assert = require('assert');

var PouchDB = require('../..');
var utils = require('../test_utils.js');

var db1 = 'mocha_test_db';

beforeEach(function(done) {
  utils.clearDatabases([db1], done);
});

afterEach(function(done) {
  utils.clearDatabases([db1], done);
});

describe('Basic tests', function() {

  it('Creates a databasa', function(done) {
    new PouchDB(db1, function(err, result) {
      assert.equal(err, null, 'Created database');
      done();
    });
  });

  it('Update a document', function(done) {
    new PouchDB(db1, function(err, db) {
      db.post({a: 'doc'}, function(err, info) {
        db.put({_id: info.id, _rev: info.rev, more:'data'}, function(err, res) {
          assert.equal(err, null, 'Update worked');
          assert.notEqual(info.rev, res.rev, 'Revision updated');
          done();
        });
      });
    });
  });

})
