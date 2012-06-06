[['idb-1', 'http-1'],
 ['http-1', 'http-2'],
 ['http-1', 'idb-1'],
 ['idb-1', 'idb-2']].map(function(adapters) {

  module('replication: ' + adapters[0] + ':' + adapters[1], {
    setup : function () {
      this.name = generateAdapterUrl(adapters[0]);
      this.remote = generateAdapterUrl(adapters[1]);
    }
  });

  var docs = [
    {_id: "0", integer: 0, string: '0'},
    {_id: "1", integer: 1, string: '1'},
    {_id: "2", integer: 2, string: '2'}
  ];

  asyncTest("Test basic pull replication", function() {
    console.info('Starting Test: Test basic pull replication');
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
    console.info('Starting Test: Local DB contains documents');
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
    console.info('Starting Test: Test basic push replication');
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
    console.info('Starting Test: Test basic push replication take 2');
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
    console.info('Starting Test: Test checkpoint');
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
    console.info('Starting Test: Test checkpoint 2');
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
    console.info('Starting Test: Test checkpoint 3 :)');
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
    console.info('Starting Test: Test basic conflict');
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
    console.info('Starting Test: Test basic continous pull replication');
    var self = this;
    var doc1 = {_id: 'adoc', foo:'bar'};
    initDBPair(this.name, this.remote, function(db, remote) {
      remote.bulkDocs({docs: docs}, {}, function(err, results) {
        var count = 0;
        var rep = db.replicate.from(self.remote, {continuous: true});
        var changes = db.changes({
          onChange: function(change) {
            ++count;
            if (count === 3) {
              return remote.put(doc1);
            }
            if (count === 4) {
              ok(true, 'Got all the changes');
              rep.cancel();
              changes.cancel();
              start();
            }
          },
          continuous: true,
        });
      });
    });
  });

  asyncTest("Test basic continous push replication", function() {
    console.info('Starting Test: Test basic continous push replication');
    var self = this;
    var doc1 = {_id: 'adoc', foo:'bar'};
    initDBPair(this.name, this.remote, function(db, remote) {
      db.bulkDocs({docs: docs}, {}, function(err, results) {
        var count = 0;
        var rep = remote.replicate.from(db, {continuous: true});
        var changes = remote.changes({
          onChange: function(change) {
            ++count;
            if (count === 4) {
              ok(true, 'Got all the changes');
              rep.cancel();
              changes.cancel();
              start();
            }
          },
          continuous: true,
        });
        setTimeout(function() {
          db.put(doc1, {});
        }, 50);
      });
    });
  });

  asyncTest("Test cancel pull replication", function() {
    console.info('Starting Test: Test cancel pull replication');
    var self = this;
    var doc1 = {_id: 'adoc', foo:'bar'};
    var doc2 = {_id: 'anotherdoc', foo:'baz'};
    initDBPair(this.name, this.remote, function(db, remote) {
      remote.bulkDocs({docs: docs}, {}, function(err, results) {
        var count = 0;
        var replicate = db.replicate.from(self.remote, {continuous: true});
        var changes = db.changes({
          continuous: true,
          onChange: function(change) {
            ++count;
            if (count === 3) {
              remote.put(doc1);
            }
            if (count === 4) {
              replicate.cancel();
              remote.put(doc2);
              setTimeout(function() {
                ok(count === 4, 'got no more docs');
                changes.cancel();
                start();
              }, 500);
            }
          },
        });
      });
    });
  });

  asyncTest("Replication filter", function() {
    console.info('Starting Test: Replication filter');
    var docs1 = [
      {_id: "0", integer: 0},
      {_id: "1", integer: 1},
      {_id: "2", integer: 2},
      {_id: "3", integer: 3}
    ];

    initDBPair(this.name, this.remote, function(db, remote) {
      remote.bulkDocs({docs: docs1}, function(err, info) {
        var replicate = db.replicate.from(remote, {
          continuous: true,
          filter: function(doc) { return doc.integer % 2 === 0; }
        });
        setTimeout(function() {
          db.allDocs(function(err, docs) {
            equal(docs.rows.length, 2);
            replicate.cancel();
            start();
          });
        }, 500);
      });
    });
  });

  asyncTest("Attachments replicate", function() {
    console.info('Starting Test: Attachments replicate');

    var binAttDoc = {
      _id: "bin_doc",
      _attachments:{
        "foo.txt": {
          content_type:"text/plain",
          data: "VGhpcyBpcyBhIGJhc2U2NCBlbmNvZGVkIHRleHQ="
        }
      }
    };

    var docs1 = [
      binAttDoc,
      {_id: "0", integer: 0},
      {_id: "1", integer: 1},
      {_id: "2", integer: 2},
      {_id: "3", integer: 3}
    ];

    initDBPair(this.name, this.remote, function(db, remote) {
      remote.bulkDocs({docs: docs1}, function(err, info) {
        var replicate = db.replicate.from(remote, function() {
          db.get('bin_doc', {attachments: true}, function(err, doc) {
            equal(binAttDoc._attachments['foo.txt'].data,
                  doc._attachments['foo.txt'].data);
            start();
          });
        });
      });
    });
  });

  asyncTest("Pull replication with removed item", function(){
    console.info('Starting Test: Pull replication with removed item');
    var self = this;
    initDBPair(this.name, this.remote, function(db, remote) {
      remote.bulkDocs({docs: docs}, {}, function(err, results) {
        db.replicate.from(self.remote, function(err, result) {
          ok(result.ok, 'basic replication was ok');
          ok(result.docs_written = docs.length, 'correct # docs written');
          remote.allDocs(function(err,docs){
            var removedId = docs.rows[0].id;
            remote.get(removedId, function(err,doc){
              remote.remove(doc, function(err,doc){
                remote.allDocs(function(err,docs){
                });
                db.replicate.from(self.remote, function(err,result){
                  ok(result.ok, 'replication after remove was ok');
                  ok(result.docs_written == 1, 'correct # docs written');
                  db.get(removedId, function(err,doc){
                    ok(!!err, 'local can\'t find removed item');
                    if(!!err){
                      equal(err.error, 'not_found', 'error is "not found"');
                      equal(err.reason , 'missing', 'and reason id "deleted"');
                    }
                    start();
                  });
                });
              });
            });
          });
        });
      });
    });
  });
    asyncTest("Push replication with removed item", function(){
      console.info('Starting Test: Push replication with removed item');
      var self = this;
      initDBPair(this.name, this.remote, function(db, remote) {
        remote.bulkDocs({docs: docs}, {}, function(err, results) {
          db.replicate.from(self.remote, function(err, result) {
            ok(result.ok, 'basic replication was ok');
            ok(result.docs_written = docs.length, 'correct # docs written');
            db.allDocs(function(err,docs){
              var removedId = docs.rows[0].id;
              db.get(removedId, function(err,doc){
                db.remove(doc, function(err,doc){
                  db.allDocs(function(err,docs){
                  });
                  db.replicate.to(self.remote, function(err,result){
                    ok(result.ok, 'replication after remove was ok');
                    ok(result.docs_written == 1, 'correct # docs written');
                    remote.get(removedId, function(err,doc){
                      ok(!!err, 'remote can\'t find removed item');
                      if(!!err){
                        equal(err.error, 'not_found', 'error is "not found"');
                        equal(err.reason , 'missing', 'and reason id "deleted"');
                      }
                      start();
                    });
                  });
                });
              });
            });
          });
        });
      });
    });

});