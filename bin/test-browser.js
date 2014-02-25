#!/usr/bin/env node
'use strict';

var path = require('path');
var spawn = require('child_process').spawn;

var request = require('request');
var wd = require('wd');
var sauceConnectLauncher = require('sauce-connect-launcher');

var devserver = require('./dev-server.js');
//var utils = require('../lib/utils.js');

var SELENIUM_PATH = '../vendor/selenium-server-standalone-2.38.0.jar';
var testUrl = 'http://127.0.0.1:8000/tests/test.html';
var testTimeout = 30 * 60 * 1000;

var username = process.env.SAUCE_USERNAME || "pouchdb";
var accessKey = process.env.SAUCE_ACCESS_KEY || "97de9ee0-2712-49f0-9b17-4b9751d79073";

var browser = process.env.CLIENT || 'firefox';
var client;

if (process.env.GREP) {
  testUrl += '?grep=' + process.env.GREP;
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

function startSelenium(callback) {

  // Start selenium
  spawn('java', ['-jar', path.resolve(__dirname, SELENIUM_PATH)], {});

  var retries = 0;
  var started = function () {

    if (++retries > 30) {
      console.error('Unable to connect to selenium');
      process.exit(1);
      return;
    }

    request('http://localhost:4444/wd/hub/status', function (err, resp) {
      if (resp && resp.statusCode === 200) {
        client = wd.promiseChainRemote();
        callback();
      } else {
        setTimeout(started, 1000);
      }
    });
  };

  started();

}

function startSauceConnect(callback) {

  var options = {
    username: username,
    accessKey: accessKey
  };

  sauceConnectLauncher(options, function (err, sauceConnectProcess) {
    client = wd.promiseChainRemote("localhost", 4445, username, accessKey);
    callback();
  });
}

function startTest() {

  console.log('Starting', browser);

  var opts = {
    browserName: browser,
    tunnelTimeout: testTimeout,
    'max-duration': 60 * 30,
    'command-timeout': 599,
    'idle-timeout': 599
  };

  client.init(opts).get(testUrl, function () {

    /* jshint evil: true */
    var interval = setInterval(function () {
      client.eval('window.results', function (err, results) {
        if (err) {
          clearInterval(interval);
          testError(err);
        } else if (results.completed) {
          clearInterval(interval);
          testComplete(results);
        } else {
          console.log('STILL RUNNING');
          console.log(results);
        }
      });
    }, 10 * 1000);
  });
}

devserver.start();

// We test firefox with local selenium server, rest with saucelabs
if (browser === 'firefox') {
  startSelenium(startTest);
} else {
  startSauceConnect(startTest);
}
