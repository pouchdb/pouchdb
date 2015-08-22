'use strict';

var adapters = ['local', 'http'];

adapters.forEach(function (adapter) {
  describe('test.events.js-' + adapter, function () {

    var dbs = {};
    beforeEach(function (done) {
      dbs.name = testUtils.adapterUrl(adapter, 'testdb');
      testUtils.cleanup([dbs.name], done);
    });

    after(function (done) {
      testUtils.cleanup([dbs.name], done);
    });


    it('PouchDB emits creation event', function (done) {
      PouchDB.once('created', function (name) {
        name.should.equal(dbs.name, 'should be same thing');
        done();
      });
      new PouchDB(dbs.name);
    });

    it('PouchDB emits destruction event', function (done) {
      new PouchDB(dbs.name, function (err, db) {
        db.destroy();
      }).once('destroyed', function () {
        new PouchDB(dbs.name, function () {
          done();
        });
      });
    });

    it('PouchDB emits destruction event on PouchDB object', function (done) {
      PouchDB.once('destroyed', function (name) {
        name.should.equal(dbs.name, 'should have the same name');
        new PouchDB(dbs.name, function () {
          done();
        });
      });
      new PouchDB(dbs.name, function (err, db) {
        db.destroy();
      });
    });

    it('PouchDB emits destroyed when using {name: foo}', function () {
      return new PouchDB({name: 'testdb'}).then(function (db) {
        return new PouchDB.utils.Promise(function (resolve) {
          PouchDB.once('destroyed', function (name) {
            name.should.equal('testdb');
            resolve();
          });
          db.destroy();
        });
      });
    });

    it('db emits destroyed on all DBs', function () {
      var db1 = new PouchDB('testdb');
      var db2 = new PouchDB('testdb');

      return new PouchDB.utils.Promise(function (resolve) {
        var called = 0;
        function checkDone() {
          if (++called === 2) {
            resolve();
          }
        }
        db1.once('destroyed', checkDone);
        db2.once('destroyed', checkDone);
        db1.destroy();
      });
    });

    it('3900 db emits destroyed event', function () {
      return new PouchDB('testdb').then(function (db) {
        return new PouchDB.utils.Promise(function (resolve) {
          db.once('destroyed', function () {
            resolve();
          });
          db.destroy();
        });
      });
    });

    it('3900 db emits destroyed event 2', function () {
      var db = new PouchDB('testdb');
      return new PouchDB.utils.Promise(function (resolve) {
        db.once('destroyed', function () {
          resolve();
        });
        db.destroy();
      });
    });

    it('emit creation event', function (done) {
      var db = new PouchDB(dbs.name).on('created', function (newDB) {
        db.should.equal(newDB, 'should be same thing');
        done();
      });
    });

    it('#4168 multiple constructor calls don\'t leak listeners', function () {
      for (var i = 0; i < 50; i++) {
        new PouchDB(dbs.name);
      }
    });

  });
});
