var specify  = require('specify')
  , helpers  = require('../helpers')
  , timeout  = helpers.timeout
  , nano     = helpers.nano
  , nock     = helpers.nock
  ;

var mock = nock(helpers.couch, "db/list");

specify("db_list:setup", timeout, function (assert) {
  nano.db.create("db_list", function (err) {
    assert.equal(err, undefined, "Failed to create database");
  });
});

specify("db_list:test", timeout, function (assert) {
  nano.db.list(function (error, list) {
    assert.equal(error, undefined, "Failed to list databases");
    var filtered = list.filter(function (e) { 
      return e === "db_list" || e === "_replicator" || e === "_users";
    });
    assert.equal(filtered.length, 3, "Has exactly those threee dbs");
  });
});

specify("db_list:teardown", timeout, function (assert) {
  nano.db.destroy("db_list", function (err) {
    assert.equal(err, undefined, "Failed to destroy database");
    assert.ok(mock.isDone(), "Some mocks didn't run");
  });
});

specify.run(process.argv.slice(2));