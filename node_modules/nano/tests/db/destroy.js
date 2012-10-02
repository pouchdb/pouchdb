var specify  = require('specify')
  , helpers  = require('../helpers')
  , timeout  = helpers.timeout
  , nano     = helpers.nano
  , nock     = helpers.nock
  ;

var mock = nock(helpers.couch, "db/destroy");

specify("db_destroy:setup", timeout, function (assert) {
  nano.db.create("db_destroy", function (err) {
    assert.equal(err, undefined, "Failed to create database");
  });
});

specify("db_destroy:test", timeout, function (assert) {
  nano.db.destroy("db_destroy", function (err) {
    assert.equal(err, undefined, "Failed to destroy database");
    assert.ok(mock.isDone(), "Some mocks didn't run");
  });
});

specify.run(process.argv.slice(2));