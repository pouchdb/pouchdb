module('views', {
  setup : function () {
    this.name = 'test_suite_db';
  }
});

asyncTest("Create a pouch", function() {

  var values = [];

  // special values sort before all other types
  values.push(null);
  values.push(false);
  values.push(true);

  // then numbers
  values.push(1);
  values.push(2);
  values.push(3.0);
  values.push(4);

  // then text, case sensitive
  values.push("a");
  values.push("A");
  values.push("aa");
  values.push("b");
  values.push("B");
  values.push("ba");
  values.push("bb");

  // then arrays. compared element by element until different.
  // Longer arrays sort after their prefixes
  values.push(["a"]);
  values.push(["b"]);
  values.push(["b","c"]);
  values.push(["b","c", "a"]);
  values.push(["b","d"]);
  values.push(["b","d", "e"]);

  // then object, compares each key value in the list until different.
  // larger objects sort after their subset objects.
  values.push({a:1});
  values.push({a:2});
  values.push({b:1});
  values.push({b:2});
  values.push({b:2, a:1}); // Member order does matter for collation.
  // CouchDB preserves member order
  // but doesn't require that clients will.
  // (this test might fail if used with a js engine
  // that doesn't preserve order)
  values.push({b:2, c:2});

  initTestDB(this.name, function(err, db) {
    var docs = values.map(function(x, i) {
      return {_id: (i).toString(), foo: x};
    });
    db.bulkDocs({docs: docs}, {}, function() {
      var queryFun = function(doc) { emit(doc.foo, null); };
      db.query(queryFun, null, function(_, res) {
        res.rows.forEach(function(x, i) {
          ok(JSON.stringify(x.key) === JSON.stringify(values[i]), 'keys collate');
        });
        db.query(queryFun, null, {descending: true}, function(_, res) {
          res.rows.forEach(function(x, i) {
            ok(JSON.stringify(x.key) === JSON.stringify(values[values.length - 1 - i]),
               'keys collate descending')
          });
          start();
        });
      });
    });
  });

});

