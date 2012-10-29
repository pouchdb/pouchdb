var specify  = require('specify')
  , helpers  = require('../helpers')
  , timeout  = helpers.timeout
  , nano     = helpers.nano
  , nock     = helpers.nock
  ;

var mock = nock(helpers.couch, "doc/update")
  , db   = nano.use("doc_update")
  , rev
  ;

specify("doc_update:setup", timeout, function (assert) {
  nano.db.create("doc_update", function (err) {
    assert.equal(err, undefined, "Failed to create database");
    db.insert({"foo": "baz"}, "foobar", function (error, foo) {   
      assert.equal(error, undefined, "Should have stored foo");
      assert.equal(foo.ok, true, "Response should be ok");
      assert.ok(foo.rev, "Response should have rev");
      rev = foo.rev;
    });
  });
});

specify("doc_update:test", timeout, function (assert) {
  db.insert({foo: "bar", "_rev": rev}, "foobar", function (error, response) {
    assert.equal(error, undefined, "Should have deleted foo");
    assert.equal(response.ok, true, "Response should be ok");
  });
});

specify("doc_update:teardown", timeout, function (assert) {
  nano.db.destroy("doc_update", function (err) {
    assert.equal(err, undefined, "Failed to destroy database");
    assert.ok(mock.isDone(), "Some mocks didn't run");
  });
});

specify.run(process.argv.slice(2));