var specify  = require("specify")
  , helpers  = require("../helpers")
  , timeout  = helpers.timeout
  , nano     = helpers.nano
  , nock     = helpers.nock
  ;

var mock = nock(helpers.couch, "doc/get")
  , db   = nano.use("doc_get")
  , rev
  ;

specify("doc_get:setup", timeout, function (assert) {
  nano.db.create("doc_get", function (err) {
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

specify("doc_get:test", timeout, function (assert) {
  db.insert({"foo": "bar"}, "foobaz", function (error, response) {
    assert.equal(error["status-code"], 409, "Should be conflict");
    assert.equal(error.scope, "couch", "Scope is couch");
    assert.equal(error.error, "conflict", "Error is conflict");
    db.get("foobaz", {revs_info: true}, function (error, foobaz) {
      assert.equal(error, undefined, "Should get foobaz");
      assert.ok(foobaz._revs_info, "Got revs info");
      assert.equal(foobaz._id, "foobaz", "Id is food");
      assert.equal(foobaz.foo, "baz", "Baz is in foo");
    });
  });
});

specify("doc_get:teardown", timeout, function (assert) {
  nano.db.destroy("doc_get", function (err) {
    assert.equal(err, undefined, "Failed to destroy database");
    assert.ok(mock.isDone(), "Some mocks didn't run");
  });
});

specify.run(process.argv.slice(2));