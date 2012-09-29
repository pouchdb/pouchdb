var specify  = require("specify")
  , helpers  = require("../helpers")
  , timeout  = helpers.timeout
  , nano     = helpers.nano
  , nock     = helpers.nock
  ;

var mock = nock(helpers.couch, "doc/head")
  , db   = nano.use("doc_head")
  , rev
  ;

specify("doc_head:setup", timeout, function (assert) {
  nano.db.create("doc_head", function (err) {
    assert.equal(err, undefined, "Failed to create database");
    db.insert({"foo": "baz"}, "foobaz", function (error, foo) {
      assert.equal(error, undefined, "Should have stored foobaz");
      assert.equal(foo.ok, true, "Response should be ok");
      assert.equal(foo.id, "foobaz", "My id is foobaz");
      assert.ok(foo.rev, "Response should have rev");
      rev = foo.rev;
    });
  });
});

specify("doc_head:test", timeout, function (assert) {
  db.head("foobaz", function (error, body, headers) {
    assert.equal(error, undefined, "Should get the head of foobaz");
    assert.equal(headers["status-code"], 200, "Should be ok");
  });
});

specify("doc_head:teardown", timeout, function (assert) {
  nano.db.destroy("doc_head", function (err) {
    assert.equal(err, undefined, "Failed to destroy database");
    assert.ok(mock.isDone(), "Some mocks didn't run");
  });
});

specify.run(process.argv.slice(2));