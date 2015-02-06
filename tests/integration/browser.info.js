'use strict';

var adapters = ['local'];

adapters.forEach(function (adapter) {
  describe('browser.info.js-' + adapter, function () {

    var dbs = {};

    beforeEach(function (done) {
      dbs.name = testUtils.adapterUrl(adapter, 'testdb');
      testUtils.cleanup([dbs.name], done);
    });

    after(function (done) {
      testUtils.cleanup([dbs.name], done);
    });

    it('adapter-specific info', function () {
      var db = new PouchDB(dbs.name);
      return db.info().then(function (info) {
        switch (db.adapter) {
          case 'websql':
            info.sqlite_plugin.should.be.a('boolean');
            info.websql_encoding.should.be.a('string');
            break;
          case 'idb':
            info.idb_attachment_format.should.be.a('string');
            break;
          default:
            should.exist(info); // can't make any guarantees
            break;
        }
      });
    });
  });
});
