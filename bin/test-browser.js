#!/usr/bin/env node
"use strict";

var path = require('path');
var spawn = require('child_process').spawn;

var wd = require('wd');
var devserver = require('./dev-server.js');

var SELENIUM_PATH = '../vendor/selenium-server-standalone-2.38.0.jar';
var testUrl = 'http://127.0.0.1:8000/tests/test.html';
var testTimeout = 30 * 60 * 1000;
var results = {};

if (process.env.GREP) {
  testUrl += '?grep=' + process.env.GREP;
}

var browsers = [
  'firefox',
  // Temporarily disable safari until it is fixed (#1068)
  // 'safari',
 // 'chrome'
];

if (process.env.TRAVIS) {
  process.exit(0);
}
var numBrowsers = browsers.length;
var finishedBrowsers = 0;

function startServers(callback) {

  // Starts the file and CORS proxy
  devserver.start();

  // Start selenium
  var started = false;
  var args = [
    '-jar',
    path.resolve(__dirname, SELENIUM_PATH),
  ];

  var selenium = spawn('java', args, {});
  selenium.stdout.on('data', function (data) {
    if (!started &&
        /Started org.openqa.jetty.jetty.servlet.ServletHandler/.test(data)) {
      started = true;
      callback();
    }
  });
}

function testsComplete() {
  var tests = Object.keys(results).length;

  var passed = tests && Object.keys(results).every(function (x) {
    return !results[x].failed;
  });

  var failed = Object.keys(results).filter(function (x) {
    return results[x].failed;
  }).length;

  if (passed) {
    console.log('Woot, all ' + Object.keys(results).length + ' tests passed');
    process.exit(0);
  } else if (!Object.keys(results).length) {
    console.error('no tests ran');
    process.exit(4);
  } else {
    console.error('we ran ' + Object.keys(results).length + ' tests and ' + failed + ' failed');
    process.exit(1);
  }
}


function startTest() {
  if (numBrowsers === finishedBrowsers) {
    return testsComplete();
  }
  if (!browsers.length) {
    return;
  }

  var currentTest = browsers.pop();
  console.log('[' + currentTest + '] starting');
  var client = wd.promiseChainRemote();
  client.init({
    browserName: currentTest
  }).get(testUrl).setAsyncScriptTimeout(testTimeout)
    .executeAsync('var cb = arguments[arguments.length - 1];runner.on("end",function() {cb(results)});')
    .then(function (result) {
      finishedBrowsers++;
      if (!result.failed) {
        console.log('[' + currentTest + '] passed ' + result.passed + ' of ' + result.total + ' tests');
      } else {
        console.log('[' + currentTest + '] failed ' + result.failed + ' of ' + result.total + ' tests');
        return client.quit().then(function () {
          process.exit(2);
        });
      }
      results[currentTest] = result;
    }).quit()
    .then(startTest, function (e) {
      console.error(e);
      console.error('Doh, tests failed');
      client.quit();
      process.exit(3);
    });

}

startServers(function () {
  startTest();
});
