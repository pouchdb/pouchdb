module("changes", {
  setup : function () {
    this.name = 'idb://test_suite_db';
  }
});

asyncTest("All changes", function () {
  initTestDB(this.name, function(err, db) {
    db.post({test:"somestuff"}, function (err, info) {
      db.changes({
        onChange: function (change) {
          ok(change.seq);
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
        onChange: function (change) {
          ok(change.doc);
          equal(change.doc._id, change.id);
          ok(!change.doc._junk, 'Do not expose junk');
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
      onChange: function(change) { count += 1; },
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

asyncTest("Cancel changes", function() {
  initTestDB(this.name, function(err, db) {
    var count = 0;
    var changes = db.changes({
      onChange: function(change) { count += 1; },
      continuous: true
    });
    db.post({test:"adoc"}, function(err, info) {
      changes.cancel();
      db.post({test:"another doc"}, function(err, info) {
        setTimeout(function() {
          equal(count, 1);
          start();
        }, 50);
      });
    });
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
