'use strict';

var adapters = ['local'];

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

    it('emit creation event', function (done) {
      var db = new PouchDB(dbs.name).on('created', function (newDB) {
        db.should.equal(newDB, 'should be same thing');
        done();
      });
    });

    it('emit changes event', function (done) {
      new PouchDB(dbs.name, function (err, db) {
        var obj = {
          something: 'here',
          somethingElse: 'overHere'
        };
        var isCancelled = false;
        db.on('change', function (change) {
          if (change.doc.something === 'here') {
            isCancelled = true;
            done(err);
          }
        });

        // on('change') sets up the listener asynchronously.
        // keep posting until a change is recognised
        var docId = 0;
        function doPut() {
          if (!isCancelled) {
            db.put(obj, 'change_' + docId++);
            setTimeout(doPut, 100);
          }
        }

        doPut();
      });
    });

    it('emit changes event with existing docs', function (done) {
      new PouchDB(dbs.name, function (err, db) {
        var obj = {
          something: 'here',
          somethingElse: 'overHere'
        };
        db.put({'foo': 'bar'}, 'foo').then(function () {
          var isCancelled = false;
          db.on('change', function (change) {
            if (change.doc.something === 'here') {
              isCancelled = true;
              done(err);
            }
          });

          // on('change') sets up the listener asynchronously.
          // keep posting until a change is recognised
          var docId = 0;
          function doPut() {
            if (!isCancelled) {
              db.put(obj, 'change_' + docId++);
              setTimeout(doPut, 100);
            }
          }

          doPut();
        });
      });
    });

    it.skip('emit changes event with existing docs', function (done) {
      new PouchDB(dbs.name, function (err, db) {
        var id = 'emiting';
        var obj = {
          something: 'here',
          somethingElse: 'overHere'
        };
        db.put({'foo': 'bar'}, 'foo');
        db.on('change', function (change) {
          change.id.should.equal('emiting');
          change.seq.should.equal(2, 'changed');
          done(err);
        });
        db.put(obj, id);
      });
    });

    it('emit create event', function (done) {
      new PouchDB(dbs.name, function (err, db) {
        var isCancelled = false;
        var timer;
        var obj = {
          something: 'here',
          somethingElse: 'overHere'
        };

        db.on('create', function (change) {
          isCancelled = true;
          clearTimeout(timer);
          done(err);
        });

        var i = 0;
        function doCreate() {
          if (!isCancelled) {
            db.put(obj, 'creating_' + (++i));
            timer = setTimeout(doCreate, 100);
          }
        }
        doCreate();
      });
    });

    it('emit update event', function (done) {
      new PouchDB(dbs.name, function (err, db) {
        var id = 'updating';
        var obj = {
          something: 'here',
          somethingElse: 'overHere'
        };
        db.on('update', function (change) {
          change.id.should.equal('updating');
          change.seq.should.equal(2, 'seq 2, updated');
          done(err);
        });

        db.put(obj, id).then(function (doc) {
          db.put({'something': 'else'}, id, doc.rev);
        });

      });
    });

    it('emit delete event', function (done) {
      new PouchDB(dbs.name, function (err, db) {
        var id = 'emiting';
        var obj = {
          something: 'here',
          somethingElse: 'overHere'
        };
        db.on('delete', function (change) {
          change.seq.should.equal(2, 'deleted');
          change.id.should.equal('emiting');
          done(err);
        });

        db.put(obj, id).then(function (doc) {
          db.remove({
            _id: id,
            _rev: doc.rev
          });
        });
      });
    });

  });
});
