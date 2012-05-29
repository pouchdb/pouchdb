['idb-1', 'http-1'].map(function(adapter) {

  module("design_docs: " + adapter, {
    setup : function () {
      this.name = generateAdapterUrl(adapter);
    }
  });

  var doc = {
    _id: '_design/foo',
    views: {
      scores: {
        map: 'function(doc) { if (doc.score) { emit(null, doc.score); } }',
        reduce: '_sum'
      }
    },
    filters: {
      even: 'function(doc) { return doc.integer % 2 === 0; }'
    }
  };

  asyncTest("Test writing design doc", function () {
    initTestDB(this.name, function(err, db) {
      db.post(doc, function (err, info) {
        ok(!err, 'Wrote design doc');
        db.get('_design/foo', function (err, info) {
          ok(!err, 'Read design doc');
          start();
        });
      });
    });
  });

  asyncTest("Changes filter", function() {

    var docs1 = [
      doc,
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
          filter: 'foo/even',
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

  asyncTest("Basic views", function () {

    var docs1 = [
      doc,
      {_id: "dale", score: 3},
      {_id: "mikeal", score: 5},
      {_id: "max", score: 4},
      {_id: "nuno", score: 3}
    ];

    initTestDB(this.name, function(err, db) {
      db.bulkDocs({docs: docs1}, function(err, info) {
        db.query('foo/scores', {reduce: false}, function(err, result) {
          equal(result.rows.length, 4, 'Correct # of results');
          start();
        });
      });
    });
  });

});