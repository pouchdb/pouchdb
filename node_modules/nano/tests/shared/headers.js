
var specify  = require('specify')
  , helpers  = require('../helpers')
  , timeout  = helpers.timeout
  , nano     = helpers.nano
  , nock     = helpers.nock
  ;

var mock = nock(helpers.couch, "shared/headers")
  , db   = nano.use("shared_headers")
  ;


specify("shared_headers:setup", timeout, function (assert) {
  nano.db.create("shared_headers", function (err) {
    assert.equal(err, undefined, "Failed to create database");
  });
});

specify("shared_headers:test", timeout, function (assert) {
  db.attachment.insert("new", "att", "Hello", "text/plain", 
  function(error, hello) {
    assert.equal(error, undefined, "Should store hello");
    assert.equal(hello.ok, true, "Response should be ok");
    assert.ok(hello.rev, "Should have a revision number");
    nano.request({
      db: "shared_headers",
      doc: "new",
      att: "att",
      headers: { "If-None-Match": JSON.stringify(hello.rev) }
    },
    function (error, helloWorld, rh) {
      assert.equal(error, undefined, "Should get the hello");
      assert.equal(rh["status-code"], 304, "status is 'not modified'");
    });
    nano.request({
      db: "shared_headers",
      doc: "new",
      att: "att"
    },
    function (error, helloWorld, rh) {
      assert.equal(error, undefined, "Should get the hello");
      assert.equal(rh["status-code"], 200, "status is 'ok'");
    });
  });
});

specify("shared_headers:teardown", timeout, function (assert) {
  nano.db.destroy("shared_headers", function (err) {
    assert.equal(err, undefined, "Failed to destroy database");
    assert.ok(mock.isDone(), "Some mocks didn't run");
  });
});

specify.run(process.argv.slice(2));