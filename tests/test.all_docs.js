// Porting tests from Apache CouchDB bulk docs tests
// https://github.com/apache/couchdb/blob/master/share/www/script/test/bulk_docs.js

// Note: writing sync tests over an async api sucks, havent found a decent
// dataflow type library I like yet

// all_or_nothing is not implemented

module('all_docs', {
  setup : function () {
    this.name = 'test_suite_db';
  }
});

asyncTest('Testing all docs', function() {

  var db;
  var docs = [
    {_id:"0",a:1,b:1},
    {_id:"3",a:4,b:16},
    {_id:"1",a:2,b:4},
    {_id:"2",a:3,b:9}
  ];

  function writeDocs(callback) {
    if (!docs.length) {
      return callback();
    }
    var doc = docs.shift();
    db.put(doc, function(err, doc) {
      ok(doc.ok, 'docwrite returned ok');
      writeDocs(callback);
    });
  };

  initTestDB(this.name, function(err, _db) {
    db = _db;
    writeDocs(function() {
      db.allDocs(function(err, result) {
        var rows = result.rows;
        ok(result.total_rows === 4, 'correct number of results');
        for(var i=0; i < rows.length; i++) {
          ok(rows[i].id >= "0" && rows[i].id <= "4", 'correct ids');
        }
        db.allDocs({startkey:"2"}, function(err, all) {
          // TODO: implement offset
          //ok(all.offset == 2, 'offset correctly set');
          var opts = {startkey: "org.couchdb.user:", endkey: "org.couchdb.user;"};
          db.allDocs(opts, function(err, raw) {
            ok(raw.rows.length === 0, 'raw collation');
            var ids = ["0","3","1","2"];
            db.changes(function(err, changes) {
              changes.results.forEach(function(row, i) {
                ok(row.id === ids[i], 'seq order');
              });
              db.changes({
                descending: true,
                complete: function(err, changes) {
                  ids = ["2","1","3","0"];
                  changes.results.forEach(function(row, i) {
                    ok(row.id === ids[i], 'descending=true');
                  });
                  start();
                }
              });
            });
          });
        });
      });
    });
  });
});

asyncTest('Testing deleting in changes', function() {
  pouch.open(this.name, function(err, db) {
    db.get('1', function(err, doc) {
      db.remove(doc, function(err, deleted) {
        ok(deleted.ok, 'deleted');
        db.changes(function(err, changes) {
          ok(changes.results.length == 4);
          ok(changes.results[3].id == "1");
          ok(changes.results[3].deleted);
          start();
        });
      });
    });
  });
});

asyncTest('Testing updating in changes', function() {
  pouch.open(this.name, function(err, db) {
    db.get('3', function(err, doc) {
      doc.updated = 'totally';
      db.put(doc, function(err, doc) {
        db.changes(function(err, changes) {
          ok(changes.results.length === 4);
          ok(changes.results[3].id === "3");
          start();
        });
      });
    });
  });
});

asyncTest('Testing include docs', function() {
  pouch.open(this.name, function(err, db) {
    db.changes({include_docs: true}, function(err, changes) {
      ok(changes.results.length == 4);
      ok(changes.results[3].id == "3");
      ok(changes.results[3].doc.updated == "totally");
      ok(changes.results[2].doc);
      ok(changes.results[2].doc._deleted);
      start();
    });
  });
});
