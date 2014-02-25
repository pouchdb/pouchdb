/* global mocha: true */

'use strict';

var runner = mocha.run();

window.results = {
  passed: 0,
  failed: 0,
  failures: []
};

runner.on('pass', function () {
  window.results.passed++;
});

runner.on('fail', function (e) {
  window.results.failed++;
  window.results.failures.push({
    title: e.title,
    err: e.err
  });
});

runner.on('end', function () {
  window.results.completed = true;
  window.results.passed++;
});
