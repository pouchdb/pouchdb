'use strict';

var node = (typeof module !== 'undefined' && module.exports);

describe('test.http.js', function () {

  var dbs = {};

  beforeEach(function (done) {
    dbs.name = testUtils.adapterUrl('http', 'test_http');
    testUtils.cleanup([dbs.name], done);
  });

  afterEach(function (done) {
    testUtils.cleanup([dbs.name], done);
  });


  it('Create a pouch without DB setup', function (done) {
    var instantDB;
    PouchDB.destroy(dbs.name, function () {
      instantDB = new PouchDB(dbs.name, { skipSetup: true });
      instantDB.post({ test: 'abc' }, function (err, info) {
        should.exist(err);
        err.name.should.equal('not_found', 'Skipped setup of database');
        done();
      });
    });
  });

  it('Issue 1269 redundant _changes requests', function (done) {
    var docs = [];
    var num = 100;
    for (var i = 0; i < num; i++) {
      docs.push({
        _id: 'doc_' + i,
        foo: 'bar_' + i
      });
    }
    var db = new PouchDB(dbs.name);
    db.bulkDocs({ docs: docs }, function (err, result) {
      var callCount = 0;
      var ajax = PouchDB.utils.ajax;
      PouchDB.utils.ajax = function (opts) {
        if (/_changes/.test(opts.url)) {
          callCount++;
        }
        ajax.apply(this, arguments);
      };
      db.changes({
        since: 100,
        onChange: function (change) { },
        complete: function (err, result) {
          callCount.should.equal(1, 'One _changes call to complete changes');
          PouchDB.utils.ajax = ajax;
          done();
        }
      });
    });
  });

  if (node) {
    it('nonce option', function () {
      var cache = PouchDB.ajax({ url: '/' }, function () { });
      cache.uri.query.slice(0, 6).should.equal('_nonce', 'should have a nonce');
      var noCache = PouchDB.ajax({
        url: '/',
        cache: true
      }, function () { });
      should.not.exist(noCache.uri.query, 'should not have a nonce');
    });
  }

});
