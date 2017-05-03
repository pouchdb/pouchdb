'use strict';

var adapters = ['local', 'http'];

adapters.forEach(function (adapter) {
  describe('test.close.js-' + adapter, function () {

    var dbs = {};
    beforeEach(function (done) {
      dbs.name = testUtils.adapterUrl(adapter, 'testdb');
      testUtils.cleanup([dbs.name], done);
    });

    after(function (done) {
      testUtils.cleanup([dbs.name], done);
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
        // FIXME This should be 2 if destroy-then-close worked.
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
