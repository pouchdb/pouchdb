'use strict';

var sourceFile = window.location.search.match(/[?&]sourceFile=([^&]+)/);

if (!sourceFile) {
  sourceFile = '../../dist/pouchdb.js';
} else {
  sourceFile = '../../dist/' + sourceFile[1];
}

if (typeof window.Worker === 'function') {
  runTests();
}

function runTests() {

  describe('browser.worker.js', function () {

    var dbs = {};

    beforeEach(function (done) {
      dbs.name = testUtils.adapterUrl('local', 'testdb');
      dbs.remote = testUtils.adapterUrl('http', 'test_repl_remote');
      testUtils.cleanup([dbs.name, dbs.remote], done);
    });

    after(function (done) {
      testUtils.cleanup([dbs.name, dbs.remote], done);
    });

    it.skip('create it', function (done) {
      var worker = new Worker('worker.js');
      worker.addEventListener('message', function (e) {
        e.data.should.equal('pong');
        worker.terminate();
        done();
      });
      worker.postMessage(sourceFile);
      worker.postMessage('ping');
    });

    it.skip('check pouch version', function (done) {
      var worker = new Worker('worker.js');
      worker.addEventListener('message', function (e) {
        PouchDB.version.should.equal(e.data);
        worker.terminate();
        done();
      });
      worker.postMessage(sourceFile);
      worker.postMessage('version');
    });

    var isNodeWebkit = typeof window !== 'undefined' &&
        typeof process !== 'undefined';

    // does not work in NodeWebkit
    if (!isNodeWebkit) {
      it.skip('create remote db', function (done) {
        var worker = new Worker('worker.js');
        worker.addEventListener('error', function (e) {
          throw e;
        });
        worker.addEventListener('message', function (e) {
          e.data.should.equal('lala');
          worker.terminate();
          done();
        });
        worker.postMessage(sourceFile);
        worker.postMessage(['create', dbs.remote]);
      });
    }


    // Mozilla bug: https://bugzilla.mozilla.org/show_bug.cgi?id=701634
    // IE bug: https://connect.microsoft.com/IE/feedback/details/866495
    // NodeWebkit bug... who knows
    if (!('mozIndexedDB' in window) &&
        !('msIndexedDB' in window) &&
        !isNodeWebkit) {
      it.skip('create local db', function (done) {
        var worker = new Worker('worker.js');
        worker.addEventListener('error', function (e) {
          throw e;
        });
        worker.addEventListener('message', function (e) {
          e.data.should.equal('lala');
          worker.terminate();
          done();
        });
        worker.postMessage(sourceFile);
        worker.postMessage(['create', dbs.name]);
      });
    }

  });
}
