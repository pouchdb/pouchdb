#!/usr/bin/env node
'use strict';

var path = require('path');
var spawn = require('child_process').spawn;

var wd = require('wd');
var sauceConnectLauncher = require('sauce-connect-launcher');
var querystring = require("querystring");
var request = require('request').defaults({json: true});

var devserver = require('./dev-server.js');

var SELENIUM_PATH = '../vendor/selenium-server-standalone-2.38.0.jar';
var SELENIUM_HUB = 'http://localhost:4444/wd/hub/status';

var testTimeout = 30 * 60 * 1000;

var username = process.env.SAUCE_USERNAME;
var accessKey = process.env.SAUCE_ACCESS_KEY;

// process.env.CLIENT is a colon seperated list of
// (saucelabs|selenium):browserName:browserVerion:platform
var tmp = (process.env.CLIENT || 'selenium:firefox').split(':');
var client = {
  runner: tmp[0] || 'selenium',
  browser: tmp[1] || 'firefox',
  version: tmp[2] || null, // Latest
  platform: tmp[3] || null
};

var testRoot = 'http://127.0.0.1:8000/tests/';
var testUrl = testRoot +
  (process.env.PERF ? 'performance/test.html' : 'test.html');
var qs = {};

var sauceClient;
var sauceConnectProcess;
var tunnelId = process.env.TRAVIS_JOB_NUMBER || 'tunnel-' + Date.now();

if (client.runner === 'saucelabs') {
  qs.saucelabs = true;
}
if (process.env.GREP) {
  qs.grep = process.env.GREP;
}
if (process.env.ADAPTERS) {
  qs.adapters = process.env.ADAPTERS;
}
if (process.env.ES5_SHIM || process.env.ES5_SHIMS) {
  qs.es5shim = true;
}
testUrl += '?';
testUrl += querystring.stringify(qs);

if (process.env.TRAVIS &&
    client.browser !== 'firefox' &&
    process.env.TRAVIS_SECURE_ENV_VARS === 'false') {
  console.error('Not running test, cannot connect to saucelabs');
  process.exit(0);
  return;
}

function testError(e) {
  console.error(e);
  console.error('Doh, tests failed');
  sauceClient.quit();
  process.exit(3);
}

function postResult(result) {
  if (process.env.PERF && process.env.DASHBOARD_HOST) {
    result.branch = process.env.TRAVIS_BRANCH || process.env.BRANCH || false;
    result.commit = process.env.TRAVIS_COMMIT || process.env.COMMIT || false;
    result.pull_request = process.env.TRAVIS_PULL_REQUEST;
    var commits = 'https://api.github.com/repos/pouchdb/pouchdb/git/commits/';
    request({
      method: 'GET',
      uri: commits + result.commit,
      headers: {'User-Agent': 'request'}
    }, function (error, response, body) {
      result._id = result.date = body.committer.date;
      request({
        method: 'POST',
        uri: process.env.DASHBOARD_HOST + '/performance_results',
        json: result
      }, function (error, response, body) {
        console.log(result);
        process.exit(!!error);
      });
    });
    return;
  }
  process.exit(!process.env.PERF && result.failed ? 1 : 0);
}

function testComplete(result) {
  console.log(result);

  sauceClient.quit().then(function () {
    if (sauceConnectProcess) {
      sauceConnectProcess.close(function () {
        postResult(result);
      });
    } else {
      postResult(result);
    }
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
        sauceClient = wd.promiseChainRemote();
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
    accessKey: accessKey,
    tunnelIdentifier: tunnelId
  };

  sauceConnectLauncher(options, function (err, process) {
    if (err) {
      console.error('Failed to connect to saucelabs');
      console.error(err);
      return process.exit(1);
    }
    sauceConnectProcess = process;
    sauceClient = wd.promiseChainRemote("localhost", 4445, username, accessKey);
    callback();
  });
}

function startTest() {

  console.log('Starting', client);

  var opts = {
    browserName: client.browser,
    version: client.version,
    platform: client.platform,
    tunnelTimeout: testTimeout,
    name: client.browser + ' - ' + tunnelId,
    'max-duration': 60 * 30,
    'command-timeout': 599,
    'idle-timeout': 599,
    'tunnel-identifier': tunnelId
  };

  sauceClient.init(opts).get(testUrl, function () {

    /* jshint evil: true */
    var interval = setInterval(function () {
      sauceClient.eval('window.results', function (err, results) {
        if (err) {
          clearInterval(interval);
          testError(err);
        } else if (results.completed || results.failures.length) {
          clearInterval(interval);
          testComplete(results);
        } else {
          console.log('=> ', results);
        }
      });
    }, 10 * 1000);
  });
}

devserver.start(function () {
  if (client.runner === 'saucelabs') {
    startSauceConnect(startTest);
  } else {
    startSelenium(startTest);
  }
});