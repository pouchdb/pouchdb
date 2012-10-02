var specify  = require('specify')
  , async    = require('async')
  , helpers  = require('../helpers')
  , timeout  = helpers.timeout
  , nano     = helpers.nano
  , nock     = helpers.nock
  ;

var mock     = nock(helpers.couch, "db/replicate")
  , db       = nano.use("db_replicate")
  , replica  = nano.use("db_replica")
  , replica2 = nano.use("db_replica2")
  ;

specify("db_replicate:setup", timeout, function (assert) {
  async.series(
    [ function(cb) { nano.db.create("db_replicate", cb); }
    , function(cb) { nano.db.create("db_replica", cb);   }
    , function(cb) { nano.db.create("db_replica2", cb);  }
    ]
  , function(error, results) {
    assert.equal(error, undefined, "Should have created databases");
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

specify("db_replicate:test", timeout, function (assert) {
  db.replicate("db_replica", function(error) {
    assert.equal(error, undefined, "Should be able to replicate");
    replica.list(function (error, list) {
      assert.equal(error, undefined, "Should be able to list");
      assert.equal(list.total_rows, 3, "Should have three documents");
    });
  });
});

specify("db_replicate:test_objects", timeout, function (assert) {
  nano.db.replicate(db, replica2, function(error) {
    assert.equal(error, undefined, "Should be able to replicate");
    replica2.list(function (error, list) {
      assert.equal(error, undefined, "Should be able to list");
      assert.equal(list.total_rows, 3, "Should have three documents");
    });
  });
});

specify("db_replicate:teardown", timeout, function (assert) {
  async.series(
    [ function(cb) { nano.db.destroy("db_replicate", cb); }
    , function(cb) { nano.db.destroy("db_replica", cb);   }
    , function(cb) { nano.db.destroy("db_replica2", cb);  }
    ]
  , function(error, results) {
    assert.equal(error, undefined, "Should have deleted databases");
    assert.ok(mock.isDone(), "Some mocks didn't run");
  });
});

specify.run(process.argv.slice(2));