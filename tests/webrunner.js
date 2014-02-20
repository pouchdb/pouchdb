/* global mocha: true */

'use strict';

var runner = mocha.run();
var results = {
  passed: 0,
  failed: 0,
  failures: []
};

runner.on('start', function (e) {
  if (window && window.fakeConsole) {
    window.fakeConsole.push('STARTING ' + e.title);
  }
});

runner.on('pass', function () {
  results.passed++;
});

runner.on('fail', function (e) {
  results.failed++;
  results.failures.push({
    title: e.title,
    err: e.err
  });
});
