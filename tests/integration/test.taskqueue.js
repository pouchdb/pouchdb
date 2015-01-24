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

    it('Doesn\'t throw sync error while destroying', function () {
      var chain = PouchDB.utils.Promise.resolve();

      var db;

      function noop() {}

      function timeout(delay) {
        return new PouchDB.utils.Promise(function (resolve) {
          setTimeout(resolve, delay);
        });
      }

      function randomTimeout() {
        return timeout(1 + Math.floor(10 * Math.random()));
      }

      function doIt() {
        chain = chain.then(function () {
          db = new PouchDB(dbs.name);
        }).then(function () {
          var tasks = [];

          for (var i = 0; i < 10; i++) {
            /* jshint loopfunc:true */
            tasks.push(randomTimeout().then(function () {
              return db.bulkDocs([{}, {}, {}, {}, {},
                {_id: '_local/' + Math.random()}]).catch(noop);
            }));
          }
          for (var i = 0; i < 10; i++) {
            /* jshint loopfunc:true */
            tasks.push(randomTimeout().then(function () {
              return db.allDocs({include_docs: true}).catch(noop);
            }));
          }
          tasks.push(randomTimeout().then(function () {
            return db.destroy();
          }));

          return PouchDB.utils.Promise.all(tasks);
        });
      }
      for (var i = 0; i < 100; i++) {
        doIt();
      }
      return chain;
    });

  });
});
