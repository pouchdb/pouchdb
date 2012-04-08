var remote = {
  host: 'localhost:1234'
};

module('attachments', {
  setup : function () {
    this.name = 'test_suite_db';
    this.remote = 'http://' + remote.host + '/test_suite_db/';
    //this.name = this.remote;
  }
});

var binAttDoc = {
  _id: "bin_doc",
  _attachments:{
    "foo.txt": {
      content_type:"text/plain",
      data: "VGhpcyBpcyBhIGJhc2U2NCBlbmNvZGVkIHRleHQ="
    }
  }
};

// empty attachment
var binAttDoc2 = {
  _id: "bin_doc2",
  _attachments:{
    "foo.txt": {
      content_type:"text/plain",
      data: ""
    }
  }
}

asyncTest("Test some attachments", function() {
  var db;
  initTestDB(this.name, function(err, _db) {
    db = _db;
    db.put(binAttDoc, function(err, write) {
      ok(!err, 'saved doc with attachment');
      db.get('bin_doc/foo.txt', function(err, res) {
        ok(res === 'This is a base64 encoded text', 'Correct data returned');
        db.put(binAttDoc2, function(err, rev) {
          db.get('bin_doc2/foo.txt', function(err, res, xhr) {
            ok(res === '', 'Correct data returned');
            moreTests(rev.rev);
           });
        });
      });
    });
  });

  function moreTests(rev) {
    var ndoc = 'This is no base64 encoded text';
    db.putAttachment('bin_doc2/foo2.txt', rev, ndoc, "text/plain", function() {
      db.get('bin_doc2/foo2.txt', function(err, res, xhr) {
        ok(res === 'This is no base64 encoded text', 'Correct data returned');
        start();
      });
    });
  };

});
