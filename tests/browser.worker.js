'use strict';

describe('browser.worker.js', function () {

  var dbs = {};

  beforeEach(function (done) {
    dbs.name = testUtils.adapterUrl('local', 'test_worker');
    dbs.remote = testUtils.adapterUrl('http', 'test_worker_remote');
    testUtils.cleanup([dbs.name, dbs.remote], done);
  });

  afterEach(function (done) {
    testUtils.cleanup([dbs.name, dbs.remote], done);
  });

  it('create it', function (done) {
    var worker = new Worker('worker.js');
    worker.addEventListener('message', function (e) {
      e.data.should.equal('pong');
      worker.terminate();
      done();
    });
    worker.postMessage('ping');
  });

  it('check pouch version', function (done) {
    var worker = new Worker('worker.js');
    worker.addEventListener('message', function (e) {
      PouchDB.version.should.equal(e.data);
      worker.terminate();
      done();
    });
    worker.postMessage('version');
  });

  it('create remote db', function (done) {
    var worker = new Worker('worker.js');
    worker.addEventListener('error', function (e) {
      throw e;
    });
    worker.addEventListener('message', function (e) {
      e.data.should.equal('lala');
      worker.terminate();
      done();
    });
    worker.postMessage(['create', dbs.remote]);
  });

  if (typeof mozIndexedDB === 'undefined') {
    it('create local db', function (done) {
      var worker = new Worker('worker.js');
      worker.addEventListener('error', function (e) {
        throw e;
      });
      worker.addEventListener('message', function (e) {
        e.data.should.equal('lala');
        worker.terminate();
        done();
      });
      worker.postMessage(['create', dbs.name]);
    });
  }

});
