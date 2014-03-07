'use strict';

var adapters = ['local'];

adapters.forEach(function (adapter) {
  describe('test.events.js-' + adapter, function () {

    //we can't use the same db becasue
    var i = 0;
    var dbs = {};
    beforeEach(function (done) {
      dbs.name = testUtils.adapterUrl(adapter, 'events_tests' + i++);
      testUtils.cleanup([dbs.name], done);
    });

    afterEach(function (done) {
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
      new PouchDB(dbs.name, function () {
        PouchDB.destroy(dbs.name);
      }).once('destroyed', function () {
        new PouchDB(dbs.name, function () {
          done();
        });
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
        var id = 'emiting';
        var obj = {
          something: 'here',
          somethingElse: 'overHere'
        };
        db.on('change', function (change) {
          change.seq.should.equal(1, 'changed');
          change.id.should.equal('emiting');
          done(err);
        });
        db.put(obj, id);
      });
    });

    it('emit create event', function (done) {
      new PouchDB(dbs.name, function (err, db) {
        var id = 'creating';
        var obj = {
          something: 'here',
          somethingElse: 'overHere'
        };
        db.on('create', function (change) {
          change.id.should.equal('creating');
          change.seq.should.equal(1, 'created');
          done(err);
        });
        db.put(obj, id);
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
