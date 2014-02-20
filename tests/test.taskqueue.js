'use strict';
var adapters = [
    'http-1',
    'local-1'
  ];
var testHelpers = {};
describe('taskqueue', function () {
  adapters.map(function (adapter) {
    describe(adapter, function () {
      beforeEach(function () {
        testHelpers.name = testUtils.generateAdapterUrl(adapter);
      });
      afterEach(testUtils.cleanupTestDatabases);
      it('Add a doc', function (done) {
        var name = testHelpers.name;
        PouchDB.destroy(name, function () {
          var db = testUtils.openTestAsyncDB(name);
          db.post({ test: 'somestuff' }, function (err, info) {
            done(err);
          });
        });
      });
      it('Query', function (done) {
        var name = testHelpers.name;
        PouchDB.destroy(name, function () {
          var db = testUtils.openTestAsyncDB(name);
          var queryFun = {
              map: function (doc) {
              }
            };
          db.query(queryFun, { reduce: false }, function (_, res) {
            res.rows.should.have.length(0);
            done();
          });
        });
      });
      it('Bulk docs', function (done) {
        var name = testHelpers.name;
        PouchDB.destroy(name, function () {
          var db = testUtils.openTestAsyncDB(name);
          db.bulkDocs({
            docs: [
              { test: 'somestuff' },
              { test: 'another' }
            ]
          }, function (err, infos) {
            should.not.exist(infos[0].error);
            should.not.exist(infos[1].error);
            done();
          });
        });
      });
      it('Get', function (done) {
        var name = testHelpers.name;
        PouchDB.destroy(name, function () {
          var db = testUtils.openTestAsyncDB(name);
          db.get('0', function (err, res) {
            should.exist(err);
            done();
          });
        });
      });
      it('Info', function (done) {
        var name = testHelpers.name;
        PouchDB.destroy(name, function () {
          var db = testUtils.openTestAsyncDB(name);
          db.info(function (err, info) {
            info.doc_count.should.equal(0);
            info.update_seq.should.equal(0);
            done();
          });
        });
      });
    });
  });
});
