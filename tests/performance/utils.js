'use strict';

var reporter = require('./perf.reporter');
var test = require('tape');
var commonUtils = require('../common-utils.js');
var nextTick = (typeof process === 'undefined' || process.browser) ?
  setTimeout : process.nextTick;

var grep;
var iterations;
const params = commonUtils.params();
if (commonUtils.isNode()) {
  grep = params.GREP;
  iterations = params.ITERATIONS && parseInt(params.ITERATIONS, 10);
} else {
  grep = params.grep;
  iterations = params.iterations && parseInt(params.iterations, 10);
}

var adapterUsed;

exports.runTests = function (PouchDB, suiteName, testCases, callback) {

  testCases = testCases.filter(function (testCase) {
    if (grep) {
      const regexp = new RegExp(grep);
      if (!regexp.test(suiteName) && !regexp.test(testCase.name)) {
        return false;
      }
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
        db = new PouchDB(localDbName, { size: 3000 });
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
        if (global.window && global.window.console && global.window.console.profile) {
          global.window.console.profile(testName);
        }
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
        if (global.window && global.window.console && global.window.console.profileEnd) {
          global.window.console.profileEnd();
        }
        var testCaseTeardown = testCase.tearDown ?
          testCase.tearDown(db, setupObj) :
          Promise.resolve();

        testCaseTeardown.then(function () {
          reporter.end(testCase);
          return new PouchDB(localDbName).destroy();
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
