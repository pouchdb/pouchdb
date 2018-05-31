'use strict';

describe('test.http.js', function () {

  var dbs = {};

  beforeEach(function () {
    dbs.name = testUtils.adapterUrl('http', 'test_http');
  });

  afterEach(function (done) {
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
    var callCount = 0;
    for (var i = 0; i < num; i++) {
      docs.push({
        _id: 'doc_' + i,
        foo: 'bar_' + i
      });
    }
    var db = new PouchDB(dbs.name, {
      fetch: function (url, opts) {
        if (/_changes/.test(url)) {
          callCount++;
        }
        return PouchDB.fetch(url, opts);
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
      fetch: function (url, opts) {
        url.should.not.contain('[');
        return PouchDB.fetch(url, opts);
      }
    });
    return db.changes({doc_ids: ['1']});
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

  it('changes respects seq_interval', function (done) {
    var docs = [
      {_id: '0', integer: 0, string: '0'},
      {_id: '1', integer: 1, string: '1'},
      {_id: '2', integer: 2, string: '2'}
    ];

    var db = new PouchDB(dbs.name);
    var changesCount = 0;
    db.bulkDocs(docs).then(function () {
      db.changes({ seq_interval: 4, return_docs: true })
      .on('change', function () {
        changesCount++;
      }).on('error', function (err) {
        done(err);
      }).on('complete', function (info) {
        try {
          changesCount.should.equal(3);

          // we can't know in advance which
          // order the changes arrive in so sort them
          // so that nulls appear last
          info.results.sort(function (a, b) {
            if (a.seq !== null && b.seq === null) {
              return -1;
            }

            if (a.seq === null && b.seq !== null) {
              return 1;
            }

            return 0;
          });

          // first change always contains a seq
          should.not.equal(info.results[0].seq, null);
          should.not.equal(info.last_seq, null);
          done();
        }
        catch (e) {
          done(e);
        }
      });
    });
  });

  it('5814 Ensure prefix has trailing /', function () {
    var index = testUtils.adapterUrl('http', '').lastIndexOf('/');
    var prefix = testUtils.adapterUrl('http', '').substr(0, index);
    var db = new PouchDB('test', {prefix: prefix});
    return db.info().then(function () {
      return db.destroy();
    });
  });

});
