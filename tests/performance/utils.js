'use strict';

var reporter = require('./perf.reporter');
var test = require('tape');
var commonUtils = require('../common-utils.js');
var nextTick = (typeof process === 'undefined' || process.browser) ?
  setTimeout : process.nextTick;

const params = commonUtils.params();
const grep = commonUtils.isNode() ? params.GREP : params.grep;

function iterationsFor(testCase) {
  const override = commonUtils.isNode() ? params.ITERATIONS : params.iterations;
  if (override) {
    return parseInt(override, 10);
  } else {
    return testCase.iterations;
  }
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
    return iterationsFor(testCase) > 0;
  });

  if (!testCases.length) {
    return callback();
  }

  testCases.forEach(function (testCase, i) {
    var testName = testCase.name;
    test('benchmarking', function (t) {
      var db;
      var setupObj;

      var localDbName = commonUtils.safeRandomDBName();

      const iterations = iterationsFor(testCase);

      t.test('setup', function (t) {
        db = new PouchDB(localDbName, { size: 3000 });
        adapterUsed = db.adapter;
        testCase.setup(db, { iterations }, function (err, res) {
          if (err) {
            t.error(err);
            reporter.log(testName + ' errored: ' + err.message + '\n');
          }
          setupObj = res;
          if (i === 0) {
            reporter.startSuite(suiteName);
          }
          reporter.start(testCase, iterations);
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
          if (++num < iterations) {
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
