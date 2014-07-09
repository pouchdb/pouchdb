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

  it('Create a pouch with a beforeSend hook', function (done) {
    var instantDB;
    PouchDB.destroy(dbs.name, function () {
      var beforeSendArguments = null;
      var ajax = {
        beforeSend: function(){
          beforeSendArguments = arguments;
        }
      };
      instantDB = new PouchDB(dbs.name, { ajax: ajax });
      instantDB.post({ test: 'abc' }, function (err, info) {
        beforeSendArguments.length.should.equal(2)
        var xhr = beforeSendArguments[0];
        var options = beforeSendArguments[1]
        
        xhr.should.be.an.instanceof(XMLHttpRequest);
        options.beforeSend.should.equal(ajax.beforeSend)
        done();
      });
    });
  });
});
