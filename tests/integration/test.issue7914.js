'use strict';

var adapters = ['local', 'http'];

adapters.forEach(function (adapter) {
  describe('test.issue7914.js- ' + adapter, function () {

    var dbs = {};

    beforeEach(function () {
      dbs.name = testUtils.adapterUrl(adapter, 'testdb');
    });

    afterEach(function (done) {
      testUtils.cleanup([dbs.name], done);
    });

    it('Should return ok:true when put with new_edits: false', function () {
      var db = new PouchDB(dbs.name);
      var newDoc = {_id: 'newkey', _revisions: {start: 1, ids: ['first-rev']}};

      return db.put(newDoc, {new_edits: false}).then(function (result) {
        result.should.have.property('ok', true);
      });
    });

  });
});
