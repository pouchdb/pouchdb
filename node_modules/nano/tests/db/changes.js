var specify  = require('specify')
  , async    = require('async')
  , helpers  = require('../helpers')
  , timeout  = helpers.timeout
  , nano     = helpers.nano
  , nock     = helpers.nock
  ;

var mock = nock(helpers.couch, "db/changes")
  , db   = nano.use("db_changes")
  ;

specify("db_changes:setup", timeout, function (assert) {
  nano.db.create("db_changes", function (err) {
    assert.equal(err, undefined, "Failed to create database");
    async.parallel(
      [ function(cb) { db.insert({"foo": "bar"}, "foobar", cb); }
      , function(cb) { db.insert({"bar": "foo"}, "barfoo", cb); }
      , function(cb) { db.insert({"foo": "baz"}, "foobaz", cb); }
      ]
    , function(error, results){
      assert.equal(error, undefined, "Should have stored docs");
    });
  });
});

specify("db_changes:test", timeout, function (assert) {
  db.changes({since:2}, function (error, response) {
    assert.equal(error, undefined, "Changes should respond");
    assert.equal(response.results.length, 1, 'Gets one result');
    assert.equal(response.last_seq, 3, 'seq is 3');
  });
});

specify("db_changes:teardown", timeout, function (assert) {
  nano.db.destroy("db_changes", function (err) {
    assert.equal(err, undefined, "Failed to destroy database");
    assert.ok(mock.isDone(), "Some mocks didn't run");
  });
});

specify.run(process.argv.slice(2));