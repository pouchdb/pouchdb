'use strict';

// mock tests for the Cordova SQLite Plugin

var adapters = ['local'];

adapters.forEach(function (adapter) {
  describe('browser.sqlite.js-' + adapter, function () {

    var dbs = {};

    var called = false;

    // Just verify that we're calling the SQLite Plugin with its
    // weird non-standard API
    var sqlitePlugin = {
      openDatabase: function (opts) {
        called = true;
        should.exist(opts.location);
        should.exist(opts.name);
        should.exist(opts.version);
        should.exist(opts.description);
        should.exist(opts.size);
        should.exist(opts.weirdCustomOption);
        return openDatabase(opts.name, opts.version,
          opts.description, opts.size);
      }
    };

    beforeEach(function (done) {
      window.sqlitePlugin = sqlitePlugin;
      dbs.name = testUtils.adapterUrl(adapter, 'testdb');
      testUtils.cleanup([dbs.name], done);
    });

    after(function (done) {
      delete window.sqlitePlugin;
      testUtils.cleanup([dbs.name], done);
    });

    it('calls window.sqlitePlugin correctly', function () {
      if (typeof openDatabase !== 'function') {
        return; // skip in non-websql browsers
      }
      var db = new PouchDB(dbs.name + '_sqlite', {
        adapter: 'websql',
        location: 'yolo',
        weirdCustomOption: 'foobar'
      });
      return db.info().then(function (info) {
        called.should.equal(true);
        info.doc_count.should.equal(0);
      }).then(function () {
        return db.destroy();
      });
    });
  });
});
