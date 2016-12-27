'use strict';

var reporter = require('./perf.reporter');
var test = require('tape');
var commonUtils = require('../common-utils.js');
var Promise = require('lie');
var nextTick = (typeof process === 'undefined' || process.browser) ?
  setTimeout : process.nextTick;
var markMeasure = require('./markMeasure');

var grep;
if (global.window && global.window.location && global.window.location.search) {
  grep = global.window.location.search.match(/[&?]grep=([^&]+)/);
  grep = grep && grep[1];
} else if (process && process.env) {
  grep = process.env.GREP;
}

var levelAdapter = typeof process !== 'undefined' && process.env &&
    process.env.LEVEL_ADAPTER;

exports.runTests = function (PouchDB, suiteName, testCases, opts) {
  testCases.forEach(function (testCase, i) {
    var testName = testCase.name;
    if (grep && suiteName.indexOf(grep) === -1 &&
        testName.indexOf(grep) === -1) {
      return;
    }

    if (testCase.iterations === 0) {
      return;
    }

    test('benchmarking', function (t) {
      var db;
      var setupObj;

      var localDbName = commonUtils.safeRandomDBName();

      t.test('setup', function (t) {
        opts.size = 3000;
        if (levelAdapter) {
          opts.db = require(levelAdapter);
        }
        db = new PouchDB(localDbName, opts);
        testCase.setup(db, function (err, res) {
          if (err) {
            t.error(err);
            reporter.log(testName + ' errored: ' + err.message + '\n');
          }
          setupObj = res;
          if (i === 0) {
            reporter.startSuite(suiteName);
          }
          reporter.start(testCase);
          t.end();
        });
      });

      t.test(testName, function (t) {
        t.plan(testCase.assertions);
        var num = 0;
        function next() {
          nextTick(function () {
            markMeasure.mark('start_' + testName);
            testCase.test(db, num, setupObj, after);
          });
        }
        function after(err) {
          if (err) {
            t.error(err);
            reporter.log(testName + ' errored: ' + err.message + '\n');
          } else {
            markMeasure.mark('end_' + testName);
            markMeasure.measure(testName, 'start_' + testName, 'end_' + testName);
          }
          if (++num < testCase.iterations) {
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
          if (levelAdapter) {
            opts.db = require(levelAdapter);
          }
          return new PouchDB(localDbName, opts).destroy();
        }).then(function () {
          t.end();
          if (i === testCases.length - 1) {
            reporter.complete(suiteName);
          }
        });
      });
    });
  });
};
