#!/usr/bin/env node
'use strict';

const playwright = require('playwright');

var querystring = require("querystring");

var MochaSpecReporter = require('mocha').reporters.Spec;

var devserver = require('./dev-server.js');

// BAIL=0 to disable bailing
var bail = process.env.BAIL !== '0';

// Playwright BrowserType whitelist.
// See: https://playwright.dev/docs/api/class-playwright
const SUPPORTED_BROWSERS = [ 'chromium', 'firefox', 'webkit' ];
const browserName = process.env.CLIENT || 'firefox';
if (!SUPPORTED_BROWSERS.includes(browserName)) {
  console.log(`
    !!! Requested browser not supported: '${browserName}'.
    !!! Available browsers: ${SUPPORTED_BROWSERS.map(b => `'${b}'`).join(', ')}
  `);
  process.exit(1);
}

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

if (process.env.INVERT) {
  qs.invert = process.env.INVERT;
}
if (process.env.GREP) {
  qs.grep = process.env.GREP;
}
if (process.env.ADAPTERS) {
  qs.adapters = process.env.ADAPTERS;
}
if (process.env.VIEW_ADAPTERS) {
  qs.viewAdapters = process.env.VIEW_ADAPTERS;
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
if (process.env.ITERATIONS) {
  qs.iterations = process.env.ITERATIONS;
}

testUrl += '?';
testUrl += querystring.stringify(qs);

class RemoteRunner {
  constructor() {
    this.handlers = {};
    this.completed = false;
    this.failed = false;
  }

  on(name, handler) {
    var handlers = this.handlers;

    if (!handlers[name]) {
      handlers[name] = [];
    }
    handlers[name].push(handler);
  }

  handleEvents(events) {
    var handlers = this.handlers;

    events.forEach((event) => {
      this.completed = this.completed || event.name === 'end';
      this.failed = this.failed || event.name === 'fail';

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
  }

  bail() {
    var handlers = this.handlers;

    handlers['end'].forEach(function (handler) {
      handler();
    });

    this.completed = true;
  }
}

function BenchmarkReporter(runner) {
  runner.on('benchmark:result', function (obj) {
    console.log('      ', obj);
  });
}

async function startTest() {

  console.log('Starting', browserName, 'on', testUrl);

  const runner = new RemoteRunner();
  new MochaSpecReporter(runner);
  new BenchmarkReporter(runner);

  const options = {
    headless: true,
  };
  const browser = await playwright[browserName].launch(options);
  const page = await browser.newPage();
  if (process.env.BROWSER_CONSOLE) {
    page.on('console', message => {
      const { url, lineNumber } = message.location();
      console.log('BROWSER', message.type().toUpperCase(), `${url}:${lineNumber}`, message.text());
    });
  }
  await page.goto(testUrl);

  const userAgent = await page.evaluate('navigator.userAgent');
  console.log('Testing on:', userAgent);

  const interval = setInterval(async () => {
    try {
      const events = await page.evaluate('window.testEvents()');
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
        await browser.close();
        process.exit(!process.env.PERF && runner.failed ? 1 : 0);
      }
    } catch (e) {
      console.error('Tests failed:', e);

      clearInterval(interval);
      await browser.close();
      process.exit(3);
    }
  }, 1000);
}

devserver.start(function () {
  startTest();
});
