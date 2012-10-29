var specify  = require('specify')
  , async    = require('async')
  , helpers  = require('../helpers')
  , timeout  = helpers.timeout
  , nano     = helpers.nano
  , nock     = helpers.nock
  ;

var mock = nock(helpers.couch, "db/follow")
  , db   = nano.use("db_follow")
  , feed
  ;

specify("db_follow:setup", timeout, function (assert) {
  nano.db.create("db_follow", function (err) {
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

if(!process.env.NOCK) {
  // nock doesn support streaming
  // please run tests with local couchdb
  specify("db_follow:stream", timeout, function (assert) {
    assert.expect(2);
    feed  = db.follow({since: 3});
    var i = 3;
    feed.on('change', function (change) {
      assert.ok(change, "Change existed");
      assert.equal(change.seq, i+1, "Seq is set correctly");
      ++i;
    });
    feed.follow();
    process.nextTick(function () {
      db.insert({"bar": "baz"}, "barbaz");
    });
  });
  
  specify("db_follow:callback", timeout, function (assert) {
    db.follow({since: 3}, function (error, change) {
      assert.equal(error, undefined, "No errors happened");
      assert.ok(change, "Change existed");
    });
  });
}

specify("db_follow:teardown", timeout, function (assert) {
  if (feed && typeof feed.stop === "function") {
    feed.stop();
  }
  nano.db.destroy("db_follow", function (err) {
    assert.equal(err, undefined, "Failed to destroy database");
    assert.ok(mock.isDone(), "Some mocks didn't run");
  });
});

specify.run(process.argv.slice(2));