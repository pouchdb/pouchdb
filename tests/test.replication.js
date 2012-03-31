var remote = {
  host: 'localhost:1234'
};

module('replication', {
  setup : function () {
    this.name = 'test_suite_db';
    this.remote = 'http://' + remote.host + '/test_suite_db/';
  }
});

var docs = [
  {_id: "0", integer: 0, string: '0'},
  {_id: "1", integer: 1, string: '1'},
  {_id: "2", integer: 2, string: '2'}
];

asyncTest("Test basic pull replication", function() {
  var self = this;
  initDBPair(this.name, this.remote, function(db, remote) {
    remote.bulkDocs({docs: docs}, {}, function(err, results) {
      db.replicate.from(self.remote, function(err, result) {
        ok(result.ok, 'replication was ok');
        ok(result.docs_written = docs.length, 'correct # docs written');
        start();
      });
    });
  });
});

asyncTest("Local DB contains documents", function() {
  var self = this;
  initDBPair(this.name, this.remote, function(db, remote) {
    remote.bulkDocs({docs: docs}, {}, function(err, _) {
      db.bulkDocs({docs: docs}, {}, function(err, _) {
        db.replicate.from(self.remote, function(err, _) {
          db.allDocs(function(err, result) {
            ok(result.rows.length === docs.length, 'correct # docs exist');
            start();
          });
        });
      });
    });
  });
});

asyncTest("Test basic push replication", function() {
  var self = this;
  initDBPair(this.name, this.remote, function(db, remote) {
    db.bulkDocs({docs: docs}, {}, function(err, results) {
      db.replicate.to(self.remote, function(err, result) {
        ok(result.ok, 'replication was ok');
        ok(result.docs_written === docs.length, 'correct # docs written');
        start();
      });
    });
  });
});

asyncTest("Test basic push replication take 2", function() {
  var self = this;
  initDBPair(this.name, this.remote, function(db, remote) {
    db.bulkDocs({docs: docs}, {}, function(err, _) {
      db.replicate.to(self.remote, function(err, _) {
        remote.allDocs(function(err, result) {
          ok(result.rows.length === docs.length, 'correct # docs written');
          start();
        });
      });
    });
  });
});

asyncTest("Test checkpoint", function() {
  var self = this;
  initDBPair(this.name, this.remote, function(db, remote) {
    remote.bulkDocs({docs: docs}, {}, function(err, results) {
      db.replicate.from(self.remote, function(err, result) {
        ok(result.ok, 'replication was ok');
        ok(result.docs_written === docs.length, 'correct # docs written');
        db.replicate.from(self.remote, function(err, result) {
          ok(result.ok, 'replication was ok');
          ok(result.docs_written === 0, 'correct # docs written');
          ok(result.docs_read === 0, 'no docs read');
          start();
        });
      });
    });
  });
});

asyncTest("Test basic conflict", function() {
  var self = this;
  initDBPair(this.name, this.remote, function(db, remote) {
    var doc = {_id: 'adoc', foo:'bar'};
    db.put(doc, function(err, localres) {
      remote.put(doc, function(err, remoteres) {
        db.replicate.to(self.remote, function(err, _) {
          remote.get('adoc', {conflicts: true}, function(err, result) {
            ok(result._conflicts, 'result has a conflict');
            start();
          });
        });
      });
    });
  });
});
