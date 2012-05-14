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
