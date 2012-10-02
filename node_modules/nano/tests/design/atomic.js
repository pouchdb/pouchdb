var specify  = require("specify")
  , helpers  = require("../helpers")
  , timeout  = helpers.timeout
  , nano     = helpers.nano
  , nock     = helpers.nock
  ;

var mock = nock(helpers.couch, "design/atomic")
  , db   = nano.use("design_atomic")
  , rev
  ;

specify("design_atomic:setup", timeout, function (assert) {
  nano.db.create("design_atomic", function (err) {
    assert.equal(err, undefined, "Failed to create database");
    db.insert(
    { "updates": 
      { "inplace": function (doc, req) {
          var body = JSON.parse(req.body);
          doc[body.field] = body.value;
          return [doc, JSON.stringify(doc)];
        }
      }
    }, "_design/update", function (error, response) {
      db.insert({"foo": "baz"}, "foobar", function (error, foo) {   
        assert.equal(error, undefined, "Should have stored foo");
        assert.equal(foo.ok, true, "Response should be ok");
        assert.ok(foo.rev, "Response should have rev");
        rev = foo.rev;
      });
    });
  });
});

specify("design_atomic:test", timeout, function (assert) {
  db.atomic("update", "inplace", "foobar", 
  {field: "foo", value: "bar"}, function (error, response) {
    assert.equal(error, undefined, "Failed to update");
    assert.equal(response.foo, "bar", "Update worked");
  });
});

specify("design_atomic:teardown", timeout, function (assert) {
  nano.db.destroy("design_atomic", function (err) {
    assert.equal(err, undefined, "Failed to destroy database");
    assert.ok(mock.isDone(), "Some mocks didn't run");
  });
});

specify.run(process.argv.slice(2));