'use strict';

var adapters = ['http', 'local'];

adapters.forEach(function (adapter) {
  describe('test.design_docs.js-' + adapter, function () {

    var dbs = {};

    beforeEach(function (done) {
      dbs.name = testUtils.adapterUrl(adapter, 'testdb');
      testUtils.cleanup([dbs.name], done);
    });

    after(function (done) {
      testUtils.cleanup([dbs.name], done);
    });


    var doc = {
      _id: '_design/foo',
      views: {
        scores: {
          map: 'function (doc) { if (doc.score) { emit(null, doc.score); } }',
          reduce: 'function (keys, values, rereduce) { return sum(values); }'
        }
      },
      filters: { even: 'function (doc) { return doc.integer % 2 === 0; }' }
    };

    it('Test writing design doc', function (done) {
      var db = new PouchDB(dbs.name);
      db.post(doc, function (err, info) {
        should.not.exist(err, 'Wrote design doc');
        db.get('_design/foo', function (err, info) {
          done(err);
        });
      });
    });

    it('Changes filter', function (done) {
      var docs1 = [
        doc,
        {_id: '0', integer: 0},
        {_id: '1', integer: 1},
        {_id: '2', integer: 2},
        {_id: '3', integer: 3}
      ];
      var docs2 = [
        {_id: '4', integer: 4},
        {_id: '5', integer: 5},
        {_id: '6', integer: 6},
        {_id: '7', integer: 7}
      ];

      var db = new PouchDB(dbs.name);
      var count = 0;
      db.bulkDocs({ docs: docs1 }, function (err, info) {
        var changes = db.changes({
          live: true,
          filter: 'foo/even',
          onChange: function (change) {
            count += 1;
            if (count === 4) {
              changes.cancel();
            }
          },
          complete: function (err, result) {
            result.status.should.equal('cancelled');
            done();
          },

        });
        db.bulkDocs({ docs: docs2 }, {});
      });
    });

    it('Basic views', function (done) {
      var docs1 = [
        doc,
        {_id: 'dale', score: 3},
        {_id: 'mikeal', score: 5},
        {_id: 'max', score: 4},
        {_id: 'nuno', score: 3}
      ];
      var db = new PouchDB(dbs.name);
      db.bulkDocs({ docs: docs1 }, function (err, info) {
        db.query('foo/scores', { reduce: false }, function (err, result) {
          result.rows.should.have.length(4, 'Correct # of results');
          db.query('foo/scores', function (err, result) {
            result.rows[0].value.should.equal(15, 'Reduce gave correct result');
            done();
          });
        });
      });
    });

    it('Concurrent queries', function (done) {
      var db = new PouchDB(dbs.name);
      db.bulkDocs({
        docs: [
          doc,
          {_id: 'dale', score: 3}
        ]
      }, function (err, info) {
        var cnt = 0;
        db.query('foo/scores', { reduce: false }, function (err, result) {
          result.rows.should.have.length(1, 'Correct # of results');
          if (++cnt === 2) {
            done();
          }
        });
        db.query('foo/scores', { reduce: false }, function (err, result) {
          result.rows.should.have.length(1, 'Correct # of results');
          if (++cnt === 2) {
            done();
          }
        });
      });
    });

  });
});
