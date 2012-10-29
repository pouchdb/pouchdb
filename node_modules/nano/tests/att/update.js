var specify  = require('specify')
  , helpers  = require('../helpers')
  , timeout  = helpers.timeout
  , nano     = helpers.nano
  , nock     = helpers.nock
  , pixel    = helpers.pixel
  , rev
  ;

var mock = nock(helpers.couch, "att/update")
  , db   = nano.use("att_update")
  ;

specify("att_update:setup", timeout, function (assert) {
  nano.db.create("att_update", function (err) {
    assert.equal(err, undefined, "Failed to create database");
  });
});

specify("att_update:test", timeout, function (assert) {
  var buffer = new Buffer(pixel, 'base64');
    db.attachment.insert("new", "att", "Hello", "text/plain", 
    function(error, hello) {
      assert.equal(error, undefined, "Should store hello");
      assert.equal(hello.ok, true, "Response should be ok");
      assert.ok(hello.rev, "Should have a revision number");
      db.attachment.insert("new", "att", buffer, "image/bmp", 
      { rev: hello.rev }, function (error, bmp) {
        assert.equal(error, undefined, "Should store the pixel");
        assert.ok(bmp.rev, "Should have a revision number");
        rev = bmp.rev;
      });
    });
});

specify("att_update:metadata", timeout, function (assert) {
  db.get("new", function (error, new_doc) {
    assert.equal(error, undefined, "Should get new");
    new_doc.works = true;
    db.insert(new_doc, "new", function (error, response) {
      assert.equal(error, undefined, "Should update doc");
      assert.equal(response.ok, true, "Response should be ok");
    });
  });
});

specify("att_update:teardown", timeout, function (assert) {
  nano.db.destroy("att_update", function (err) {
    assert.equal(err, undefined, "Failed to destroy database");
    assert.ok(mock.isDone(), "Some mocks didn't run");
  });
});

specify.run(process.argv.slice(2));