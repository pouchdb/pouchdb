// Just leaving the credentials in there, only ever used to test so worst
// someone can do is make tests fail

// Couch currently doesnt support CORS, which means replications need to
// happen from the server the idb database is served from
var remote = {
  host: 'localhost:1234'
};

module('replication', {
  setup : function () {
    this.name = 'test_suite_db';
  }
});

asyncTest("Test basic pull replication", function() {

  var docs = [
    {_id: "0", integer: 0, string: '0'},
    {_id: "1", integer: 1, string: '1'},
    {_id: "2", integer: 2, string: '2'}
  ];

  var remoteUrl = 'http://' + remote.host + '/test_suite_db/';

  initTestDB(this.name, function(err, db) {
    initTestDB(remoteUrl, function(err, remote) {
      remote.bulkDocs({docs: docs}, {}, function(err, results) {
        db.replicate.from(remoteUrl, function(err, result) {
          ok(result.length === docs.length);
          start();
        });
      });
    });
  });
});
