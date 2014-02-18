'use strict';
var adapters = [
    'http-1',
    'local-1'
  ];
describe('conflicts', function () {
  adapters.map(function (adapter) {
    describe(adapter, function () {
      beforeEach(function () {
        this.name = testUtils.generateAdapterUrl(adapter);
        PouchDB.enableAllDbs = true;
      });
      afterEach(testUtils.cleanupTestDatabases);
      it('Testing conflicts', function (done) {
        testUtils.initTestDB(this.name, function (err, db) {
          var doc = {
              _id: 'foo',
              a: 1,
              b: 1
            };
          db.put(doc, function (err, res) {
            doc._rev = res.rev;
            should.exist(res.ok, 'Put first document');
            db.get('foo', function (err, doc2) {
              doc._id.should.equal(doc2._id);
              should.be.ok(doc._rev && doc2._rev);
              doc.a = 2;
              doc2.a = 3;
              db.put(doc, function (err, res) {
                should.exist(res.ok, 'Put second doc');
                db.put(doc2, function (err) {
                  err.name.should.equal('conflict', 'Put got a conflicts');
                  db.changes({
                    complete: function (err, results) {
                      results.results.should.have.length(1, 'We have one entry in changes');
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
      });
      it('Testing conflicts', function (done) {
        var doc = {
            _id: 'fubar',
            a: 1,
            b: 1
          };
        testUtils.initTestDB(this.name, function (err, db) {
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
  });
});