var specify  = require('specify')
  , helpers  = require('../helpers')
  , timeout  = helpers.timeout
  , nano     = helpers.nano
  , nock     = helpers.nock
  ;

var mock = nock(helpers.couch, "doc/destroy")
  , db   = nano.use("doc_destroy")
  , rev
  ;

specify("doc_destroy:setup", timeout, function (assert) {
  nano.db.create("doc_destroy", function (err) {
    assert.equal(err, undefined, "Failed to create database");
    db.insert({"foo": "baz"}, "foobaz", function (error, foo) {   
      assert.equal(error, undefined, "Should have stored foo");
      assert.equal(foo.ok, true, "Response should be ok");
      assert.ok(foo.rev, "Response should have rev");
      rev = foo.rev;
    });
  });
});

specify("doc_destroy:test", timeout, function (assert) {
  db.destroy("foobaz", rev, function (error, response) {
    assert.equal(error, undefined, "Should have deleted foo");
    assert.equal(response.ok, true, "Response should be ok");
  });
});

specify("doc_destroy:teardown", timeout, function (assert) {
  nano.db.destroy("doc_destroy", function (err) {
    assert.equal(err, undefined, "Failed to destroy database");
    assert.ok(mock.isDone(), "Some mocks didn't run");
  });
});

specify.run(process.argv.slice(2));