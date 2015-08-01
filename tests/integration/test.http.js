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
    testUtils.isCouchDB(function (isCouchDB) {
      if (!isCouchDB) {
        return done();
      }
      new PouchDB(dbs.name).then(function (db) {
        db.destroy(function () {
          instantDB = new PouchDB(dbs.name, { skipSetup: true });
          instantDB.post({ test: 'abc' }, function (err, info) {
            should.exist(err);
            err.name.should.equal('not_found', 'Skipped setup of database');
            done();
          });
        });
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
        since: 100
      }).on('change', function (change) {
      }).on('complete', function (result) {
        callCount.should.equal(1, 'One _changes call to complete changes');
        PouchDB.utils.ajax = ajax;
        done();
      }).on('error', done);
    });
  });

  it('handle ddocs with slashes', function (done) {
    var ddoc = {
      _id: '_design/foo/bar'
    };
    var db = new PouchDB(dbs.name);
    db.bulkDocs({ docs: [ddoc] }, function (err, result) {
      db.get(ddoc._id, function (err, doc) {
        should.not.exist(err);
        doc._id.should.equal(ddoc._id, 'Correct doc returned');
        done();
      });
    });
  });

  it('#2853 test uri parsing usernames/passwords', function () {
    var uri = PouchDB.utils.parseUri(
      'http://u%24ern%40me:p%26%24%24w%40rd@foo.com');
    uri.password.should.equal('p&$$w@rd');
    uri.user.should.equal('u$ern@me');
    uri.host.should.equal('foo.com');
  });

  it('Properly escape url params #4008', function() {
    var ajax = PouchDB.utils.ajax;
    PouchDB.utils.ajax = function(opts) {
      opts.url.should.not.contain('[');
      ajax.apply(this, arguments);
    };
    var db = new PouchDB(dbs.name);
    return db.changes({doc_ids: ['1']}).then(function() {
      PouchDB.utils.ajax = ajax;
    });
  });

  it('Allows the "ajax timeout" to extend "changes timeout"', function() {
    var timeout = 120000;
    var db = new PouchDB(dbs.name, {
      skipSetup: true,
      ajax: {
        timeout: timeout
      }
    });

    var ajax = PouchDB.utils.ajax;
    var ajaxOpts;
    PouchDB.utils.ajax = function(opts) {
      if(/changes/.test(opts.url)) {
        ajaxOpts = opts;
      }
    };

    db.changes().on('change', function(change) {});

    should.exist(ajaxOpts);
    ajaxOpts.timeout.should.equal(timeout);

    PouchDB.utils.ajax = ajax;
  });
});
