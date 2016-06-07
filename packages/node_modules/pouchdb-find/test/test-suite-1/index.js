'use strict';

module.exports = function (dbName, dbType, Pouch) {
  describe(dbType + ' test suite 1', function () {
    this.timeout(100000);

    var context = {};

    beforeEach(function () {
      this.timeout(60000);

      var  dbNameWithTimestamp = dbName;
      if (dbType === 'http') {
        dbNameWithTimestamp = dbName + (new Date()).getTime();
      }

      context.db = new Pouch(dbNameWithTimestamp);
      return context.db;
    });
    afterEach(function () {
      this.timeout(60000);
      return context.db.destroy();
    });

    require('./test.callbacks')(dbType, context);
    require('./test.basic')(dbType, context);
    require('./test.basic2')(dbType, context);
    require('./test.basic3')(dbType, context);
    require('./test.ddoc')(dbType, context);
    require('./test.set-operations')(dbType, context);
    require('./test.limit')(dbType, context);
    require('./test.skip')(dbType, context);
    require('./test.limit-skip')(dbType, context);
    require('./test.sorting')(dbType, context);
    require('./test.fields')(dbType, context);
    require('./test.ltgt')(dbType, context);
    require('./test.eq')(dbType, context);
    require('./test.deep-fields')(dbType, context);
    require('./test.pick-fields')(dbType, context);
    require('./test.exists')(dbType, context);
    require('./test.type')(dbType, context);
    require('./test.ne')(dbType, context);
    require('./test.matching-indexes')(dbType, context);
    require('./test.errors')(dbType, context);
    require('./test.array')(dbType, context);
    require('./test.combinational')(dbType, context);
    require('./test.elem-match')(dbType, context);
    require('./test.mod')(dbType, context);
    require('./test.regex')(dbType, context);
    require('./test.not')(dbType, context);
    require('./test.issue66')(dbType, context);
    require('./test.and')(dbType, context);
    require('./test.default-index')(dbType, context);
  });
};
