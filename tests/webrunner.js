/* global mocha: true */

'use strict';

// use query parameter sourceFile if present,
// eg: test.html?sourceFile=pouchdb-leveljs.js
var sourceFile = window.location.search.match(/[?&]sourceFile=([^&]+)/);

if (!sourceFile) {
  sourceFile = '../dist/pouchdb-nightly.js';
} else {
  sourceFile = '../dist/' + sourceFile[1];
}

// Thanks to http://engineeredweb.com/blog/simple-async-javascript-loader/
function asyncLoadScript(url, callback) {

  // Create a new script and setup the basics.
  var script = document.createElement("script"),
  firstScript = document.getElementsByTagName('script')[0];

  script.async = true;
  script.src = url;

  // Handle the case where an optional callback was passed in.
  if ("function" === typeof(callback)) {
    script.onload = function () {
      callback();

      // Clear it out to avoid getting called more than once or any 
      // memory leaks.
      script.onload = script.onreadystatechange = undefined;
    };
    script.onreadystatechange = function () {
      if ("loaded" === script.readyState || "complete" === script.readyState) {
        script.onload();
      }
    };
  }

  // Attach the script tag to the page (before the first script) so the
  //magic can happen.
  firstScript.parentNode.insertBefore(script, firstScript);
}

function startTests() {
  asyncLoadScript(sourceFile, function () {
    var runner = mocha.run();
    window.results = {
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
  });
}

if (window.cordova) {
  var hasGrep = window.GREP &&
      window.location.search.indexOf('grep') === -1;
  var hasEs5Shim = window.ES5_SHIM &&
      window.location.search.indexOf('es5Shim') === -1;

  if (hasGrep || hasEs5Shim) {
    var params = [];
    if (hasGrep) {
      params.push('grep=' + encodeURIComponent(window.GREP));
    }
    if (hasEs5Shim) {
      params.push('es5Shim=' + encodeURIComponent(window.ES5_SHIM));
    }
    window.location.search += (window.location.search ? '&' : '?') +
      params.join('&');
  } else {
    document.addEventListener("deviceready", startTests, false);
  }
} else {
  startTests();
}


