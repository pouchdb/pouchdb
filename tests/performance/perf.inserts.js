'use strict';

var PouchDB = require('../..');
var test = require('tape');
var reporter = require('./perf.reporter');

function padInt(i) {
  var intString = i.toString();
  while (intString.length < 10) {
    intString += '0' + intString;
  }
  return intString;
}

// so we don't have to generate them every time, which might throw off
// the perf numbers
var docIds = [];
for (var counter = 0; counter < 10000; counter++) {
  docIds.push('numero_' + padInt(counter));
}

var testCases = [
  {
    name : 'basic-inserts',
    assertions : 1,
    iterations : 100,
    setup : function (db, callback) {
      callback(null, {'yo': 'dawg'});
    },
    test : function (db, itr, doc, done) {
      db.put(doc, '' + itr, done);
    }
  }, {
    name : 'bulk-inserts',
    assertions : 1,
    iterations : 10,
    setup : function (db, callback) {
      var docs = [];
      for (var i = 0; i < 100; i++) {
        docs.push({much : 'docs', very : 'bulk'});
      }
      callback(null, {docs : docs});
    },
    test : function (db, itr, docs, done) {
      db.bulkDocs(docs, done);
    }
  }, {
    name : 'basic-gets',
    assertions : 1,
    iterations : 1000,
    setup : function (db, callback) {
      var docs = [];
      for (var i = 0; i < 1000; i++) {
        docs.push({_id : docIds[i], foo : 'bar', baz : 'quux'});
      }
      db.bulkDocs({docs : docs}, callback);
    },
    test : function (db, itr, docs, done) {
      db.get(docIds[itr], done);
    }
  }, {
    name : 'all-docs-skip-limit',
    assertions : 1,
    iterations : 50,
    setup : function (db, callback) {
      var docs = [];
      for (var i = 0; i < 1000; i++) {
        docs.push({_id : docIds[i], foo : 'bar', baz : 'quux'});
      }
      db.bulkDocs({docs : docs}, callback);
    },
    test : function (db, itr, docs, done) {
      db.allDocs({skip : itr, limit : 10}, done);
    }
  }, {
    name : 'all-docs-startkey-endkey',
    assertions : 1,
    iterations : 50,
    setup : function (db, callback) {
      var docs = [];
      for (var i = 0; i < 1000; i++) {
        docs.push({_id : docIds[i], foo : 'bar', baz : 'quux'});
      }
      db.bulkDocs({docs : docs}, callback);
    },
    test : function (db, itr, docs, done) {
      db.allDocs({
        startkey : docIds[itr],
        endkey : docIds[itr + 10]
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