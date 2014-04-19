'use strict';

var reporter = require('./perf.reporter');
var test = require('tape');

var grep;
if (global.window && global.window.location && global.window.location.search) {
  grep = global.window.location.search.match(/[&?]grep=([^&]+)/);
  grep = grep && grep[1];
}

exports.runTests = function (PouchDB, suiteName, testCases, opts) {
  testCases.forEach(function (testCase, i) {
    if (grep && suiteName.indexOf(grep) === -1 &&
        testCase.name.indexOf(grep) === -1) {
      return;
    }
    test('benchmarking', function (t) {

      var db;
      var setupObj;

      var randomizer = Math.random();

      t.test('setup', function (t) {
        db = new PouchDB('test' + randomizer, opts);
        testCase.setup(db, function (err, res) {
          setupObj = res;
          if (i === 0) {
            reporter.startSuite(suiteName);
          }
          reporter.start(testCase);
          t.end();
        });
      });

      t.test(testCase.name, function (t) {
        t.plan(testCase.assertions);
        var num = 0;
        function after(err) {
          if (err) {
            t.error(err);
            reporter.log(testCase.name + ' errored: ' + err.message + '\n');
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
        var opts = {adapter : db.adapter};
        PouchDB.destroy('test' + randomizer, opts, function () {
          t.end();
          if (i === testCases.length - 1) {
            reporter.complete(suiteName);
          }
        });
      });
    });
  });
};
