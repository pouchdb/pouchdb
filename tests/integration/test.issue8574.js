'use strict';

var adapters = ['local', 'http'];

adapters.forEach(function (adapter) {
  describe('test.issue8574.js-' + adapter, function () {
    // Behavior before the fix: 'Error: database is closed' is thrown by db1.find()
    it('should close only the targeted database when closed', function () {
      var db1 = new PouchDB('testdb1');
      var db2 = new PouchDB('testdb2');

      return new testUtils.Promise(function (resolve, reject) {
        db2.once('closed', function () {
          db1.find({
            selector: { foo: 'foo' }
          }).then(function () {
            return db1.close();
          }).then(resolve).catch(reject);
        });
        // Add an index to test databases with dependent databases
        db1.createIndex({ index: { fields: ['foo'] } }).then(function () {
          return db2.close();
        }).catch(reject);
      });
    });

    // Behavior before the fix: test hanging until timeout...
    it('should not close other databases when targeted database is destroyed', function () {
      var db1 = new PouchDB('testdb1');
      var db2 = new PouchDB('testdb2');

      return new testUtils.Promise(function (resolve, reject) {
        db2.once('destroyed', function () {
          db1.find({
            selector: { foo: 'foo' }
          }).then(function () {
            return db1.close();
          }).then(resolve).catch(reject);
        });
        // Add an index to test databases with dependent databases
        db1.createIndex({ index: { fields: ['foo'] } }).then(function () {
          return db2.destroy();
        }).catch(reject);
      });
    });
  });
});
