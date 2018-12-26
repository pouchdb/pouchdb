'use strict';

var reporter = require('./perf.reporter');
var test = require('tape');
var commonUtils = require('../common-utils.js');
var nextTick = (typeof process === 'undefined' || process.browser) ?
  setTimeout : process.nextTick;

var grep;
var iterations;
if (global.window && global.window.location && global.window.location.search) {
  grep = global.window.location.search.match(/[&?]grep=([^&]+)/);
  grep = grep && grep[1];
  iterations = global.window.location.search.match(/[&?]iterations=([^&]+)/);
  iterations = iterations && parseInt(iterations[1], 10);
} else if (process && process.env) {
  grep = process.env.GREP;
  iterations = process.env.ITERATIONS && parseInt(process.env.ITERATIONS, 10);
}

var adapterUsed;

exports.runTests = function (PouchDB, suiteName, testCases, opts, callback) {

  testCases = testCases.filter(function (testCase) {
    if (grep && suiteName.indexOf(grep) === -1 &&
      testCase.name.indexOf(grep) === -1) {
      return false;
    }
    var iter = typeof iterations === 'number' ? iterations :
      testCase.iterations;
    return iter !== 0;
  });

  if (!testCases.length) {
    return callback();
  }

  testCases.forEach(function (testCase, i) {
    var testName = testCase.name;
    var iter = typeof iterations === 'number' ? iterations :
      testCase.iterations;
    test('benchmarking', function (t) {
      var db;
      var setupObj;

      var localDbName = commonUtils.safeRandomDBName();

      t.test('setup', function (t) {
        opts.size = 3000;
        db = new PouchDB(localDbName, opts);
        adapterUsed = db.adapter;
        testCase.setup(db, function (err, res) {
          if (err) {
            t.error(err);
            reporter.log(testName + ' errored: ' + err.message + '\n');
          }
          setupObj = res;
          if (i === 0) {
            reporter.startSuite(suiteName);
          }
          reporter.start(testCase, iter);
          t.end();
        });
      });

      t.test(testName, function (t) {
        t.plan(testCase.assertions);
        var num = 0;
        function next() {
          nextTick(function () {
            reporter.startIteration(testCase);
            testCase.test(db, num, setupObj, after);
          });
        }
        function after(err) {
          if (err) {
            t.error(err);
            reporter.log(testName + ' errored: ' + err.message + '\n');
          } else {
            reporter.endIteration(testCase);
          }
          if (++num < iter) {
            next();
          } else {
            t.ok(testName + ' completed');
          }
        }
        next();
      });
      t.test('teardown', function (t) {
        var testCaseTeardown = testCase.tearDown ?
          testCase.tearDown(db, setupObj) :
          Promise.resolve();

        testCaseTeardown.then(function () {
          reporter.end(testCase);
          var opts = {adapter : db.adapter};
          return new PouchDB(localDbName, opts).destroy();
        }).then(function () {
          t.end();
          if (i === testCases.length - 1) {
            reporter.endSuite(suiteName);
            callback(adapterUsed);
          }
        });
      });
    });
  });
};
