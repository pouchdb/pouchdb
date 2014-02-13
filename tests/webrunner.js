"use strict";

var runner = mocha.run();
var results = {};
results.passed = 0;
results.failed = 0;
results.total = 0;
results.failures = [];
runner.on('pass', function() {
  results.passed++;
  results.total++;
});
runner.on('fail', function(e) {
  results.failures.push(e);
  results.failed++;
  results.total++;
});