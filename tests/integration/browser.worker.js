'use strict';

var sourceFile = window.location.search.match(/[?&]sourceFile=([^&]+)/);

if (!sourceFile) {
  sourceFile = '../../packages/node_modules/pouchdb/dist/pouchdb.js';
} else {
  sourceFile = '../../packages/node_modules/pouchdb/dist/' + sourceFile[1];
}

// only running in Chrome and Firefox due to various bugs.
// IE: https://connect.microsoft.com/IE/feedback/details/866495
// Safari: doesn't have IndexedDB or WebSQL in a WW
// NodeWebkit: not sure what the issue is

var isNodeWebkit = typeof window !== 'undefined' &&
  typeof process !== 'undefined';

if (typeof window.Worker === 'function' &&
    !isNodeWebkit && !testUtils.isIE() &&
    (window.chrome || /Firefox/.test(navigator.userAgent))) {
  runTests();
}

function runTests() {

  var worker;

  before(function () {
    worker = new Worker('worker.js');
    worker.postMessage(['source', sourceFile]);
  });

  after(function () {
    worker.terminate();
  });

  function workerPromise(message) {
    return new Promise(function (resolve, reject) {
      worker.onerror = function (e) {
        reject(new Error(e.message + ": " + e.filename + ': ' + e.lineno));
      };
      worker.onmessage = function (e) {
        resolve(e.data);
      };
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
      return workerPromise(['postAttachmentThenAllDocs', dbs.name]).then(function (data) {
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

    it('total_rows consistent between worker and main thread', function () {
      var db = new PouchDB(dbs.name);
      
      // this test only makes sense for idb
      if (db.adapter !== 'idb') {
        return;
      }

      // both threads agree the count is 0
      return testUtils.Promise.all([
        db.allDocs().then(function (res) {
          res.total_rows.should.equal(0);
        }),
        workerPromise(['allDocs', dbs.name]).then(function (res) {
          res.total_rows.should.equal(0);
        })
      ]).then(function () {
        // post a doc
        return db.post({});
      }).then(function () {
        // both threads agree the count is 1
        return testUtils.Promise.all([
          db.allDocs().then(function (res) {
            res.total_rows.should.equal(1);
          }),
          workerPromise(['allDocs', dbs.name]).then(function (res) {
            res.total_rows.should.equal(1);
          })
        ]);
      });
    });
  });
}
