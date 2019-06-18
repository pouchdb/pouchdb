#!/usr/bin/env node
'use strict';

var wd = require('wd');
wd.configureHttp({timeout: 180000}); // 3 minutes

var sauceConnectLauncher = require('sauce-connect-launcher');
var selenium = require('selenium-standalone');
var querystring = require("querystring");

var MochaSpecReporter = require('mocha').reporters.Spec;

var devserver = require('./dev-server.js');

var testTimeout = 30 * 60 * 1000;

var username = process.env.SAUCE_USERNAME;
var accessKey = process.env.SAUCE_ACCESS_KEY;

var SELENIUM_VERSION = process.env.SELENIUM_VERSION || '3.141.0';
var CHROME_BIN = process.env.CHROME_BIN;
var FIREFOX_BIN = process.env.FIREFOX_BIN;

// BAIL=0 to disable bailing
var bail = process.env.BAIL !== '0';

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
var testUrl;
if (process.env.PERF) {
  testUrl = testRoot + 'performance/index.html';
} else if (process.env.TYPE === 'fuzzy') {
  testUrl = testRoot + 'fuzzy/index.html';
} else if (process.env.TYPE === 'mapreduce') {
  testUrl = testRoot + 'mapreduce/index.html';
} else if (process.env.TYPE === 'find') {
  testUrl = testRoot + 'find/index.html';
} else {
  testUrl = testRoot + 'integration/index.html';
}

var qs = { remote: 1 };

var sauceClient;
var sauceConnectProcess;
var tunnelId = process.env.TRAVIS_JOB_NUMBER || 'tunnel-' + Date.now();

if (client.runner === 'saucelabs') {
  qs.saucelabs = true;
}
if (process.env.INVERT) {
  qs.invert = process.env.INVERT;
}
if (process.env.GREP) {
  qs.grep = process.env.GREP;
}
if (process.env.ADAPTERS) {
  qs.adapters = process.env.ADAPTERS;
}
if (process.env.AUTO_COMPACTION) {
  qs.autoCompaction = true;
}
if (process.env.SERVER) {
  qs.SERVER = process.env.SERVER;
}
if (process.env.SKIP_MIGRATION) {
  qs.SKIP_MIGRATION = process.env.SKIP_MIGRATION;
}
if (process.env.POUCHDB_SRC) {
  qs.src = process.env.POUCHDB_SRC;
}
if (process.env.PLUGINS) {
  qs.plugins = process.env.PLUGINS;
}
if (process.env.COUCH_HOST) {
  qs.couchHost = process.env.COUCH_HOST;
}
if (process.env.ADAPTER) {
  qs.adapter = process.env.ADAPTER;
}
if (process.env.ITERATIONS) {
  qs.iterations = process.env.ITERATIONS;
}

testUrl += '?';
testUrl += querystring.stringify(qs);

function testError(e) {
  console.error(e);
  console.error('Doh, tests failed');

  closeClient(function () {
    process.exit(3);
  });
}

function startSelenium(callback) {
  // Start selenium
  var opts = {version: SELENIUM_VERSION};
  selenium.install(opts, function (err) {
    if (err) {
      console.error('Failed to install selenium');
      process.exit(1);
    }
    selenium.start(opts, function () {
      sauceClient = wd.promiseChainRemote();
      callback();
    });
  });
}

function startSauceConnect(callback) {

  var options = {
    username: username,
    accessKey: accessKey,
    tunnelIdentifier: tunnelId
  };

  sauceConnectLauncher(options, function (err, sauceProcess) {
    if (err) {
      console.error('Failed to connect to saucelabs');
      console.error(err);
      return process.exit(1);
    }
    sauceConnectProcess = sauceProcess;
    sauceClient = wd.promiseChainRemote("localhost", 4445, username, accessKey);
    callback();
  });
}

