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

  // TODO: Remove `skipSetup` in favor of `skip_setup` in a future release
  it('Create a pouch without DB setup (skipSetup)', function (done) {
    var instantDB;
    testUtils.isCouchDB(function (isCouchDB) {
      if (!isCouchDB) {
        return done();
      }
      var db = new PouchDB(dbs.name);
      db.destroy(function () {
        instantDB = new PouchDB(dbs.name, { skipSetup: true });
        instantDB.post({ test: 'abc' }, function (err) {
          should.exist(err);
          err.name.should.equal('not_found', 'Skipped setup of database');
          done();
        });
      });
    });
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
    var callCount = 0;

    for (var i = 0; i < num; i++) {
      docs.push({_id: 'doc_' + i, foo: 'bar_' + i});
    }

    var db = new PouchDB(dbs.name, {
      request: function (opts, ajax) {
        if (/_changes/.test(opts.url)) {
          callCount++;
        }
        return ajax(opts);
      }
    });
    db.bulkDocs({ docs: docs }, function () {
      db.info(function (err, info) {
        var update_seq = info.update_seq;
        db.changes({
          since: update_seq
        }).on('change', function () {
        }).on('complete', function () {
          callCount.should.equal(1, 'One _changes call to complete changes');
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
    var db = new PouchDB(dbs.name, {
      request: function (opts, ajax) {
        opts.url.should.not.contain('[');
        return ajax(opts);
      }
    });
    return db.changes({doc_ids: ['1']});
  });

  it('Allows the "ajax timeout" to extend "changes timeout"', function (done) {
    var timeout = 120000;
    var ajaxOpts;
    var db = new PouchDB(dbs.name, {
      skipSetup: true,
      ajax: { timeout: timeout },
      request: function (opts, ajax) {
        if (/changes/.test(opts.url)) {
          ajaxOpts = opts;
          changes.cancel();
        }
        return ajax(opts);
      }
    });

    var changes = db.changes();

    changes.on('complete', function () {
      should.exist(ajaxOpts);
      ajaxOpts.timeout.should.equal(timeout);
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


  it('5574 Create a pouch with / in name and prefix url', function () {
    // CouchDB Master disallows these characters
    if (testUtils.isCouchMaster()) {
      return true;
    }
    var db = new PouchDB('test/suffix', {
      prefix: testUtils.adapterUrl('http', '')
    });
    return db.info().then(function () {
      return db.destroy();
    });
  });

  it('#5322 Custom ajax to count requests', function () {
    var reqCount = 0;
    var db = new PouchDB(dbs.name, {
      request: function (opts, ajax) {
        reqCount++;
        return ajax(opts);
      }
    });
    return db.info().then(function () {
      reqCount.should.equal(3);
    });
  });

  it('#5322 Custom ajax to reject requests', function () {
    var db = new PouchDB(dbs.name, {
      request: function () {
        return testUtils.Promise.reject({
          status: 412,
          name: 'myfakeerror'
        });
      }
    });
    return db.info().catch(function (err) {
      err.status.should.equal(412);
    });
  });

  it('#5322 Custom ajax to modify requests', function () {
    var db = new PouchDB(dbs.name, {
      request: function (opts, ajax) {
        // We could add headers here, however they would need
        // to be allowed by CORS
        // opts.headers.myauth = 'some';
        return ajax(opts).then(function (res) {
          res.customfield = 'foo';
          return res;
        });
      }
    });
    return db.info().then(function (res) {
      res.customfield.should.equal('foo');
    });
  });

  it('#5322 Custom ajax throws', function () {
    var db = new PouchDB(dbs.name, {
      request: function () {
        throw new Error('wtf');
      }
    });
    return db.info().then(function () {
      throw 'Should not complete';
    }).catch(function (err) {
      should.exist(err);
      err.message.should.equal('wtf');
    });
  });

});
