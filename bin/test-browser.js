#!/usr/bin/env node

// This requires some setup, will attempt to remove steps needed

// You need to download and start selenium-server-standalone
// download from: https://code.google.com/p/selenium/downloads/list
// start with: java -jar ~/Downloads/selenium-server-standalone-2.37.0.jar

// You need chromedriver, download it @
// Download http://chromedriver.storage.googleapis.com/index.html?path=2.7/
// then add to your path

// If you are on OSX, you will need to ensure Firefox is on your path
// export PATH=/Applications/Firefox.app/Contents/MacOS/:$PATH

// Also needs $ npm run dev-server if run manually

var webdriverjs = require('webdriverjs');

var testUrl = 'http://127.0.0.1:8000/tests/test.html';
var testTimeout = 2 * 60 * 1000;
var testSelector = 'body.testsComplete';

var currentTest = '';
var results = {};
var client = {};

var browsers = [
  'firefox',
  // Temporarily disable safari until it is fixed (#1068)
  // 'safari',
  'chrome'
];

function testsComplete() {
  var passed = Object.keys(results).every(function(x) {
    return results[x].passed;
  });

  if (passed) {
    console.log('Woot, tests passed');
    process.exit(0);
  } else {
    console.error('Doh, tests failed');
    process.exit(1);
  }
}

function resultCollected(err, result) {
  console.log('[' + currentTest + '] ' +
              (result.value.passed ? 'passed' : 'failed'));
  results[currentTest] = result.value;
  client.end(startTest);
}

function testComplete(err, result) {
  if (err) {
    console.log('[' + currentTest + '] failed');
    results[currentTest] = {passed: false};
    return client.end(startTest);
  }
  client.execute('return window.testReport;', [], resultCollected);
}

function startTest() {
  if (!browsers.length) {
    return testsComplete();
  }

  currentTest = browsers.pop();
  console.log('[' + currentTest + '] starting');

  client = webdriverjs.remote({
    logLevel: 'silent',
    desiredCapabilities: {
      browserName: currentTest
    }
  });

  client.init();
  client.url(testUrl).waitFor(testSelector, testTimeout, testComplete);
}

startTest();
