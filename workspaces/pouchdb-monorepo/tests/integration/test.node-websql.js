'use strict';

if (process.env.ADAPTERS === 'websql') {
  describe('test.node-websql.js', function () {
    it('should run websql when we are actually testing websql', function () {
      var db = new PouchDB('testdb');
      db.adapter.should.equal('websql');
      return db.destroy();
    });
  });
}
