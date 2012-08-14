['idb-1', 'http-1'].map(function(adapter) {

  module('conflicts: ' + adapter, {
    setup : function () {
      this.name = generateAdapterUrl(adapter);
    }
  });

  asyncTest('Testing conflicts', function() {
    initTestDB(this.name, function(err, db) {
      var doc = {_id: 'foo', a:1, b: 1};
      db.put(doc, function(err, res) {
        doc._rev = res.rev;
        ok(res.ok, 'Put first document');
        db.get('foo', function(err, doc2) {
          ok(doc._id === doc2._id && doc._rev && doc2._rev, 'Docs had correct id + rev');
          doc.a = 2;
          doc2.a = 3;
          db.put(doc, function(err, res) {
            ok(res.ok, 'Put second doc');
            db.put(doc2, function(err) {
              ok(err.error === 'conflict', 'Put got a conflicts');
              db.changes(function(err, results) {
                console.log(results.results);
                ok(results.results.length === 1, 'We have one entry in changes');
                doc2._rev = undefined;
                db.put(doc2, function(err) {
                  ok(err.error === 'conflict', 'Another conflict');
                  start();
                });
              });
            });
          });
        });
      });
    });
  });

  asyncTest('Testing conflicts', function() {
    var doc = {_id: 'fubar', a:1, b: 1};
    Pouch(this.name, function(err, db) {
      if (err) {
        console.error(err);
        ok(false, 'failed to open database');
        return start();
      }
      db.put(doc, function(err, ndoc) {
        doc._rev = ndoc.rev;
        db.remove(doc, function() {
          delete doc._rev;
          db.put(doc, function(err, ndoc) {
            if (err) {
              ok(false);
              start();
              return;
            }
            ok(ndoc.ok, 'written previously deleted doc without rev');
            start();
          });
        });
      });
    });
  });

});