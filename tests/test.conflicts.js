'use strict';

var adapters = ['http', 'local'];

adapters.forEach(function (adapter) {
  describe('test.conflicts.js-' + adapter, function () {

    var dbs = {};

    beforeEach(function (done) {
      dbs.name = testUtils.adapterUrl(adapter, 'test_conflicts');
      testUtils.cleanup([dbs.name], done);
    });

    afterEach(function (done) {
      testUtils.cleanup([dbs.name], done);
    });


    it('Testing conflicts', function (done) {
      var db = new PouchDB(dbs.name);
      var doc = {_id: 'foo', a: 1, b: 1};
      db.put(doc, function (err, res) {
        doc._rev = res.rev;
        should.exist(res.ok, 'Put first document');
        db.get('foo', function (err, doc2) {
          doc._id.should.equal(doc2._id);
          doc.should.have.property('_rev');
          doc2.should.have.property('_rev');
          doc.a = 2;
          doc2.a = 3;
          db.put(doc, function (err, res) {
            should.exist(res.ok, 'Put second doc');
            db.put(doc2, function (err) {
              err.name.should.equal('conflict', 'Put got a conflicts');
              db.changes({
                complete: function (err, results) {
                  results.results.should.have.length(1);
                  doc2._rev = undefined;
                  db.put(doc2, function (err) {
                    err.name.should.equal('conflict', 'Another conflict');
                    done();
                  });
                }
              });
            });
          });
        });
      });
    });

    it('Testing conflicts', function (done) {
      var doc = {_id: 'fubar', a: 1, b: 1};
      var db = new PouchDB(dbs.name);
      db.put(doc, function (err, ndoc) {
        doc._rev = ndoc.rev;
        db.remove(doc, function () {
          delete doc._rev;
          db.put(doc, function (err, ndoc) {
            if (err) {
              return done(err);
            }
            should.exist(ndoc.ok, 'written previously deleted doc without rev');
            done();
          });
        });
      });
    });

  });
});
