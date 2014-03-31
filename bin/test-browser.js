#!/usr/bin/env node
'use strict';

var path = require('path');
var spawn = require('child_process').spawn;

var request = require('request');
var wd = require('wd');
var sauceConnectLauncher = require('sauce-connect-launcher');
var querystring = require("querystring");
var devserver = require('./dev-server.js');

var SELENIUM_PATH = '../vendor/selenium-server-standalone-2.38.0.jar';
var SELENIUM_HUB = 'http://localhost:4444/wd/hub/status';
var testUrl = 'http://127.0.0.1:8000/tests/test.html';
var testTimeout = 30 * 60 * 1000;

var username = process.env.SAUCE_USERNAME;
var accessKey = process.env.SAUCE_ACCESS_KEY;
var browser = process.env.CLIENT || 'firefox';
var client;
var qs = {};
if (process.env.GREP) {
  qs.grep = process.env.GREP;
}
if (process.env.NATIVEPROMISE) {
  qs.noBluebird = 1;
}
if (process.env.LEVEL_BACKEND) {
  qs.sourceFile = "pouchdb-" + process.env.LEVEL_BACKEND + ".js";
}
testUrl += '?';
testUrl += querystring.stringify(qs);

if ((process.env.TRAVIS && browser !== 'firefox') &&
    !process.env.TRAVIS_SECURE_ENV_VARS) {
  console.error('Not running test, cannot connect to saucelabs');
  process.exit(0);
}

function testError(e) {
  console.error(e);
  console.error('Doh, tests failed');
  client.quit();
  process.exit(3);
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

    request(SELENIUM_HUB, function (err, resp) {
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
          console.log('=> ', results);
        }
      });
    }, 10 * 1000);
  });
}

devserver.start();

if (process.env.TRAVIS && browser !== 'firefox') {
  startSauceConnect(startTest);
} else {
  startSelenium(startTest);
}
