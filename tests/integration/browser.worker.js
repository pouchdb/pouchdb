'use strict';

// Historically:
// only running in Chrome and Firefox due to various bugs.
// IE: https://connect.microsoft.com/IE/feedback/details/866495
// Safari: doesn't have IndexedDB or WebSQL in a WW
// NodeWebkit: not sure what the issue is
// Now:
// skipped everywhere, as they weren't being run anyway.
// See: https://github.com/pouchdb/pouchdb/issues/8680
// TODO re-introduce these tests in environments where they are appropriate.
describe.skip('browser.worker.js', function () {

  var worker;
  var dbs = {};

  before(function () {
    worker = new Worker('worker.js');

    worker.postMessage(['source', testUtils.pouchdbSrc()]);
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

  beforeEach(function (done) {
    dbs.name = testUtils.adapterUrl('local', 'testdb');
    dbs.remote = testUtils.adapterUrl('http', 'test_repl_remote');
    testUtils.cleanup([dbs.name, dbs.remote], done);
  });

  after(function (done) {
    worker.terminate();
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
    return Promise.all([
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
      return Promise.all([
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
