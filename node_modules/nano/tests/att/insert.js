var specify  = require('specify')
  , helpers  = require('../helpers')
  , timeout  = helpers.timeout
  , nano     = helpers.nano
  , nock     = helpers.nock
  ;

var mock = nock(helpers.couch, "att/insert")
  , db = nano.use("att_insert")
  ;

specify("att_insert:setup", timeout, function (assert) {
  nano.db.create("att_insert", function (err) {
    assert.equal(err, undefined, "Failed to create database");
  });
});

specify("att_insert:test", timeout, function (assert) {
  db.attachment.insert("new", "att", "Hello World!", "text/plain",
    function (error, att) {
      assert.equal(error, undefined, "Should store the attachment");
      assert.equal(att.ok, true, "Response should be ok");
      assert.ok(att.rev, "Should have a revision number");
  });
});

specify("att_insert:teardown", timeout, function (assert) {
  nano.db.destroy("att_insert", function (err) {
    assert.equal(err, undefined, "Failed to destroy database");
    assert.ok(mock.isDone(), "Some mocks didn't run");
  });
});

specify.run(process.argv.slice(2));