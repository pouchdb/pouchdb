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
      var db = new PouchDB(dbs.name);
      db.once('destroyed', done);
      db.destroy();
    });

    it('PouchDB emits destruction event on PouchDB object', function (done) {
      PouchDB.once('destroyed', function (name) {
        name.should.equal(dbs.name, 'should have the same name');
        done();
      });
      new PouchDB(dbs.name).destroy();
    });

    it('PouchDB emits destroyed when using {name: foo}', function () {
      var db = new PouchDB({name: 'testdb'});
      return new testUtils.Promise(function (resolve) {
        PouchDB.once('destroyed', function (name) {
          name.should.equal('testdb');
          resolve();
        });
        db.destroy();
      });
    });

    it('db emits destroyed on all DBs', function () {
      var db1 = new PouchDB('testdb');
      var db2 = new PouchDB('testdb');

      return new testUtils.Promise(function (resolve) {
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
      var db = new PouchDB('testdb');
      return new testUtils.Promise(function (resolve) {
        db.once('destroyed', function () {
          resolve();
        });
        db.destroy();
      });
    });

    it('3900 db emits destroyed event 2', function () {
      var db = new PouchDB('testdb');
      return new testUtils.Promise(function (resolve) {
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

    it('4922 Destroyed is not called twice', function (done) {
      var count = 0;
      function destroyed() {
        count++;
        if (count === 1) {
          setTimeout(function () {
            count.should.equal(1);
            PouchDB.removeListener('destroyed', destroyed);
            done();
          }, 50);
        }
      }
      PouchDB.on('destroyed', destroyed);
      new PouchDB(dbs.name).destroy();
    });

    it('should emit destroyed even when closed (sync)', function () {
      var db1 = new PouchDB('testdb');
      var db2 = new PouchDB('testdb');

      return new testUtils.Promise(function (resolve) {
        db2.once('destroyed', resolve);
        db1.once('closed', function () {
          db2.destroy();
        });
        db1.close();
      });
    });

    it('should emit destroyed even when closed (async)', function () {
      var db1 = new PouchDB('testdb');
      var db2 = new PouchDB('testdb');

      return new testUtils.Promise(function (resolve) {
        // FIXME This should be 2 if close-then-destroy worked.
        var need = 1;
        function checkDone() {
          if (--need === 0) {
            resolve();
          }
        }
        db1.once('closed', checkDone);
        db2.once('destroyed', checkDone);
        db1.info()
        .then( function () {
          return db1.close();
        })
        .catch( function (err) {
          console.log(err.stack || err.toString());
        });
        db2.destroy()
        .catch( function (err) {
          console.log(err.stack || err.toString());
        });
      });
    });

    it('should emit closed even when destroyed (async #2)', function () {
      var db1 = new PouchDB('testdb');
      var db2 = new PouchDB('testdb');

      return new testUtils.Promise(function (resolve) {
        // FIXME This should be 2 if close-then-destroy worked.
        var need = 1;
        function checkDone() {
          if (--need === 0) {
            resolve();
          }
        }
        db1.once('closed', checkDone);
        db2.once('destroyed', checkDone);
        db2.destroy()
        .catch( function (err) {
          console.log(err.stack || err.toString());
        });
        db1.info()
        .then( function () {
          return db1.close();
        })
        .catch( function (err) {
          console.log(err.stack || err.toString());
        });
      });
    });

    it('test unref for coverage', function () {
      var db1 = new PouchDB('testdb');
      return new testUtils.Promise(function (resolve) {
        PouchDB.once('unref', resolve);
        db1.close();
      });
    });

    it('test double unref for coverage', function () {
      this.timeout(1000);
      var db1 = new PouchDB('testdb');
      var db2 = new PouchDB('testdb');

      return new testUtils.Promise(function (resolve) {
        var need = 2;
        function checkDone() {
          if (--need === 0) {
            resolve();
          }
        }
        PouchDB.on('unref', checkDone);
        db1.info()
        .then( function () {
          return db2.info();
        }).then( function () {
          return db2.close();
        }).then( function () {
          return db1.close();
        }).catch( function (err) {
          console.log(err.stack || err.toString());
        });
      });
    });

    it('test close-then-destroyed for coverage', function () {
      this.timeout(1000);
      var db1 = new PouchDB('testdb');
      var db2 = new PouchDB('testdb');
      return new testUtils.Promise(function (resolve) {
        // FIXME This should be 2 if close-then-destroy worked.
        var need = 1;
        function checkDone() {
          if (--need === 0) {
            resolve();
          }
        }
        PouchDB.once('unref', checkDone);
        PouchDB.once('destroyed', checkDone);
        db1.info()
        .then( function () {
          return db1.close();
        }).then( function () {
          return db2.destroy();
        }).catch( function (err) {
          console.log(err.stack || err.toString());
        });
      });
    });

    it('test destroy-then-close for coverage', function () {
      this.timeout(1000);
      var db1 = new PouchDB('testdb');
      var db2 = new PouchDB('testdb');
      return new testUtils.Promise(function (resolve) {
        // FIXME This should be 2 if close-then-destroy worked.
        var need = 1;
        function checkDone() {
          if (--need === 0) {
            resolve();
          }
        }
        PouchDB.once('destroyed', checkDone);
        PouchDB.once('unref', checkDone);
        db2.info()
        .then( function () {
          return db1.destroy();
        }).then( function () {
          return db2.close();
        }).catch( function (err) {
          console.log(err.stack || err.toString());
        });
      });
    });

    it('test destroy-then-close-and-close for coverage', function () {
      this.timeout(1000);
      var db1 = new PouchDB('testdb');
      var db2 = new PouchDB('testdb');
      var db3 = new PouchDB('testdb');
      return new testUtils.Promise(function (resolve) {
        // FIXME This should be 3 if close-then-destroy worked.
        var need = 1;
        function checkDone() {
          if (--need === 0) {
            resolve();
          }
        }
        PouchDB.once('destroyed', checkDone);
        PouchDB.on('unref', checkDone);
        db2.info()
        .then( function () {
          return db3.info();
        }).then( function () {
          return db1.destroy();
        }).then( function () {
          return db2.close();
        }).then( function () {
          return db3.close();
        }).catch( function (err) {
          console.log(err.stack || err.toString());
        });
      });
    });
  });

});
