var specify  = require('specify')
  , helpers  = require('../helpers')
  , timeout  = helpers.timeout
  , nano     = helpers.nano
  , nock     = helpers.nock
  , rev
  ;

var mock = nock(helpers.couch, "doc/insert")
  , db   = nano.use("doc_insert")
  ;

specify("doc_insert:setup", timeout, function (assert) {
  nano.db.create("doc_insert", function (err) {
    assert.equal(err, undefined, "Failed to create database");
  });
});

specify("doc_insert:simple", timeout, function (assert) {
  db.insert({"foo": "baz"}, "foobaz", function (error, foo) {
    rev = foo.rev;
    assert.equal(error, undefined, "Should have stored foo");
    assert.equal(foo.ok, true, "Response should be ok");
    assert.ok(foo.rev, "Response should have rev");
  });
});

specify("doc_insert:params", timeout, function (assert) {
  db.insert({"foo": "baz", _rev: rev}, {doc_name:"foobaz", new_edits:false},
  function (error, foo) {
    assert.equal(error, undefined, "Should have stored foo");
    assert.equal(foo.ok, true, "Response should be ok");
    assert.ok(foo.rev, "Response should have rev");
  });
});

specify("doc_insert:functions", timeout, function (assert) {
  db.insert({fn: function () { return true; },
  fn2: "function () { return true; }"}, function (error, fns) {
    assert.equal(error, undefined, "Should have stored foo");
    assert.equal(fns.ok, true, "Response should be ok");
    assert.ok(fns.rev, "Response should have rev");
    db.get(fns.id, function (error, fns) {
      assert.equal(fns.fn, fns.fn2, "fn matches fn2");
      assert.equal(error, undefined, "Should get foo");
    });
  });
});

specify("doc_insert:streaming", timeout, function (assert) {
  var buffer = ""
    , foobar = db.insert({"foo": "bar"})
    ;

  function runAssertions(error, foobar) {
    assert.equal(error, undefined, "Should have stored foobar");
    assert.ok(foobar.ok, "This is ok");
    assert.ok(foobar.rev, "I GOT REVZ");
  }

  foobar.on('data', function(chunk) { buffer += chunk; });
  foobar.on('end', function () { runAssertions(null, JSON.parse(buffer)); });
  foobar.on('error', runAssertions);
});

specify("doc_insert:teardown", timeout, function (assert) {
  nano.db.destroy("doc_insert", function (err) {
    assert.equal(err, undefined, "Failed to destroy database");
    assert.ok(mock.isDone(), "Some mocks didn't run");
  });
});

specify.run(process.argv.slice(2));