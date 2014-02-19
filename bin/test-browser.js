#!/usr/bin/env node
"use strict";

var path = require('path');
var spawn = require('child_process').spawn;

var wd = require('wd');
var devserver = require('./dev-server.js');

var SELENIUM_PATH = '../vendor/selenium-server-standalone-2.38.0.jar';
var testUrl = 'http://127.0.0.1:8000/tests/test.html';
var testTimeout = 30 * 60 * 1000;

var client;

if (process.env.GREP) {
  testUrl += '?grep=' + process.env.GREP;
}

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

function testError(e) {
  console.error(e);
  console.error('Doh, tests failed');
  client.quit().then(function () {
    process.exit(3);
  });
}

function testComplete(result) {

  var total = result.passed + result.failed;

  if (result.failed) {
    console.log('failed ' + result.failed + ' of ' + total + ' tests');
    console.log(JSON.stringify(result.failures, false, 4));
  } else {
    console.log('passed ' + result.passed + ' of ' + total + ' tests');
  }

  client.quit().then(function () {
    process.exit(result.failed ? 1 : 0);
  });

}

function startTest() {

  var browser = process.env.BROWSER || 'firefox';
  console.log('Starting', browser);

  var script =
    'var cb = arguments[arguments.length - 1];' +
    'console.log("GONNA START WAITING");' +
    'runner.on("end", function() { console.log("TESTS ENDED"); cb(results); });';

  client = wd.promiseChainRemote();
  client
    .init({browserName: browser})
    .get(testUrl)
    .setAsyncScriptTimeout(testTimeout)
    .executeAsync(script)
    .then(testComplete, testError);
}

startServers(function () {
  startTest();
});