function closeClient(callback) {
  sauceClient.quit().then(function () {
    if (sauceConnectProcess) {
      sauceConnectProcess.close(function () {
        callback();
      });
    } else {
      callback();
    }
  });
}

function RemoteRunner() {
  this.handlers = {};
  this.completed = false;
  this.failed = false;
}

RemoteRunner.prototype.on = function (name, handler) {
  var handlers = this.handlers;

  if (!handlers[name]) {
    handlers[name] = [];
  }
  handlers[name].push(handler);
};

RemoteRunner.prototype.handleEvents = function (events) {
  var self = this;
  var handlers = this.handlers;

  events.forEach(function (event) {
    self.completed = self.completed || event.name === 'end';
    self.failed = self.failed || event.name === 'fail';

    var additionalProps = ['pass', 'fail', 'pending'].indexOf(event.name) === -1 ? {} : {
      slow: event.obj.slow ? function () { return event.obj.slow; } : function () { return 60; },
      fullTitle: event.obj.fullTitle ? function () { return event.obj.fullTitle; } : undefined
    };
    var obj = Object.assign({}, event.obj, additionalProps);

    handlers[event.name].forEach(function (handler) {
      handler(obj, event.err);
    });

    if (event.logs && event.logs.length > 0) {
      event.logs.forEach(function (line) {
        if (line.type === 'log') {
          console.log(line.content);
        } else if (line.type === 'error') {
          console.error(line.content);
        } else {
          console.error('Invalid log line', line);
        }
      });
      console.log();
    }
  });
};

RemoteRunner.prototype.bail = function () {
  var handlers = this.handlers;

  handlers['end'].forEach(function (handler) {
    handler();
  });

  this.completed = true;
};

function BenchmarkReporter(runner) {
  runner.on('benchmark:result', function (obj) {
    console.log('      ', obj);
  });
}

function startTest() {

  console.log('Starting', client, 'on', testUrl);

  var opts = {
    browserName: client.browser,
    version: client.version,
    platform: client.platform,
    tunnelTimeout: testTimeout,
    name: client.browser + ' - ' + tunnelId,
    'max-duration': 60 * 45,
    'command-timeout': 599,
    'idle-timeout': 599,
    'tunnel-identifier': tunnelId
  };
  if (CHROME_BIN) {
    opts.chromeOptions = {
      binary: CHROME_BIN,
      args: ['--headless', '--disable-gpu', '--no-sandbox', '--disable-setuid-sandbox']
    };
  }
  if (FIREFOX_BIN) {
    opts.firefox_binary = FIREFOX_BIN;
  }

  var runner = new RemoteRunner();
  new MochaSpecReporter(runner);
  new BenchmarkReporter(runner);

  sauceClient.init(opts, function () {
    console.log('Initialized');

    sauceClient.get(testUrl, function () {
      console.log('Successfully started');

      sauceClient.eval('navigator.userAgent', function (err, userAgent) {
        if (err) {
          testError(err);
        } else {
          console.log('Testing on:', userAgent);

          /* jshint evil: true */
          var interval = setInterval(function () {
            sauceClient.eval('window.testEvents()', function (err, events) {
                if (err) {
                  clearInterval(interval);
                  testError(err);
                } else if (events) {
                  runner.handleEvents(events);

                  if (runner.completed || (runner.failed && bail)) {
                    if (!runner.completed && runner.failed) {
                      try {
                        runner.bail();
                      } catch (e) {
                        // Temporary debugging of bailing failure
                        console.log('An error occurred while bailing:');
                        console.log(e);
                      }
                    }

                    clearInterval(interval);

                    closeClient(function () {
                      process.exit(!process.env.PERF && runner.failed ? 1 : 0);
                    });
                  }
                }
            });
          }, 10 * 1000);

        }
      });
    });
  });
}

devserver.start(function () {
  if (client.runner === 'saucelabs') {
    startSauceConnect(startTest);
  } else {
    startSelenium(startTest);
  }
});
