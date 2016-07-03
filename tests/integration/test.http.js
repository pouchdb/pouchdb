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

  it('Create a pouch without DB setup (skip_setup)', function (done) {
    var instantDB;
    testUtils.isCouchDB(function (isCouchDB) {
      if (!isCouchDB) {
        return done();
      }
      var db = new PouchDB(dbs.name);
      db.destroy(function () {
        instantDB = new PouchDB(dbs.name, { skip_setup: true });
        instantDB.post({ test: 'abc' }, function (err) {
          should.exist(err);
          err.name.should.equal('not_found', 'Skipped setup of database');
          done();
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
    db.bulkDocs({ docs: docs }, function () {
      db.info(function (err, info) {
        var update_seq = info.update_seq;

        var callCount = 0;
        var ajax = db._ajax;
        db._ajax = function (opts) {
          if (/_changes/.test(opts.url)) {
            callCount++;
          }
          ajax.apply(this, arguments);
        };
        db.changes({
          since: update_seq
        }).on('change', function () {
        }).on('complete', function () {
          callCount.should.equal(1, 'One _changes call to complete changes');
          db._ajax = ajax;
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
    db.bulkDocs({ docs: [ddoc] }, function () {
      db.get(ddoc._id, function (err, doc) {
        should.not.exist(err);
        doc._id.should.equal(ddoc._id, 'Correct doc returned');
        done();
      });
    });
  });

  it('Properly escape url params #4008', function () {
    var db = new PouchDB(dbs.name);
    var ajax = db._ajax;
    db._ajax = function (opts) {
      opts.url.should.not.contain('[');
      ajax.apply(this, arguments);
    };
    return db.changes({doc_ids: ['1']}).then(function () {
      db._ajax = ajax;
    });
  });

  it('Allows the "ajax timeout" to extend "changes timeout"', function (done) {
    var timeout = 120000;
    var db = new PouchDB(dbs.name, {
      skip_setup: true,
      ajax: {
        timeout: timeout
      }
    });

    var ajax = db._ajax;
    var ajaxOpts;
    db._ajax = function (opts) {
      if (/changes/.test(opts.url)) {
        ajaxOpts = opts;
        changes.cancel();
      }
      ajax.apply(this, arguments);
    };

    var changes = db.changes();

    changes.on('complete', function () {
      should.exist(ajaxOpts);
      ajaxOpts.timeout.should.equal(timeout);
      db._ajax = ajax;
      done();
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

  it('4358 db.info rejects when server is down', function () {
    var db = new PouchDB('http://example.com/foo');
    return db.info().then(function () {
      throw new Error('expected an error');
    }).catch(function (err) {
      should.exist(err);
    });
  });

  it('4358 db.destroy rejects when server is down', function () {
    var db = new PouchDB('http://example.com/foo');
    return db.destroy().then(function () {
      throw new Error('expected an error');
    }).catch(function (err) {
      should.exist(err);
    });
  });

});
