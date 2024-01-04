#!/usr/bin/env node
'use strict';

const playwright = require('playwright');

const { identity, pickBy } = require('lodash');

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

const qs = {
  remote: 1,
  invert: process.env.INVERT,
  grep: process.env.GREP,
  adapters: process.env.ADAPTERS,
  viewAdapters: process.env.VIEW_ADAPTERS,
  autoCompaction: process.AUTO_COMPACTION,
  SERVER: process.env.SERVER,
  SKIP_MIGRATION: process.env.SKIP_MIGRATION,
  src: process.env.POUCHDB_SRC,
  plugins: process.env.PLUGINS,
  couchHost: process.env.COUCH_HOST,
  iterations: process.env.ITERATIONS,
};

testUrl += '?';
testUrl += new URLSearchParams(pickBy(qs, identity));

let stackConsumer;

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

        if (event.err && stackConsumer) {
          let stackMapped;
          const mappedStack = require('stacktrace-parser')
            .parse(event.err.stack)
            .map(v => {
              if (v.file === 'http://127.0.0.1:8000/packages/node_modules/pouchdb/dist/pouchdb.min.js') {
                const NON_UGLIFIED_HEADER_LENGTH = 6; // number of lines of header added in build-pouchdb.js
                const target = { line:v.lineNumber-NON_UGLIFIED_HEADER_LENGTH, column:v.column-1 };
                const mapped = stackConsumer.originalPositionFor(target);
                v.file = 'pouchdb.js';
                v.lineNumber = mapped.line;
                v.column = mapped.column+1;
                if (mapped.name !== null) {
                  v.methodName = mapped.name;
                }
                stackMapped = true;
              }
              return v;
            })
            // NodeJS stack frame format: https://nodejs.org/docs/latest/api/errors.html#errorstack
            .map(v => `at ${v.methodName} (${v.file}:${v.lineNumber}:${v.column})`)
            .join('\n          ');
          if (stackMapped) {
            console.log(`     [${obj.title}] Minified error stacktrace mapped to:
        ${event.err.name||'Error'}: ${event.err.message}
          ${mappedStack}`);
          }
        }
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

function BenchmarkConsoleReporter(runner) {
  runner.on('benchmark:result', function (obj) {
    console.log('      ', obj);
  });
}

function BenchmarkJsonReporter(runner) {
  runner.on('end', results => {
    if (runner.completed) {
      const { mkdirSync, writeFileSync } = require('fs');

      const resultsDir = 'perf-test-results';
      mkdirSync(resultsDir, { recursive: true });

      const jsonPath = `${resultsDir}/${new Date().toISOString()}.json`;
      writeFileSync(jsonPath, JSON.stringify(results, null, 2));
      console.log('Wrote JSON results to:', jsonPath);
    } else {
      console.log('Runner failed; JSON will not be writted.');
    }
  });
}

async function startTest() {
  if (qs.src === '../../packages/node_modules/pouchdb/dist/pouchdb.min.js') {
    const mapPath = './packages/node_modules/pouchdb/dist/pouchdb.min.js.map';
    const { readFileSync } = require('fs');
    const rawMap = readFileSync(mapPath, { encoding:'utf8' });
    const jsonMap = JSON.parse(rawMap);
    const { SourceMapConsumer } = require('source-map');
    stackConsumer = await new SourceMapConsumer(jsonMap);
  }

  console.log('Starting', browserName, 'on', testUrl);

  const runner = new RemoteRunner();
  new MochaSpecReporter(runner);
  new BenchmarkConsoleReporter(runner);

  if (process.env.JSON_REPORTER) {
    if (!process.env.PERF) {
      console.log('!!! JSON_REPORTER should only be set if PERF is also set.');
      process.exit(1);
    }
    new BenchmarkJsonReporter(runner);
  }

  const options = {
    headless: true,
  };
  const browser = await playwright[browserName].launch(options);
  const page = await browser.newPage();

  page.on('pageerror', err => {
    console.log('Unhandled error in test page:', err);
    process.exit(1);
  });

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
