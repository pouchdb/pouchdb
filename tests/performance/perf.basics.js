'use strict';

module.exports = function (PouchDB, opts) {

  var Promise = require('bluebird');
  var utils = require('./utils');
  var commonUtils = require('../common-utils.js');

  var RepTest = require('./replication-test.js')(PouchDB, Promise);
  var oneGen = new RepTest();
  var twoGen = new RepTest();

  var testCases = [
    {
      name: 'basic-inserts',
      assertions: 1,
      iterations: 1000,
      setup: function (db, callback) {
        callback(null, {'yo': 'dawg'});
      },
      test: function (db, itr, doc, done) {
        db.post(doc, done);
      }
    }, {
      name: 'bulk-inserts',
      assertions: 1,
      iterations: 100,
      setup: function (db, callback) {
        var docs = [];
        for (var i = 0; i < 100; i++) {
          docs.push({much : 'docs', very : 'bulk'});
        }
        callback(null, {docs : docs});
      },
      test: function (db, itr, docs, done) {
        db.bulkDocs(docs, done);
      }
    }, {
      name: 'basic-gets',
      assertions: 1,
      iterations: 10000,
      setup: function (db, callback) {
        var docs = [];
        for (var i = 0; i < 10000; i++) {
          docs.push({_id : commonUtils.createDocId(i),
            foo : 'bar', baz : 'quux'});
        }
        db.bulkDocs({docs : docs}, callback);
      },
      test: function (db, itr, docs, done) {
        db.get(commonUtils.createDocId(itr), done);
      }
    }, {
      name: 'all-docs-skip-limit',
      assertions: 1,
      iterations: 50,
      setup: function (db, callback) {
        var docs = [];
        for (var i = 0; i < 1000; i++) {
          docs.push({_id : commonUtils.createDocId(i),
            foo : 'bar', baz : 'quux'});
        }
        db.bulkDocs({docs : docs}, callback);
      },
      test: function (db, itr, docs, done) {
        var tasks = [];
        for (var i = 0; i < 10; i++) {
          tasks.push(i);
        }
        Promise.all(tasks.map(function (doc, i) {
          return db.allDocs({skip : i * 100, limit : 10});
        })).then(function () {
          done();
        }, done);
      }
    }, {
      name: 'all-docs-startkey-endkey',
      assertions: 1,
      iterations: 50,
      setup: function (db, callback) {
        var docs = [];
        for (var i = 0; i < 1000; i++) {
          docs.push({
            _id: commonUtils.createDocId(i),
            foo: 'bar',
            baz: 'quux'
          });
        }
        db.bulkDocs({docs: docs}, callback);
      },
      test: function (db, itr, docs, done) {
        var tasks = [];
        for (var i = 0; i < 10; i++) {
          tasks.push(i);
        }
        Promise.all(tasks.map(function (doc, i) {
          return db.allDocs({
            startkey: commonUtils.createDocId(i * 100),
            endkey: commonUtils.createDocId((i * 100) + 10)
          });
        })).then(function () {
          done();
        }, done);
      }
    },
    {
      name: 'pull-replication-perf-skimdb',
      assertions: 1,
      iterations: 0,
      setup: function (localDB, callback) {
        var remoteCouchUrl = "http://skimdb.iriscouch.com/registry";
        var remoteDB = new PouchDB(remoteCouchUrl, {
          ajax: {pool: {maxSockets: 15}}
        });
        var localPouches = [];

        for (var i = 0; i < this.iterations; ++i) {
          localPouches[i] = new PouchDB(commonUtils.safeRandomDBName());
        }

        return callback(null, {
          localPouches: localPouches,
          remoteDB: remoteDB
        });
      },
      test: function (ignoreDB, itr, testContext, done) {
        var localDB = testContext.localPouches[itr];
        var remoteDB = testContext.remoteDB;

        var replication = PouchDB.replicate(remoteDB, localDB, {
          live: false,
          batch_size: 100
        });
        replication.on('change', function (info) {
          if (info.docs_written >= 200) {
            replication.cancel();
            done();
          }
        }).on('error', done);
      },
      tearDown: function (ignoreDB, testContext) {
        if (testContext && testContext.localPouches) {
          return Promise.all(
            testContext.localPouches.map(function (localPouch) {
              return localPouch.destroy();
            }));
        }
      }
    },
    {
      name: 'pull-replication-one-generation',
      assertions: 1,
      iterations: 1,
      setup: oneGen.setup(1, 1),
      test: oneGen.test(),
      tearDown: oneGen.tearDown()
    },
    {
      name: 'pull-replication-two-generation',
      assertions: 1,
      iterations: 1,
      setup: twoGen.setup(1, 2),
      test: twoGen.test(),
      tearDown: twoGen.tearDown()
    }
  ];

  utils.runTests(PouchDB, 'basics', testCases, opts);
};
