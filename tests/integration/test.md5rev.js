'use strict';

var adapters = ['local'];

adapters.forEach(function (adapter) {

  describe('test.md5rev.js-' + adapter, function () {

    var dbs = {};

    beforeEach(function () {
      dbs.name1 = testUtils.adapterUrl(adapter, 'testdb');
      dbs.name2 = testUtils.adapterUrl(adapter, 'testdb2');
    });

    afterEach(function (done) {
      testUtils.cleanup([dbs.name1, dbs.name2], done);
    });

    it('useMd5Rev=true so revision for two docs that are the same will be equal', function () {
      const doc = {
        _id: '123-this-is-an-id',
        hello: 'world',
        'testing': 123
      };

      var db1 = PouchDB(dbs.name1);
      var db2 = PouchDB(dbs.name2);
      return Promise.all([db1.put(doc), db2.put(doc)])
      .then(function (resp) {
        var resp1 = resp[0];
        var resp2 = resp[1];
        resp1.rev.should.equal(resp2.rev);
      });
    });

    it('useMd5Rev=false so revision for two docs that are the same will be different', function () {
      const doc = {
        _id: '123-this-is-an-id',
        hello: 'world',
        'testing': 123
      };

      var db1 = PouchDB(dbs.name1, {useMd5Rev: false});
      var db2 = PouchDB(dbs.name2, {useMd5Rev: false});
      return Promise.all([db1.put(doc), db2.put(doc)])
      .then(function (resp) {
        var resp1 = resp[0];
        var resp2 = resp[1];
        resp1.rev.should.not.equal(resp2.rev);
      });
    });

  });
});
