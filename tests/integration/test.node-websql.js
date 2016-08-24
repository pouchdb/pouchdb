'use strict';

if (process.env.ADAPTER === 'websql') {
  describe('test.node-websql.js', function () {
    it('should run websql when we are actually testing websql', function () {
      var db = new PouchDB('testdb');
      db.adapter.should.equal('websql');
      return db.destroy();
    });
  });
}