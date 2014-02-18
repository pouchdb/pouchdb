/* global mocha: true */
'use strict';
var runner = mocha.run();
var results = {};
results.passed = 0;
results.failed = 0;
results.total = 0;
runner.on('pass', function () {
  results.passed++;
  results.total++;
});
runner.on('fail', function () {
  results.failed++;
  results.total++;
});