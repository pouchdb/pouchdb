['idb-1', 'http-1'].map(function(adapter) {

  module("changes: " + adapter, {
    setup : function () {
      this.name = generateAdapterUrl(adapter);
    }
  });

  asyncTest("All changes", function () {
    initTestDB(this.name, function(err, db) {
      db.post({test:"somestuff"}, function (err, info) {
        db.changes({
          onChange: function (change) {
            ok(!change.doc, 'If we dont include docs, dont include docs');
            ok(change.seq, 'Received a sequence number');
            start();
          },
          error: function() {
            ok(false);
            start();
          }
        });
      });
    });
  });

  asyncTest("Changes doc", function () {
    initTestDB(this.name, function(err, db) {
      db.post({test:"somestuff"}, function (err, info) {
        db.changes({
          include_docs: true,
          onChange: function (change) {
            ok(change.doc);
            equal(change.doc._id, change.id);
            equal(change.doc._rev, change.changes[change.changes.length - 1].rev);
            start();
          },
          error: function() {
            ok(false);
            start();
          }
        });
      });
    });
  });

  asyncTest("Continuous changes", function() {
    initTestDB(this.name, function(err, db) {
      var count = 0;
      var changes = db.changes({
        onChange: function(change) {
          count += 1;
          ok(!change.doc, 'If we dont include docs, dont include docs');
        },
        continuous: true
      });
      db.post({test:"adoc"}, function(err, info) {
        setTimeout(function() {
          equal(count, 1);
          changes.cancel();
          start();
        }, 50);
      });
    });
  });

  asyncTest("Continuous changes doc", function() {
    initTestDB(this.name, function(err, db) {
      var changes = db.changes({
        onChange: function(change) {
          ok(change.doc, 'doc included');
          ok(change.doc._rev, 'rev included');
        },
        continuous: true,
        include_docs: true
      });
      db.post({test:"adoc"}, function(err, info) {
        setTimeout(function() {
          changes.cancel();
          start();
        }, 50);
      });
    });
  });

  asyncTest("Cancel changes", function() {
    initTestDB(this.name, function(err, db) {
      var count = 0;
      var changes = db.changes({
        onChange: function(change) {
          count += 1;
          if (count === 1) {
            changes.cancel();
            db.post({test:"another doc"}, function(err, info) {
              setTimeout(function() {
                equal(count, 1);
                start();
              }, 200);
            });
          }
        },
        continuous: true
      });
      db.post({test:"adoc"}, function() {});
    });
  });

  asyncTest("Changes filter", function() {

    var docs1 = [
      {_id: "0", integer: 0},
      {_id: "1", integer: 1},
      {_id: "2", integer: 2},
      {_id: "3", integer: 3}
    ];

    var docs2 = [
      {_id: "4", integer: 4},
      {_id: "5", integer: 5},
      {_id: "6", integer: 6},
      {_id: "7", integer: 7}
    ];

    initTestDB(this.name, function(err, db) {
      var count = 0;
      db.bulkDocs({docs: docs1}, function(err, info) {
        var changes = db.changes({
          filter: function(doc) { return doc.integer % 2 === 0; },
          onChange: function(change) {
            count += 1;
          },
          continuous: true
        });
        db.bulkDocs({docs: docs2}, function(err, info) {
          setTimeout(function() {
            equal(count, 4);
            changes.cancel();
            start();
          }, 100);
        });
      });
    });
  });

});
