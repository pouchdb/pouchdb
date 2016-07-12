'use strict';

var adapters = [
  ['local', 'http'],
  ['http', 'http'],
  ['http', 'local'],
  ['local', 'local']
];

adapters.forEach(function (adapters) {
  describe('test.reserved.js-' + adapters[0] + '-' + adapters[1], function () {

    var dbs = {};

    beforeEach(function (done) {
      dbs.name = testUtils.adapterUrl(adapters[0], 'testdb');
      dbs.remote = testUtils.adapterUrl(adapters[1], 'test_repl_remote');
      testUtils.cleanup([dbs.name, dbs.remote], done);
    });

    after(function (done) {
      testUtils.cleanup([dbs.name, dbs.remote], done);
    });

    it('test docs with reserved javascript ids', function () {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      return db.bulkDocs([
        {_id: 'constructor'},
        {_id: 'toString'},
        {_id: 'valueOf'},
        {
          _id: '_design/all',
          views: {
            all: {
              map: function (doc) {
                emit(doc._id);
              }.toString()
            }
          }
        }
      ]).then(function () {
        return db.allDocs({key: 'constructor'});
      }).then(function (res) {
        res.rows.should.have.length(1, 'allDocs with key');
        return db.allDocs({keys: ['constructor']});
      }).then(function (res) {
        res.rows.should.have.length(1, 'allDocs with keys');
        return db.allDocs();
      }).then(function (res) {
        res.rows.should.have.length(4, 'allDocs empty opts');
        if (!db.query) {
          return testUtils.Promise.resolve();
        }
        return db.query('all/all', {key: 'constructor'});
      }).then(function (res) {
        if (!db.query) {
          return testUtils.Promise.resolve();
        }
        res.rows.should.have.length(1, 'query with key');
        return db.query('all/all', {keys: ['constructor']});
      }).then(function (res) {
        if (db.query) {
          res.rows.should.have.length(1, 'query with keys');
        }
        return new testUtils.Promise(function (resolve, reject) {
          db.replicate.to(remote).on('complete', resolve).on('error', reject);
        });
      });
    });

    it('can create db with reserved name', function () {
      var db = new PouchDB('constructor');
      return db.info().then(function () {
        return db.destroy();
      });
    });
  });
});
