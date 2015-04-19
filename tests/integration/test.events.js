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

    it('emit creation event', function (done) {
      var db = new PouchDB(dbs.name).on('created', function (newDB) {
        db.should.equal(newDB, 'should be same thing');
        done();
      });
    });

  });
});
