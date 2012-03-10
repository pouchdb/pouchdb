module("changes", {
  setup : function () {
    this.name = 'test' + Math.uuid();
  }
});

asyncTest("All changes", function () {
  pouch.open(this.name, function(err, db) {
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
  pouch.open(this.name, function(err, db) {
    var count = 0;
    db.changes({
      onChange: function(change) { count += 1; },
      continuous : true,
      seq : db.seq + 1,
      complete: function() {
        equal(count, 0);
        db.post({test:"another"}, function(err, info) {
          setTimeout(function() {
            equal(count, 1);
            start();
          }, 50);
        });
      }
    });
  });
});

