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
      db.info(function (err, info) {
        var update_seq = info.update_seq;

        var callCount = 0;
        var ajax = PouchDB.utils.ajax;
        PouchDB.utils.ajax = function (opts) {
          if (/_changes/.test(opts.url)) {
            callCount++;
          }
          ajax.apply(this, arguments);
        };
        db.changes({
          since: update_seq
        }).on('change', function (change) {
        }).on('complete', function (result) {
          callCount.should.equal(1, 'One _changes call to complete changes');
          PouchDB.utils.ajax = ajax;
          done();
        }).on('error', done);
      });
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

  it('Test unauthorized user', function () {
    var db = new PouchDB(dbs.name, {
      auth: {
        user: 'foo',
        password: 'bar'
      }
    });
    return db.info().then(function () {
      if (testUtils.isExpressRouter()) {
        return; // express-router doesn't do auth
      }
      throw new Error('expected an error');
    }, function (err) {
      should.exist(err); // 401 error
    });
  });

  it('Test unauthorized user, user/pass in url itself', function () {
    var dbname = dbs.name.replace(/\/\//, '//foo:bar@');
    var db = new PouchDB(dbname);
    return db.info().then(function () {
      if (testUtils.isExpressRouter()) {
        return; // express-router doesn't do auth
      }
      throw new Error('expected an error');
    }, function (err) {
      should.exist(err); // 401 error
    });
  });

  it('Test custom header', function () {
    var db = new PouchDB(dbs.name, {
      headers: {
        'X-Custom': 'some-custom-header'
      }
    });
    return db.info();
  });

  it('getUrl() works (used by plugins)', function () {
    var db = new PouchDB(dbs.name);
    db.getUrl().should.match(/^http/);
  });

  it('getHeaders() works (used by plugins)', function () {
    var db = new PouchDB(dbs.name);
    db.getHeaders().should.deep.equal({});
  });

  it('test url too long error for allDocs()', function () {
    var docs = [];
    var numDocs = 75;
    for (var i = 0; i < numDocs; i++) {
      docs.push({
        _id: 'fairly_long_doc_name_' + i
      });
    }
    var db = new PouchDB(dbs.name);
    return db.bulkDocs(docs).then(function () {
      return db.allDocs({
        keys: docs.map(function (x) { return x._id; })
      });
    }).then(function (res) {
      res.rows.should.have.length(numDocs);
    });
  });

});
