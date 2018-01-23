'use strict';

['http', 'local'].forEach(function (adapter) {
  describe('pouchdb-find: ' + adapter + ': test.zzz-suite-1.js', function () {
    this.timeout(100000);

    var context = {};

    beforeEach(function () {
      this.timeout(60000);
      var dbName = testUtils.adapterUrl(adapter, 'testdb');
      context.db = new PouchDB(dbName);
      return context.db;
    });
    afterEach(function () {
      this.timeout(60000);
      return context.db.destroy();
    });

    testCases.forEach(function (testCase) {
      testCase(adapter, context);
    });
  });
});
