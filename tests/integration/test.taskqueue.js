'use strict';

var adapters = ['http', 'local'];

adapters.forEach(function (adapter) {
  describe('test.taskqueue.js-' + adapter, function () {

    var dbs = {};

    beforeEach(function () {
      dbs.name = testUtils.adapterUrl(adapter, 'testdb');
    });

    afterEach(function (done) {
      testUtils.cleanup([dbs.name], done);
    });

    it('Add a doc', function () {
      var db = new PouchDB(dbs.name);
      return db.post({test: 'somestuff'});
    });

    it('Bulk docs', function () {
      var db = new PouchDB(dbs.name);
      return db.bulkDocs({
        docs: [
          { test: 'somestuff' },
          { test: 'another' }
        ]
      }).then(function (infos) {
        should.not.exist(infos[0].error);
        should.not.exist(infos[1].error);
      });
    });

    it('Get', function () {
      var db = new PouchDB(dbs.name);
      return db.get('0').then(function () {
        throw 'Get should error';
      }).catch(function (err) {
        should.exist(err);
      });
    });

    it('Info', function () {
      var db = new PouchDB(dbs.name);
      return db.info().then(function (info) {
        info.doc_count.should.equal(0);
      });
    });

  });
});
