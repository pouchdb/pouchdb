'use strict';

var adapters = ['http', 'local'];

adapters.forEach(function (adapter) {
  describe('test.taskqueue.js-' + adapter, function () {

    var dbs = {};

    beforeEach(function (done) {
      dbs.name = testUtils.adapterUrl(adapter, 'testdb');
      testUtils.cleanup([dbs.name], done);
    });

    after(function (done) {
      testUtils.cleanup([dbs.name], done);
    });


    it('Add a doc', function (done) {
      var db = new PouchDB(dbs.name);
      db.post({ test: 'somestuff' }, function (err, info) {
        done(err);
      });
    });

    it('Query', function (done) {
      // temp views are not supported in CouchDB 2.0
      if (testUtils.isCouchMaster()) {
        return done();
      }

      var db = new PouchDB(dbs.name);
      var queryFun = {
        map: function (doc) {
        }
      };
      db.query(queryFun, { reduce: false }, function (_, res) {
        res.rows.should.have.length(0);
        done();
      });
    });

    it('Bulk docs', function (done) {
      var db = new PouchDB(dbs.name);
      db.bulkDocs({
        docs: [
          { test: 'somestuff' },
          { test: 'another' }
        ]
      }, function (err, infos) {
        should.not.exist(infos[0].error);
        should.not.exist(infos[1].error);
        done();
      });
    });

    it('Get', function (done) {
      var db = new PouchDB(dbs.name);
      db.get('0', function (err, res) {
        should.exist(err);
        done();
      });
    });

    it('Info', function (done) {
      var db = new PouchDB(dbs.name);
      db.info(function (err, info) {
        info.doc_count.should.equal(0);
        done();
      });
    });

    it('#3415 query while destroying', function () {
      var db = new PouchDB(dbs.name);
      var promise = PouchDB.utils.Promise.resolve();

      for (var i = 0; i < 5; i++) {
        /* jshint loopfunc:true */
        promise = promise.then(function () {
          console.log('bulking docs');
          return db.bulkDocs([
            {_id: 'foo'},
            {_id: 'bar'},
            {_id: 'baz'},
            {_id: '_local/foo'},
            {
              _id: '_design/myview', views: {
              myview: {
                map: function (doc) {
                  emit(doc._id);
                }.toString()
              }
            }
            }
          ]);
        }).then(function () {
          return PouchDB.utils.Promise.all([
            db.query('myview', {
              limit: 0,
              stale: 'update_after'
            }),
            db.destroy()
          ]);
        }).then(function () {
          db = new PouchDB(dbs.name);
        });
      }

      return promise;
    });

  });
});
