var specify  = require('specify')
  , async    = require('async')
  , helpers  = require('../helpers')
  , timeout  = helpers.timeout
  , nano     = helpers.nano
  , nock     = helpers.nock
  ;

var mock = nock(helpers.couch, "doc/fetch")
  , db   = nano.use("doc_fetch")
  ;

specify("doc_fetch:setup", timeout, function (assert) {
  nano.db.create("doc_fetch", function (err) {
    assert.equal(err, undefined, "Failed to create database");
    async.parallel(
      [ function(cb) { db.insert({"foo": "bar"}, "foobar", cb); }
      , function(cb) { db.insert({"bar": "foo"}, "barfoo", cb); }
      , function(cb) { db.insert({"foo": "baz"}, "foobaz", cb); }
      ]
    , function(error, results) {
      assert.equal(error, undefined, "Should have stored docs");
    });
  });
});

specify("doc_fetch:one_key", timeout, function (assert) {
  db.fetch({keys:["foobar"]}, function (error, docs) {
    assert.equal(error, undefined, 'No errors');
    assert.equal(docs.rows.length, 1, 'One row');
    assert.equal(docs.total_rows, 3, 'Out of 3');
  });
});

specify("doc_fetch:multiple_keys", timeout, function (assert) {
  db.fetch({keys:["foobar", "barfoo"]}, function (error, docs) {
    assert.equal(error, undefined, 'No errors');
    assert.equal(docs.rows.length, 2, 'Two rows');
    assert.equal(docs.total_rows, 3, 'Out of 3');
  });
});

specify("doc_fetch:teardown", timeout, function (assert) {
  nano.db.destroy("doc_fetch", function (err) {
    assert.equal(err, undefined, "Failed to destroy database");
    assert.ok(mock.isDone(), "Some mocks didn't run");
  });
});

specify.run(process.argv.slice(2));