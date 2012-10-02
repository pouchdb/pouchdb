var specify  = require('specify')
  , helpers  = require('../helpers')
  , timeout  = helpers.timeout
  , nano     = helpers.nano
  , nock     = helpers.nock
  ;

var mock = nock(helpers.couch, "doc/copy")
  , db   = nano.use("doc_copy")
  ;

specify("doc_copy:setup", timeout, function (assert) {
  nano.db.create("doc_copy", function (err) {
    assert.equal(err, undefined, "Failed to create database");
    db.insert({"foo": "baz"}, "foo_src", function (error, foo) {
      assert.equal(error, undefined, "Should have stored foo");
      assert.equal(foo.ok, true, "Response should be ok");
      assert.ok(foo.rev, "Response should have rev");
    });
    db.insert({"baz": "foo"}, "foo_dest", function (error, foo) {
      assert.equal(error, undefined, "Should have stored foo");
      assert.equal(foo.ok, true, "Response should be ok");
      assert.ok(foo.rev, "Response should have rev");
    });
  });
});

specify("doc_copy:overwrite", timeout, function (assert) {
  db.copy("foo_src", "foo_dest", { overwrite: true }, 
  function (error, response, headers) {
    assert.equal(error, undefined, 
      "Should have copied and overwritten foo_src to foo_dest");
    assert.equal(headers["status-code"], 201, "Status code should be 201");
  });
});

specify("doc_copy:no_overwrite", timeout, function (assert) {
  db.copy("foo_src", "foo_dest", function (error, response, headers) {
    assert.equal(error.error, "conflict", "Should have a document conflict.");
  });
});

specify("doc_copy:new_doc", timeout, function (assert) {
  db.copy("foo_src", "baz_dest", function (error, response, headers) {
    assert.equal(error, undefined, 
      "Should have copied foo_src to new baz_dest document");
    assert.equal(headers["status-code"], 201, "Status code should be 201");
  });
});

specify("doc_copy:teardown", timeout, function (assert) {
  nano.db.destroy("doc_copy", function (err) {
    assert.equal(err, undefined, "Failed to destroy database");
    assert.ok(mock.isDone(), "Some mocks didn't run");
  });
});

specify.run(process.argv.slice(2));
