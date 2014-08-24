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

  it('Does longpoll changes with immediate return', function () {
    var db = new PouchDB(dbs.name);

    return db.bulkDocs([{}, {}, {}, {}]).then(function () {
      return new PouchDB.utils.Promise(function (resolve, reject) {
        var count = 0;
        // when the docs are already there, it should return immediately
        db.changes({live: true, since: 2}).on('change', function (change) {
          if (++count === 2) {
            resolve();
          } else if (count > 2) {
            reject('got more than 2 changes');
          }
        }).on('error', reject);
      });
    });
  });

  it('Does longpoll changes with async return', function () {
    var db = new PouchDB(dbs.name);

    return db.bulkDocs([{}]).then(function () {
      return new PouchDB.utils.Promise(function (resolve, reject) {
        var count = 0;
        // when the docs are not there yet, it should only return 1
        db.changes({live: true, since: 1}).on('change', function (change) {
          if (++count === 1) {
            resolve();
          } else if (count > 1) {
            reject('got more than 1 change');
          }
        }).on('error', reject);

        setTimeout(function () {
          db.bulkDocs([{}, {}, {}]).catch(reject);
        }, 2000);
      });
    });
  });

});
