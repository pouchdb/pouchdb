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
        ok(results[i].id == docs[i]._id, 'id matches');
        ok(results[i].rev, 'rev is set');
        // Update the doc
        docs[i].string = docs[i].string + ".00";
      }
      start();
    });
  });
});