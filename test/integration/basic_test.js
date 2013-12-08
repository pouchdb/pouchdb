'use strict';

if (typeof module !== 'undefined' && module.exports) {
  var chai = require('chai');
  var PouchDB = require('../../');
  var utils = require('../test_utils.js');
}

var dbs = ['mocha_test_db', 'http://127.0.0.1:5984/mocha_test_db'];

beforeEach(function(done) {
  utils.clearDatabases(dbs, done);
});

afterEach(function(done) {
  utils.clearDatabases(dbs, done);
});

dbs.forEach(function(db) {

  describe('Basic tests', function() {

    it('Creates a database', function(done) {
      new PouchDB(db, function(err, result) {
        chai.assert.equal(err, null, 'Created database');
        done();
      });
    });

    it('Update a document', function(done) {
      new PouchDB(db, function(err, db) {
        db.post({a: 'doc'}, function(err, info) {
          db.put({_id: info.id, _rev: info.rev, more:'data'}, function(err, res) {
            chai.assert.equal(err, null, 'Update worked');
            chai.assert.notEqual(info.rev, res.rev, 'Revision updated');
            done();
          });
        });
      });
    });

  })

});
