/* global mocha: true */

'use strict';

var runner = mocha.run();
var results = {
  passed: 0,
  failed: 0,
  failures: []
};

runner.on('pass', function (e) {
  if (window && window.fakeConsole) {
    window.fakeConsole.push('PASS ' + e.title);
  }
  results.passed++;
});

runner.on('fail', function (e) {
  if (window && window.fakeConsole) {
    window.fakeConsole.push('FAIL ' + e.title);
  }
  results.failed++;
  results.failures.push({
    title: e.title,
    err: e.err
  });
});
