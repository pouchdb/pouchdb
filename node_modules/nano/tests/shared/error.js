var specify  = require("specify")
  , helpers  = require("../helpers")
  , timeout  = helpers.timeout
  , nano     = helpers.nano
  , Nano     = helpers.Nano
  , nock     = helpers.nock
  ;

var mock = nock(helpers.couch, "shared/error")
  , db   = nano.use("shared_error")
  ;

specify("shared_error:setup", timeout, function (assert) {
  nano.db.create("shared_error", function (err) {
    assert.equal(err, undefined, "Failed to create database");
    db.insert({"foo": "baz"}, "foobaz", function (error, foo) {
      assert.equal(error, undefined, "Should have stored foobaz");
      assert.equal(foo.ok, true, "Response should be ok");
      assert.equal(foo.id, "foobaz", "My id is foobaz");
      assert.ok(foo.rev, "Response should have rev");
    });
  });
});

specify("shared_error:conflict", timeout, function (assert) {
  db.insert({"foo": "bar"}, "foobaz", function (error, response) {
    assert.equal(error["status-code"], 409, "Should be conflict");
    assert.equal(error.message, error.reason, "Message should be reason");
    assert.equal(error.scope, "couch", "Scope is couch");
    assert.equal(error.error, "conflict", "Error is conflict");
  });
});

specify("shared_error:init", timeout, function (assert) {
  try {
    Nano('Not a File');
  } catch(err) {
    assert.ok(err, "There must be an error");
    assert.ok(err.message, "A note is given");
    assert.equal(err.errid, "bad_file", "Code is right");
    assert.equal(err.scope, "init", "Scope is init");
  }
  try {
    Nano({});
  } catch(err2) {
    assert.ok(err2, "There must be an error");
    assert.ok(err2.message, "A note is given");
    assert.equal(err2.errid, "bad_url", "Code is right");
    assert.equal(err2.scope, "init", "Scope is init");
  }
});

specify("shared_error:root", timeout, function (assert) {
  // this shouldn't error
  var root   = nano.request()
    , buffer = ""
    ;
  root.on('data', function (chunk) { buffer += chunk; });
  root.on('end', function () {
    assert.ok(true, "Ended");
  });
});

specify("shared_error:stream", timeout, function (assert) {
  db.list("bad params").on('error', function (error) {
    assert.ok(error.message, "A note is given");
    assert.equal(error.errid, "bad_params", "Code is right");
    assert.equal(error.scope, "nano", "Scope exists");
  });
});

specify("shared_error:callback", timeout, function (assert) {
  db.list("bad params", function (error, response) {
    assert.ok(error, "There must be an error");
    assert.ok(error.message, "A note is given");
    assert.equal(error.errid, "bad_params", "Code is right");
    assert.equal(error.scope, "nano", "Scope exists");
  });
});

specify("shared_error:bad_delete", timeout, function (assert) {
  nano.db.destroy("say_wat_wat", function (error, response) {
    assert.ok(error, "There must be an error");
    assert.ok(error.message, "A note is given");
    assert.equal(error.description,'missing');
  });
});

specify("shared_error:teardown", timeout, function (assert) {
  nano.db.destroy("shared_error", function (err) {
    assert.equal(err, undefined, "Failed to destroy database");
    assert.ok(mock.isDone(), "Some mocks didn't run");
  });
});

specify.run(process.argv.slice(2));