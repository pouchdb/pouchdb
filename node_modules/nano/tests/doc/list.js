var specify  = require('specify')
  , async    = require('async')
  , helpers  = require('../helpers')
  , timeout  = helpers.timeout
  , nano     = helpers.nano
  , nock     = helpers.nock
  ;

var mock = nock(helpers.couch, "doc/list")
  , db   = nano.use("doc_list")
  ;

specify("doc_list:setup", timeout, function (assert) {
  nano.db.create("doc_list", function (err) {
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

specify("doc_list:list", timeout, function (assert) {
  db.list(function (error, docs) {
    assert.equal(error, undefined, "List didn't work");
    assert.equal(docs.total_rows, 3, "Got total three rows");
    assert.ok(docs.rows, "Got rows");
  });
});

specify("doc_list:relaxed", timeout, function (assert) {
  nano.relax(
  { db     : "doc_list"
  , doc    : "_all_docs"
  , method : "GET"
  , params : {limit: 1}
  }, function (error, docs) {
    assert.equal(error, undefined, "Relax didn't work");
    assert.ok(docs.rows, "Got rows");
    assert.equal(docs.rows.length, 1, "Only one row");
    assert.equal(docs.total_rows, 3, "Got total three rows");
  });
});

specify("doc_list:relaxed", timeout, function (assert) {
  db.list({startkey: 'c'}, function (error, docs) {
    assert.equal(error, undefined, "Startkey didn't work");
    assert.ok(docs.rows, "Got rows");
    assert.equal(docs.rows.length, 2, "Started in row two");
    assert.equal(docs.total_rows, 3, "Got total three rows");
    assert.equal(docs.offset, 1, "Offset by 1");
  });
});

specify("doc_list:teardown", timeout, function (assert) {
  nano.db.destroy("doc_list", function (err) {
    assert.equal(err, undefined, "Failed to destroy database");
    assert.ok(mock.isDone(), "Some mocks didn't run");
  });
});

specify.run(process.argv.slice(2));