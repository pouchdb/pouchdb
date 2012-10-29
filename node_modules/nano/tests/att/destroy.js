var specify  = require('specify')
  , helpers  = require('../helpers')
  , timeout  = helpers.timeout
  , nano     = helpers.nano
  , nock     = helpers.nock
  ;

var mock = nock(helpers.couch, "att/destroy")
  , db   = nano.use("att_destroy")
  ;

specify("att_destroy:setup", timeout, function (assert) {
  nano.db.create("att_destroy", function (err) {
    assert.equal(err, undefined, "Failed to create database");
  });
});

specify("att_destroy:test", timeout, function (assert) {
  db.attachment.insert("new", "att", "Hello World!", "text/plain",
  function (error, att) {
    assert.equal(error, undefined, "Should store the attachment");
    assert.equal(att.ok, true, "Response should be ok");
    assert.ok(att.rev, "Should have a revision number");
    db.attachment.destroy("new", "att", att.rev, function(error, response) {
      assert.equal(error, undefined, "Should delete the attachment");
      assert.equal(response.ok, true, "Response should be ok");
      assert.equal(response.id, "new", "Id should be new");
    });
  });
});

specify("att_destroy:teardown", timeout, function (assert) {
  nano.db.destroy("att_destroy", function (err) {
    assert.equal(err, undefined, "Failed to destroy database");
    assert.ok(mock.isDone(), "Some mocks didn't run");
  });
});

specify.run(process.argv.slice(2));