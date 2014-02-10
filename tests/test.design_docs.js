"use strict";

var adapters = ['local-1', 'http-1'];

describe('design_docs', function () {
  adapters.map(function(adapter) {

    describe(adapter, function () {
      beforeEach(function () {
        this.name = testUtils.generateAdapterUrl(adapter);
        PouchDB.enableAllDbs = true;
      });
      afterEach(testUtils.cleanupTestDatabases);

      var doc = {
        _id: '_design/foo',
        views: {
          scores: {
            map: 'function(doc) { if (doc.score) { emit(null, doc.score); } }',
            reduce: 'function(keys, values, rereduce) { return sum(values); }'
          }
        },
        filters: {
          even: 'function(doc) { return doc.integer % 2 === 0; }'
        }
      };

      it("Test writing design doc", function (done) {
        testUtils.initTestDB(this.name, function(err, db) {
          db.post(doc, function (err, info) {
            should.not.exist(err, 'Wrote design doc');
            db.get('_design/foo', function (err, info) {
              done(err);
            });
          });
        });
      });

      it("Changes filter", function(done) {

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

        testUtils.initTestDB(this.name, function(err, db) {
          var count = 0;
          db.bulkDocs({docs: docs1}, function(err, info) {
            var changes = db.changes({
              filter: 'foo/even',
              onChange: function(change) {
                count += 1;
                if (count === 4) {
                  changes.cancel();
                  done();
                }
              },
              continuous: true
            });
            db.bulkDocs({docs: docs2}, {});
          });
        });
      });

      it("Basic views", function (done) {

        var docs1 = [
          doc,
          {_id: "dale", score: 3},
          {_id: "mikeal", score: 5},
          {_id: "max", score: 4},
          {_id: "nuno", score: 3}
        ];

        testUtils.initTestDB(this.name, function(err, db) {
          db.bulkDocs({docs: docs1}, function(err, info) {
            db.query('foo/scores', {reduce: false}, function(err, result) {
              result.rows.should.have.length(4, 'Correct # of results');
              db.query('foo/scores', function(err, result) {
                result.rows[0].value.should.equal(15, 'Reduce gave correct result');
                done();
              });
            });
          });
        });
      });

      it("Concurrent queries", function(done) {
        testUtils.initTestDB(this.name, function(err, db) {
          db.bulkDocs({docs: [doc, {_id: "dale", score: 3}]}, function(err, info) {
            var cnt = 0;
            db.query('foo/scores', {reduce: false}, function(err, result) {
              result.rows.should.have.length(1, 'Correct # of results');
              if (++cnt === 2) {
                done();
              }
            });
            db.query('foo/scores', {reduce: false}, function(err, result) {
              result.rows.should.have.length(1, 'Correct # of results');
              if (++cnt === 2) {
                done();
              }
            });
          });
        });
      });
    });
  });
});
