/* global mocha: true */

'use strict';

function startTests() {
  var runner = mocha.run();
  window.results = {
    browser: navigator.userAgent,
    lastPassed: '',
    passed: 0,
    failed: 0,
    failures: []
  };

  runner.on('pass', function (e) {
    window.results.lastPassed = e.title;
    window.results.passed++;
  });

  runner.on('fail', function (e) {
    window.results.failed++;
    window.results.failures.push({
      title: e.title,
      message: e.err.message,
      stack: e.err.stack
    });
  });

  runner.on('end', function () {
    window.results.completed = true;
    window.results.passed++;
  });
}

if (window.cordova) {
  var hasGrep = window.GREP &&
      window.location.search.indexOf('grep=') === -1;
  var hasEs5Shim = window.ES5_SHIM &&
      window.location.search.indexOf('es5Shim=') === -1;
  var hasAutoCompaction = window.AUTO_COMPACTION &&
    window.location.search.indexOf('autoCompaction') === -1;
  var hasAdapters = window.ADAPTERS &&
    window.location.search.indexOf('adapters=') === -1;

  if (hasGrep || hasEs5Shim || hasAutoCompaction || hasAdapters) {
    var params = [];
    if (hasGrep) {
      params.push('grep=' + encodeURIComponent(window.GREP));
    }
    if (hasEs5Shim) {
      params.push('es5Shim=' + encodeURIComponent(window.ES5_SHIM));
    }
    if (hasAutoCompaction) {
      params.push('autoCompaction=' +
        encodeURIComponent(window.AUTO_COMPACTION));
    }
    if (hasAdapters) {
      params.push('adapters=' + encodeURIComponent(window.ADAPTERS));
    }
    window.location.search += (window.location.search ? '&' : '?') +
      params.join('&');
  } else {
    document.addEventListener("deviceready", startTests, false);
  }
} else {
  startTests();
}


