'use strict';

module.exports = function (PouchDB, callback) {

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
      setup: function (db, _, callback) {
        callback(null, {'yo': 'dawg'});
      },
      test: function (db, itr, doc, done) {
        db.post(doc, done);
      }
    },
    {
      name: 'bulk-inserts',
      assertions: 1,
      iterations: 100,
      setup: function (db, _, callback) {
        var docs = [];
        for (var i = 0; i < 100; i++) {
          docs.push({much : 'docs', very : 'bulk'});
        }
        callback(null, {docs});
      },
      test: function (db, itr, docs, done) {
        db.bulkDocs(docs, done);
      }
    },
    {
      name: 'bulk-inserts-large-docs',
      assertions: 1,
      iterations: 100,
      setup: function (db, _, callback) {
        var docs = [];

        for (var d = 0; d < 100; d++) {
          var doc = {};
          for (var i = 0; i < 100; i++) {
            doc['hello' + i] = "hey" + i;
          }
          docs.push(doc);
        }

        callback(null, {docs});
      },
      test: function (db, itr, docs, done) {
        db.bulkDocs(docs, done);
      }
    },
    {
      name: 'bulk-inserts-massive-docs',
      assertions: 1,
      iterations: 10,
      setup: function (db, _, callback) {
        var docs = [];

        // Depth is an important factor here. Depth makes any kind of recursive
        // algorithm (eg cloning) very slow.
        // We're also adding in something that IndexedDB needs to rewrite (slowing things down more)
        // Other implementations are welcome to put things here that cause write slowness
        var innerDoc = function (count) {
          var inner = {};

          if (count > 6) {
            for (var i = 0; i < 10; i++) {
              if (i === 3) {
                // 1/10 branches will cause indexeddb to rewrite a value
                inner["sovery"+i] = false;
              }
              inner["sovery"+i] = i + "cool";
            }
          } else {
            for (var ii = 0; ii < 4; ii++) {
              inner["sovery"+ii] = innerDoc(count + 1);
            }
          }

          return inner;
        };

        for (var d = 0; d < 50; d++) {
          docs.push(innerDoc(1));
        }

        callback(null, {docs});
      },
      test: function (db, itr, docs, done) {
        db.bulkDocs(docs, done);
      }
    },
    {
      name: 'basic-updates',
      assertions: 1,
      iterations: 100,
      setup: function (db, _, callback) {
        var docs = [];
        for (var i = 0; i < 100; i++) {
          docs.push({});
        }
        db.bulkDocs(docs, callback);
      },
      test: function (db, itr, _, done) {
        db.allDocs({include_docs: true}, function (err, res) {
          if (err) {
            return done(err);
          }
          var docs = res.rows.map(function (x) { return x.doc; });
          db.bulkDocs(docs, done);
        });
      }
    },
    {
      name: 'basic-gets',
      assertions: 1,
      iterations: 1000,
      setup: function (db, { iterations }, callback) {
        var docs = [];
        for (var i = 0; i < iterations; i++) {
          docs.push({_id : commonUtils.createDocId(i),
            foo : 'bar', baz : 'quux'});
        }
        db.bulkDocs({docs}, callback);
      },
      test: function (db, itr, docs, done) {
        db.get(commonUtils.createDocId(itr), done);
      }
    },
    {
      name: 'all-docs-skip-limit',
      assertions: 1,
      iterations: 10,
      setup: function (db, _, callback) {
        var docs = [];
        for (var i = 0; i < 1000; i++) {
          docs.push({_id : commonUtils.createDocId(i),
            foo : 'bar', baz : 'quux'});
        }
        db.bulkDocs({docs}, callback);
      },
      test: function (db, itr, docs, done) {
        function taskFactory(i) {
          return function () {
            return db.allDocs({skip : i * 100, limit : 10});
          };
        }
        var promise = Promise.resolve();
        for (var i = 0; i < 10; i++) {
          promise = promise.then(taskFactory(i));
        }
        promise.then(function () {
          done();
        }, done);
      }
    },
    {
      name: 'all-docs-startkey-endkey',
      assertions: 1,
      iterations: 10,
      setup: function (db, _, callback) {
        var docs = [];
        for (var i = 0; i < 1000; i++) {
          docs.push({
            _id: commonUtils.createDocId(i),
            foo: 'bar',
            baz: 'quux'
          });
        }
        db.bulkDocs({docs}, callback);
      },
      test: function (db, itr, docs, done) {
        function taskFactory(i) {
          return function () {
            return db.allDocs({
              startkey: commonUtils.createDocId(i * 100),
              endkey: commonUtils.createDocId((i * 100) + 10)
            });
          };
        }
        var promise = Promise.resolve();
        for (var i = 0; i < 10; i++) {
          promise = promise.then(taskFactory(i));
        }
        promise.then(function () {
          done();
        }, done);
      }
    },
    {
      name: 'all-docs-keys',
      assertions: 1,
      iterations: 100,
      setup: function (db, _, callback) {
        var docs = [];
        for (var i = 0; i < 1000; i++) {
          docs.push({_id : commonUtils.createDocId(i),
            foo : 'bar', baz : 'quux'});
        }
        db.bulkDocs({docs}, callback);
      },
      test: function (db, itr, docs, done) {
        function randomDocId() {
          return commonUtils.createDocId(
            Math.floor(Math.random() * 1000));
        }
        var keys = [];
      for (var i = 0; i < 50; i++) {
          keys.push(randomDocId());
        }
        db.allDocs({
          keys,
          include_docs: true
        }, done);
      }
    },
    {
      name: 'all-docs-include-docs',
      assertions: 1,
      iterations: 100,
      setup: function (db, _, callback) {
        var docs = [];
        for (var i = 0; i < 1000; i++) {
          docs.push({
            _id: commonUtils.createDocId(i),
            foo: 'bar',
            baz: 'quux',
            _deleted: i % 2 === 1
          });
        }
        db.bulkDocs({docs}, callback);
      },
      test: function (db, itr, docs, done) {
        return db.allDocs({
          include_docs: true,
          limit: 100
        }).then(function () {
          return db.post({}); // to invalidate the doc count
        }).then(function () {
          done();
        }, done);
      }
    },
    {
      name: 'pull-replication-perf-skimdb',
      assertions: 1,
      iterations: 0,
      setup: function (localDB, { iterations }, callback) {
        // The NPM registry is a couchdb database.  "skimdb" is the NPM
        // registry, minus the actual packages, found at
        // https://skimdb.npmjs.com/registry, and an example of a real, public
        // db with a lot of docs.
        // FIXME this mirror is currently down, as is iriscouch.com; find an
        // alternative mirror.
        var remoteCouchUrl = "http://skimdb.iriscouch.com/registry";
        var remoteDB = new PouchDB(remoteCouchUrl, {
          ajax: {pool: {maxSockets: 15}}
        });
        var localPouches = [];

        for (var i = 0; i < iterations; ++i) {
          localPouches[i] = new PouchDB(commonUtils.safeRandomDBName());
        }

        return callback(null, {
          localPouches,
          remoteDB
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

  utils.runTests(PouchDB, 'basics', testCases, callback);
};
