'use strict';

describe('test.http.js', function () {

  var dbs = {};

  beforeEach(function (done) {
    dbs.name = testUtils.adapterUrl('http', 'test_http');
    testUtils.cleanup([dbs.name], done);
  });

  after(function (done) {
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

  it('Gives a useful timeout error', function () {
    this.timeout(60000);
    // no way it can write 100000 docs in 5 s.
    // couch is fast, but not that fast.
    var db = new PouchDB(dbs.name, {ajax: {timeout: 5000}});
    var docs = [];
    for (var i = 0; i < 100000; i++) {
      docs.push({});
    }

    return db.then(function (db) {
      return db.bulkDocs(docs).then(function () {
        true.should.equal(false, "didn't expect a 201 success");
      }, function (err) {
        err.status.should.equal(408);
      });
    });
  });

});
