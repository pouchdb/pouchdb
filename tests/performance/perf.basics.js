'use strict';

var PouchDB = require('../..');
var test = require('tape');
var reporter = require('./perf.reporter');
var Promise = PouchDB.utils.Promise;

function createDocId(i) {
  var intString = i.toString();
  while (intString.length < 10) {
    intString = '0' + intString;
  }
  return 'doc_' + intString;
}

var testCases = [
  {
    name: 'basic-inserts',
    assertions: 1,
    iterations: 100,
    setup: function (db, callback) {
      callback(null, {'yo': 'dawg'});
    },
    test: function (db, itr, doc, done) {
      db.put(doc, '' + itr, done);
    }
  }, {
    name: 'bulk-inserts',
    assertions: 1,
    iterations: 10,
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
    iterations: 1000,
    setup: function (db, callback) {
      var docs = [];
      for (var i = 0; i < 1000; i++) {
        docs.push({_id : createDocId(i), foo : 'bar', baz : 'quux'});
      }
      db.bulkDocs({docs : docs}, callback);
    },
    test: function (db, itr, docs, done) {
      db.get(createDocId(itr), done);
    }
  }, {
    name: 'all-docs-skip-limit',
    assertions: 1,
    iterations: 5,
    setup: function (db, callback) {
      var docs = [];
      for (var i = 0; i < 1000; i++) {
        docs.push({_id : createDocId(i), foo : 'bar', baz : 'quux'});
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
    iterations: 5,
    setup: function (db, callback) {
      var docs = [];
      for (var i = 0; i < 1000; i++) {
        docs.push({_id : createDocId(i), foo : 'bar', baz : 'quux'});
      }
      db.bulkDocs({docs : docs}, callback);
    },
    test: function (db, itr, docs, done) {
      var tasks = [];
      for (var i = 0; i < 10; i++) {
        tasks.push(i);
      }
      Promise.all(tasks.map(function (doc, i) {
        return db.allDocs({
          startkey : createDocId(i * 100),
          endkey : createDocId((i * 100) + 10)
        });
      })).then(function () {
        done();
      }, done);
    }
  }
];

testCases.forEach(function (testCase, i) {
  test('benchmarking', function (t) {

    var db;
    var setupObj;

    t.test('setup', function (t) {
      new PouchDB('test').then(function (d) {
        db = d;
        testCase.setup(db, function (err, res) {
          setupObj = res;
          reporter.start(testCase);
          t.end();
        });
      });
    });

    t.test(testCase.name, function (t) {
      t.plan(testCase.assertions);
      var num = 0;
      function after(err) {
        if (err) {
          t.error(err);
        }
        if (++num < testCase.iterations) {
          process.nextTick(function () {
            testCase.test(db, num, setupObj, after);
          });
        } else {
          t.ok(testCase.name + ' completed');
        }
      }
      testCase.test(db, num, setupObj, after);
    });
    t.test('teardown', function (t) {
      reporter.end(testCase);
      db.destroy(function () {
        t.end();
        if (i === testCases.length - 1) {
          reporter.complete();
        }
      });
    });
  });
});
