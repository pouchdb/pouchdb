module("design_docs", {
  setup : function () {
    this.name = 'idb://test_suite_db';
  }
});

var doc = {
  _id: '_design/foo',
  _views: {
    names: {
      map: 'function(doc) { if (doc.name) { emit(null, doc.name); } }'
    }
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
