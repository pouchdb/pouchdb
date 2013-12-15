#!/usr/bin/env node

var path = require('path');
var spawn = require('child_process').spawn;

var webdriverjs = require('webdriverjs');
var devserver = require('./dev-server.js');

var SELENIUM_PATH = '../node_modules/.bin/start-selenium';
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

// Travis only has firefox
if (process.env.TRAVIS) {
  browsers = ['firefox'];
}

function startServers(callback) {

  // Starts the file and CORS proxy
  devserver.start();

  // Start selenium
  var selenium = spawn(path.resolve(__dirname, SELENIUM_PATH));

  selenium.stdout.on('data', function(data) {
    if (/Started org.openqa.jetty.jetty/.test(data)) {
      callback();
    }
  });
}

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

startServers(function() {
  startTest();
});
