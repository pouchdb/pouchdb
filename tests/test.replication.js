var remote = {
  host: document.location.hostname + ':1234'
};

module('replication', {
  setup : function () {
    this.name = 'idb://test_suite_db';
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

asyncTest("Test checkpoint 2", function() {
  var self = this;
  var doc = {_id: "3", count: 0};
  initDBPair(this.name, this.remote, function(db, remote) {
    remote.put(doc, {}, function(err, results) {
      db.replicate.from(self.remote, function(err, result) {
        ok(result.ok, 'replication was ok');
        doc._rev = results.rev;
        doc.count++;
        remote.put(doc, {}, function(err, results) {
          doc._rev = results.rev;
          doc.count++;
          remote.put(doc, {}, function(err, results) {
            db.replicate.from(self.remote, function(err, result) {
              ok(result.ok, 'replication was ok');
              ok(result.docs_written === 1, 'correct # docs written');
              start();
            });
          });
        });
      });
    });
  });
});

asyncTest("Test checkpoint 3 :)", function() {
  var self = this;
  var doc = {_id: "3", count: 0};
  initDBPair(this.name, this.remote, function(db, remote) {
    db.put(doc, {}, function(err, results) {
      Pouch.replicate(db, remote, {}, function(err, result) {
        ok(result.ok, 'replication was ok');
        doc._rev = results.rev;
        doc.count++;
        db.put(doc, {}, function(err, results) {
          doc._rev = results.rev;
          doc.count++;
          db.put(doc, {}, function(err, results) {
            Pouch.replicate(db, remote, {}, function(err, result) {
              ok(result.ok, 'replication was ok');
              ok(result.docs_written === 1, 'correct # docs written');
              start();
            });
          });
        });
      });
    });
  });
});


// CouchDB will not generate a conflict here, it uses a deteministic
// method to generate the revision number, however we cannot copy its
// method as it depends on erlangs internal data representation
asyncTest("Test basic conflict", function() {
  var self = this;
  var doc1 = {_id: 'adoc', foo:'bar'};
  var doc2 = {_id: 'adoc', bar:'baz'};
  initDBPair(this.name, this.remote, function(db, remote) {
    db.put(doc1, function(err, localres) {
      remote.put(doc2, function(err, remoteres) {
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

asyncTest("Test basic continous pull replication", function() {
  var self = this;
  var doc1 = {_id: 'adoc', foo:'bar'};
  initDBPair(this.name, this.remote, function(db, remote) {
    remote.bulkDocs({docs: docs}, {}, function(err, results) {
      var count = 0;
      var rep = db.replicate.from(self.remote, {continous: true});
      var change = db.changes({
        onChange: function(change) {
          ++count;
          if (count === 4) {
            ok(true, 'Got all the changes');
            start();
          }
        },
        continuous : true,
      });
      setTimeout(function() {
        remote.put(doc1);
      }, 50);
    });
  });
});
