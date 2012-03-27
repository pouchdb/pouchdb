module('replication', {
  setup : function () {
    this.name = 'test_suite_db';
  }
});

var remote = {
  host: 'localhost:1234'
};

var docs = [
  {_id: "0", integer: 0, string: '0'},
  {_id: "1", integer: 1, string: '1'},
  {_id: "2", integer: 2, string: '2'}
];

asyncTest("Test basic pull replication", function() {
  var remoteUrl = 'http://' + remote.host + '/test_suite_db/';
  initTestDB(this.name, function(err, db) {
    initTestDB(remoteUrl, function(err, remote) {
      remote.bulkDocs({docs: docs}, {}, function(err, results) {
        db.replicate.from(remoteUrl, function(err, result) {
          ok(result.ok, 'replication was ok');
          ok(result.docs_written = docs.length, 'correct # docs written');
          start();
        });
      });
    });
  });
});

asyncTest("Local DB contains documents", function() {
  var remoteUrl = 'http://' + remote.host + '/test_suite_db/';
  initTestDB(this.name, function(err, db) {
    initTestDB(remoteUrl, function(err, remote) {
      remote.bulkDocs({docs: docs}, {}, function(err, _) {
        db.bulkDocs({docs: docs}, {}, function(err, _) {
          db.replicate.from(remoteUrl, function(err, _) {
            db.allDocs(function(err, result) {
              ok(result.rows.length === docs.length, 'correct # docs exist');
              start();
            });
          });
        });
      });
    });
  });
});

asyncTest("Test basic push replication", function() {
  var remoteUrl = 'http://' + remote.host + '/test_suite_db/';
  initTestDB(this.name, function(err, db) {
    initTestDB(remoteUrl, function(err, remote) {
      db.bulkDocs({docs: docs}, {}, function(err, results) {
        db.replicate.to(remoteUrl, function(err, result) {
          ok(result.ok, 'replication was ok');
          ok(result.docs_written === docs.length, 'correct # docs written');
          start();
        });
      });
    });
  });
});

asyncTest("Test basic push replication take 2", function() {
  var remoteUrl = 'http://' + remote.host + '/test_suite_db/';
  initTestDB(this.name, function(err, db) {
    initTestDB(remoteUrl, function(err, remote) {
      db.bulkDocs({docs: docs}, {}, function(err, _) {
        db.replicate.to(remoteUrl, function(err, _) {
          remote.allDocs(function(err, result) {
            ok(result.rows.length === docs.length, 'correct # docs written');
            start();
          });
        });
      });
    });
  });
});

asyncTest("Test checkpoint", function() {
  var remoteUrl = 'http://' + remote.host + '/test_suite_db/';
  initTestDB(this.name, function(err, db) {
    initTestDB(remoteUrl, function(err, remote) {
      remote.bulkDocs({docs: docs}, {}, function(err, results) {
        db.replicate.from(remoteUrl, function(err, result) {
          ok(result.ok, 'replication was ok');
          ok(result.docs_written === docs.length, 'correct # docs written');
          db.replicate.from(remoteUrl, function(err, result) {
            ok(result.ok, 'replication was ok');
            ok(result.docs_written === 0, 'correct # docs written');
            ok(result.docs_read === 0, 'no docs read');
            start();
          });
        });
      });
    });
  });
});
