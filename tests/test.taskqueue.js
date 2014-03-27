'use strict';

var adapters = ['http', 'local'];

adapters.forEach(function (adapter) {
  describe('test.taskqueue.js-' + adapter, function () {

    var dbs = {};

    beforeEach(function (done) {
      dbs.name = testUtils.adapterUrl(adapter, 'test_taskqueue');
      testUtils.cleanup([dbs.name], done);
    });

    afterEach(function (done) {
      testUtils.cleanup([dbs.name], done);
    });


    it('Add a doc', function (done) {
      var db = new PouchDB(dbs.name);
      db.post({ test: 'somestuff' }, function (err, info) {
        done(err);
      });
    });

    it('Query', function (done) {
      var db = new PouchDB(dbs.name);
      var queryFun = {
        map: function (doc) {
        }
      };
      db.query(queryFun, { reduce: false }, function (_, res) {
        res.rows.should.have.length(0);
        done();
      });
    });

    it('Bulk docs', function (done) {
      var db = new PouchDB(dbs.name);
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

    it('Get', function (done) {
      var db = new PouchDB(dbs.name);
      db.get('0', function (err, res) {
        should.exist(err);
        done();
      });
    });

    it('Info', function (done) {
      var db = new PouchDB(dbs.name);
      db.info(function (err, info) {
        info.doc_count.should.equal(0);
        info.update_seq.should.equal(0);
        done();
      });
    });

  });
});
