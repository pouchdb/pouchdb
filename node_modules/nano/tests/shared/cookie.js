var specify    = require("specify")
  , helpers    = require("../helpers")
  , timeout    = helpers.timeout
  , nano       = helpers.nano
  , Nano       = helpers.Nano
  , nock       = helpers.nock
  ;

var mock  = nock(helpers.couch, "shared/cookie")
  , admin = Nano(helpers.admin)
  , cookie
  , cookie_nano
  ;

specify("shared_cookie:setup", timeout, function (assert) {
  // creates a db in admin party mode
  nano.db.create("shared_cookie", function (err, response) {
    assert.equal(err, undefined, "Failed to create database");
    // creates a admin user, leaves admin party mode
    nano.relax(
    { method : "PUT"
    , path   : "_config/admins/" + helpers.username
    , body   : helpers.password
    }, function (err, response, headers) {
      assert.equal(err, undefined, "Failed to create admin user");
      // authenticate
      nano.auth(helpers.username, helpers.password, 
      function (err, response, headers) {
        assert.equal(err, undefined, "Should have logged in successfully");
        assert.ok(headers['set-cookie'], 
          "Response should have a set-cookie header");
        cookie = headers['set-cookie'];
      });
      });
  });
});

specify("shared_cookie:test", timeout, function (assert) {
  var server = Nano({ url : helpers.couch, cookie: cookie });
  var db = server.use("shared_cookie");
  // insert with a shared cookie
  db.insert({"foo": "baz"}, null, function (error, response) {
    assert.equal(error, undefined, "Should have stored value");
    assert.equal(response.ok, true, "Response should be ok");
    assert.ok(response.rev, "Response should have rev");
  });
});

specify("shared_cookie:teardown", timeout, function (assert) {
  // back to admin party mode
  admin.relax(
  { method : "DELETE"
  , path   : "_config/admins/" + helpers.username
  }, function (err, response, headers) {
    // delete the database that we created
    nano.db.destroy("shared_cookie", function (err) {
      assert.equal(err, undefined, "Failed to destroy database");
      assert.ok(mock.isDone(), "Some mocks didn't run");
    });
  });
});

specify.run(process.argv.slice(2));