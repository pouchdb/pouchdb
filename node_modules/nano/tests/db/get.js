var specify  = require('specify')
  , helpers  = require('../helpers')
  , timeout  = helpers.timeout
  , nano     = helpers.nano
  , nock     = helpers.nock
  ;

var mock = nock(helpers.couch, "db/get");

specify("db_get:setup", timeout, function (assert) {
  nano.db.create("db_get", function (err) {
    assert.equal(err, undefined, "Failed to create database");
  });
});

specify("db_get:test", timeout, function (assert) {
  nano.db.get("db_get", function (error, response) {
    assert.equal(error, undefined, "Failed to get database");
    assert.equal(response.doc_count, 0, "I can haz docs?");
    assert.equal(response.db_name, "db_get");
  });
});

specify("db_get:teardown", timeout, function (assert) {
  nano.db.destroy("db_get", function (err) {
    assert.equal(err, undefined, "Failed to destroy database");
    assert.ok(mock.isDone(), "Some mocks didn't run");
  });
});

specify.run(process.argv.slice(2));