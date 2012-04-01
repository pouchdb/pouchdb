var remote = {
  host: 'localhost:1234'
};

module('attachments', {
  setup : function () {
    this.name = 'test_suite_db';
    this.remote = 'http://' + remote.host + '/test_suite_db/';
    this.name = this.remote;
  }
});

asyncTest("Test some attachments", function() {

  var binAttDoc = {
    _id: "bin_doc",
    _attachments:{
      "foo.txt": {
        content_type:"text/plain",
        data: "VGhpcyBpcyBhIGJhc2U2NCBlbmNvZGVkIHRleHQ="
      }
    }
  };

  initTestDB(this.name, function(err, db) {
    db.put(binAttDoc, function(err, _) {
      ok(!err, 'saved doc with attachment');
      db.get('bin_doc/foo.txt', function() {
        console.log(arguments);
        start();
      });
    });
  });

});

