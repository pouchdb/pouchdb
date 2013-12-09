'use strict';

if (typeof module !== 'undefined' && module.exports) {
  var chai = require('chai');
  var PouchDB = require('../../');
  var utils = require('../test_utils.js');
}

var db1 = 'mocha_test_db';
var db2 = 'mocha_test_db2';

beforeEach(function(done) {
  utils.clearDatabases([db1, db2], done);
});

afterEach(function(done) {
  utils.clearDatabases([db1, db2], done);
});

describe('Replication tests', function() {

  it('replicates', function(done) {
    var local = new PouchDB(db1);
    var remote = new PouchDB(db2);
    local.post({a:'doc'}, function(err, db) {
      local.replicate.to(remote, function() {
        remote.allDocs(function(err, docs) {
          chai.assert.equal(1, docs.total_rows, 'Document in remote db');
          done();
        });
      });
    });
  });

});
