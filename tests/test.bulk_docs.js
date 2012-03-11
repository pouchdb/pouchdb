module('bulk_docs', {
  setup : function () {
    this.name = 'test' + genDBName();
  }
});

asyncTest('Testing bulk docs', function() {
  pouch.open(this.name, function(err, db) {
    var docs = makeDocs(5);
    db.bulkDocs({docs: docs}, function(err, results) {
      ok(results.length === 5, 'results length matches');
      for (var i = 0; i < 5; i++) {
        ok(results[i].id === docs[i]._id, 'id matches');
        ok(results[i].rev, 'rev is set');
        // Update the doc
        docs[i]._rev = results[i].rev;
        docs[i].string = docs[i].string + ".00";
      }
      db.bulkDocs({docs: docs}, function(err, results) {
        ok(results.length === 5, 'results length matches');
        for (i = 0; i < 5; i++) {
          ok(results[i].id == i.toString(), 'id matches again');
          // set the delete flag to delete the docs in the next step
          docs[i]._rev = results[i].rev;
          docs[i]._deleted = true;
        }
        db.put(docs[0], function(err, doc) {
          db.bulkDocs({docs: docs}, function(err, results) {
            ok(results[0].error === 'conflict', 'First doc should be in conflict');
            ok(typeof results[0].rev === "undefined", 'no rev in conflict');
            for (i = 1; i < 5; i++) {
              ok(results[i].id == i.toString());
              ok(results[i].rev);
            }
            start();
          });
        });
      });
    });
  });
});