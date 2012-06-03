['idb-1', 'http-1'].map(function(adapter) {

  module('all_docs: ' + adapter, {
    setup : function () {
      this.name = generateAdapterUrl(adapter);
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
    }

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
    Pouch(this.name, function(err, db) {
      if (err) {
        console.error(err);
        ok(false, 'failed to open database');
        return start();
      }
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
    Pouch(this.name, function(err, db) {
      if (err) {
        console.error(err);
        ok(false, 'failed to open database');
        return start();
      }
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
    Pouch(this.name, function(err, db) {
      if (err) {
        console.error(err);
        ok(false, 'failed to open database');
        return start();
      }
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

  asyncTest('Testing conflicts', function() {
    Pouch(this.name, function(err, db) {
      if (err) {
        console.error(err);
        ok(false, 'failed to open database');
        return start();
      }
      // add conflicts
      var conflictDoc1 = {
        _id: "3", _rev: "2-aa01552213fafa022e6167113ed01087", value: "X"
      };
      var conflictDoc2 = {
        _id: "3", _rev: "2-ff01552213fafa022e6167113ed01087", value: "Z"
      };
      db.put(conflictDoc1, {new_edits: false}, function(err, doc) {
        db.put(conflictDoc2, {new_edits: false}, function(err, doc) {
          db.get('3', function(err, winRev) {
            var opts = {include_docs: true, conflicts: true, style: 'all_docs'};
            db.changes(opts, function(err, changes) {
              ok("3" === changes.results[3].id, 'changes are ordered');
              ok(3 === changes.results[3].changes.length, 'correct number of changes');
              ok(winRev._rev === changes.results[3].changes[0].rev,
                 'correct winning revision');
              equal("3", changes.results[3].doc._id, 'correct doc id');
              equal(winRev._rev, changes.results[3].doc._rev,
                 'include doc has correct rev');
              equal(true, changes.results[3].doc._conflicts instanceof Array,
                 'include docs contains conflicts');
              ok(changes.results[3].doc._conflicts &&
                 2 === changes.results[3].doc._conflicts.length,
                 'correct number of changes');
              db.allDocs({include_docs: true, conflicts: true}, function(err, res) {
                equal(3, res.rows.length, 'correct number of changes');
                equal("3", res.rows[2].key, 'correct key');
                equal("3", res.rows[2].id, 'correct id');
                equal(res.rows[2].value.rev, winRev._rev, 'correct rev');
                equal(res.rows[2].doc._rev, winRev._rev, 'correct rev');
                equal("3", res.rows[2].doc._id, 'correct order');
                ok(res.rows[2].doc._conflicts instanceof Array);
                ok(res.rows[2].doc._conflicts && 2 === res.rows[2].doc._conflicts.length);
                start();
              });
            });
          });
        });
      });
    });
  });

  asyncTest('Test basic collation', function() {
    initTestDB(this.name, function(err, db) {
      var docs = {docs: [{_id: "Z", foo: "Z"}, {_id: "a", foo: "a"}]};
      db.bulkDocs(docs, function(err, res) {
        db.allDocs({startkey: 'Z', endkey: 'Z'}, function(err, result) {
          ok(result.rows.length === 1);
          start();
        });
      });
    });
  });

});