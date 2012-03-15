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
  initTestDB(this.name, function(err, db) {
    var docs = [
      {_id:"0",a:1,b:1},
      {_id:"3",a:4,b:16},
      {_id:"1",a:2,b:4},
      {_id:"2",a:3,b:9}
    ];
    db.bulkDocs({docs: docs}, function(err, result) {
      result.forEach(function(doc) {
        ok(doc.ok, 'doc write returned ok');
      });
      db.allDocs(function(err, result) {
        var rows = result.rows;
        ok(result.total_rows === 4, 'correct number of results');
        for(var i=0; i < rows.length; i++) {
          ok(rows[i].id >= "0" && rows[i].id <= "4", 'correct ids');
        }
        db.allDocs({startkey:"2"}, function(err, all) {
          // TODO: implement offset
          //ok(all.offset == 2, 'offset correctly set');
          start();
        });
      });
    });
  });
});