var specify  = require('specify')
  , helpers  = require('../helpers')
  , timeout  = helpers.timeout
  , nano     = helpers.nano
  , nock     = helpers.nock
  ;

var mock = nock(helpers.couch, "doc/bulk")
  , db   = nano.use("doc_bulk")
  ;

specify("doc_bulk:setup", timeout, function (assert) {
  nano.db.create("doc_bulk", function (err) {
    assert.equal(err, undefined, "Failed to create database");
  });
});

specify("doc_bulk:test", timeout, function (assert) {
  db.bulk(
  {"docs":[{"key":"baz","name":"bazzel"},{"key":"bar","name":"barry"}]},
  function (error,response) {
    assert.equal(error, undefined, 'No error');
    assert.equal(response.length, 2, 'Has two docs');
    assert.ok(response[0].id, 'First got id');
    assert.ok(response[1].id, 'Second got id');
  });
});

specify("doc_bulk:teardown", timeout, function (assert) {
  nano.db.destroy("doc_bulk", function (err) {
    assert.equal(err, undefined, "Failed to destroy database");
    assert.ok(mock.isDone(), "Some mocks didn't run");
  });
});

specify.run(process.argv.slice(2));