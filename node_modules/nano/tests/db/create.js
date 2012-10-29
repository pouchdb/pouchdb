var specify  = require('specify')
  , helpers  = require('../helpers')
  , timeout  = helpers.timeout
  , nano     = helpers.nano
  , nock     = helpers.nock
  ;

var mock = nock(helpers.couch, "db/create");

specify("db_create:test", timeout, function (assert) {
  nano.db.create("db_create", function (err) {
    assert.equal(err, undefined, "Failed to create database");
  });
});

specify("db_create:teardown", timeout, function (assert) {
  nano.db.destroy("db_create", function (err) {
    assert.equal(err, undefined, "Failed to destroy database");
    assert.ok(mock.isDone(), "Some mocks didn't run");
  });
});

specify.run(process.argv.slice(2));