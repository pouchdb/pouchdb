'use strict';

var PouchDB = require('../..');
var reporter = require('./perf.reporter');
var test = require('tape');

exports.runTests = function (suiteName, testCases) {
  testCases.forEach(function (testCase, i) {
    test('benchmarking', function (t) {

      var db;
      var setupObj;

      t.test('setup', function (t) {
        new PouchDB('test').then(function (d) {
          db = d;
          testCase.setup(db, function (err, res) {
            setupObj = res;
            if (i === 0) {
              reporter.startSuite(suiteName);
            }
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
            reporter.complete(suiteName);
          }
        });
      });
    });
  });
};