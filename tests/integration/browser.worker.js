'use strict';

var sourceFile = window.location.search.match(/[?&]sourceFile=([^&]+)/);

if (!sourceFile) {
  sourceFile = '../../dist/pouchdb.js';
} else {
  sourceFile = '../../dist/' + sourceFile[1];
}

// only running in Chrome and Firefox due to various bugs.
// IE: https://connect.microsoft.com/IE/feedback/details/866495
// Safari: doesn't have IndexedDB or WebSQL in a WW
// NodeWebkit: not sure what the issue is

var isNodeWebkit = typeof window !== 'undefined' &&
  typeof process !== 'undefined';

if (typeof window.Worker === 'function' &&
    !isNodeWebkit &&
    (window.chrome || /Firefox/.test(navigator.userAgent))) {
  runTests();
}

function runTests() {

  function workerPromise(message) {
    return new Promise(function (resolve, reject) {
      var worker = new Worker('worker.js');
      worker.addEventListener('error', function (e) {
        worker.terminate();
        reject(new Error(e.message + ": " + e.filename + ': ' + e.lineno));
      });
      worker.addEventListener('message', function (e) {
        worker.terminate();
        resolve(e.data);
      });
      worker.postMessage(['source', sourceFile]);
      worker.postMessage(message);
    });
  }

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

    it('create it', function () {
      return workerPromise('ping').then(function (data) {
        data.should.equal('pong');
      });
    });

    it('check pouch version', function () {
      return workerPromise('version').then(function (data) {
        PouchDB.version.should.equal(data);
      });
    });

    it('create remote db', function () {
      return workerPromise(['create', dbs.remote]).then(function (data) {
        data.should.equal('lala');
      });
    });

    it('create local db', function () {
      return workerPromise(['create', dbs.name]).then(function (data) {
        data.should.equal('lala');
      });
    });

    it('add doc with blob attachment', function () {
      return workerPromise(['allDocs', dbs.name]).then(function (data) {
        data.title.should.equal('lalaa');
      });
    });

    it('put an attachment', function () {
      var blob = new Blob(['foobar'], {type: 'text/plain'});
      var message = ['putAttachment', dbs.name, 'doc', 'att.txt', blob,
        'text/plain'];
      return workerPromise(message).then(function (blob) {
        blob.type.should.equal('text/plain');
        blob.size.should.equal(6);
      });
    });
  });
}
