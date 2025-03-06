#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const playwright = require('playwright');
const { identity, pickBy } = require('lodash');
const { SourceMapConsumer } = require('source-map');
const stacktraceParser = require('stacktrace-parser');

var MochaSpecReporter = require('mocha').reporters.Spec;
const createMochaStatsCollector = require('mocha/lib/stats-collector');

// BAIL=0 to disable bailing
var bail = process.env.BAIL !== '0';

// Track if the browser has closed at the request of this script, or due to an external event.
let closeRequested;

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
if (process.env.TYPE === 'performance') {
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
  srcRoot: process.env.SRC_ROOT,
  src: process.env.POUCHDB_SRC,
  useMinified: process.env.USE_MINIFIED,
  plugins: process.env.PLUGINS,
  couchHost: process.env.COUCH_HOST,
  iterations: process.env.ITERATIONS,
};

testUrl += '?';
testUrl += new URLSearchParams(pickBy(qs, identity));

let stackConsumer;

class ArrayMap extends Map {
  get(key) {
    if (!this.has(key)) {
      this.set(key, []);
    }
    return super.get(key);
  }
}

class RemoteRunner {
  constructor(browser) {
    this.failed = false;
    this.browser = browser;
    this.handlers = new ArrayMap();
    this.onceHandlers = new ArrayMap();
    this.handleEvent = this.handleEvent.bind(this);
    createMochaStatsCollector(this);
  }

  once(name, handler) {
    this.onceHandlers.get(name).push(handler);
  }

  on(name, handler) {
    this.handlers.get(name).push(handler);
  }

  triggerHandlers(eventName, handlerArgs) {
    const triggerHandler = handler => handler.apply(null, handlerArgs);

    this.onceHandlers.get(eventName).forEach(triggerHandler);
    this.onceHandlers.delete(eventName);

    this.handlers.get(eventName).forEach(triggerHandler);
  }

  async handleEvent(event) {
    try {
      var additionalProps = ['pass', 'fail', 'pending'].indexOf(event.name) === -1 ? {} : {
        slow: event.obj.slow ? function () { return event.obj.slow; } : function () { return 60; },
        fullTitle: event.obj.fullTitle ? function () { return event.obj.fullTitle; } : undefined,
        titlePath: event.obj.titlePath ? function () { return event.obj.titlePath; } : undefined,
      };
      var obj = Object.assign({}, event.obj, additionalProps);

      this.triggerHandlers(event.name, [ obj, event.err ]);

      if (event.err && stackConsumer) {
        let stackMapped;
        const mappedStack = stacktraceParser
          .parse(event.err.stack)
          .map(v => {
            if (v.file === 'http://127.0.0.1:8000/packages/node_modules/pouchdb/dist/pouchdb.min.js') {
              const NON_UGLIFIED_HEADER_LENGTH = 6; // number of lines of header added in build-pouchdb.js
              const target = { line:v.lineNumber-NON_UGLIFIED_HEADER_LENGTH, column:v.column-1 };
              const mapped = stackConsumer.originalPositionFor(target);
              v.file = 'packages/node_modules/pouchdb/dist/pouchdb.js';
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
          console.log(`      [${obj.title}] Minified error stacktrace mapped to:`);
          console.log(`        ${event.err.name||'Error'}: ${event.err.message}`);
          console.log(`          ${mappedStack}`);
        }
      }

      switch (event.name) {
        case 'fail': this.handleFailed(); break;
        case 'end': this.handleEnd(); break;
      }
    } catch (e) {
      console.error('Tests failed:', e);

      closeRequested = true;
      await this.browser.close();
      process.exit(3);
    }
  }

  async handleEnd() {
    closeRequested = true;
    await this.browser.close();
    process.exit(this.failed ? 1 : 0);
  }

  handleFailed() {
    this.failed = true;
    if (bail) {
      try {
        this.triggerHandlers('end');
      } catch (e) {
        console.log('An error occurred while bailing:', e);
      } finally {
        this.handleEnd();
      }
    }
  }
}

function BenchmarkConsoleReporter(runner) {
  runner.on('benchmark:result', function (obj) {
    console.log('      ', obj);
  });
}

function BenchmarkJsonReporter(runner) {
  runner.on('end', results => {
    if (runner.failed) {
      console.log('Runner failed; JSON will not be writted.');
    } else {
      results.srcRoot = process.env.SRC_ROOT;

      const resultsDir = 'perf-test-results';
      fs.mkdirSync(resultsDir, { recursive: true });

      const jsonPath = `${resultsDir}/${new Date().toISOString()}.json`;
      fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
      console.log('Wrote JSON results to:', jsonPath);
    }
  });
}

async function startTest() {
  if (qs.src === '../../packages/node_modules/pouchdb/dist/pouchdb.min.js') {
    const mapPath = './packages/node_modules/pouchdb/dist/pouchdb.min.js.map';
    const rawMap = fs.readFileSync(mapPath, { encoding:'utf8' });
    const jsonMap = JSON.parse(rawMap);
    stackConsumer = await new SourceMapConsumer(jsonMap);
  }

  try {
    console.log('Starting', browserName, 'on', testUrl);

    const options = {
      headless: true,
    };
    const browser = await playwright[browserName].launch(options);

    const runner = new RemoteRunner(browser);
    new MochaSpecReporter(runner);
    new BenchmarkConsoleReporter(runner);

    if (process.env.JSON_REPORTER) {
      if (process.env.TYPE !== 'performance') {
        console.log('!!! JSON_REPORTER should only be set if TYPE is set to "performance".');
        process.exit(1);
      }
      new BenchmarkJsonReporter(runner);
    }

    // Workaround: create a BrowserContext to handle init scripts.  In Chromium in
    // Playwright v1.39.0, v1.40.1 and v1.41.1, page.addInitScript() did not appear to work.
    const ctx = await browser.newContext();

    // Playwright's Browser.on('close') event handler would be the more obvious
    // choice here, but it does not seem to be triggered if the browser is closed
    // by an external event (e.g. process is killed, user closes non-headless
    // browser window).
    ctx.on('close', () => {
      if (!closeRequested) {
        console.log('!!! Browser closed by external event.');
        process.exit(1);
      }
    });

    ctx.exposeFunction('handleMochaEvent', runner.handleEvent);
    ctx.addInitScript(() => {
      window.addEventListener('message', (e) => {
        if (e.data.type === 'mocha') {
          window.handleMochaEvent(e.data.details);
        }
      });
    });

    ctx.on('pageerror', err => {
      if (browserName === 'webkit' && err.toString()
          .match(/^Fetch API cannot load http.* due to access control checks.$/)) {
        // This is an _uncatchable_, error seen in playwright v1.36.1 webkit. If
        // it is ignored, fetch() will also throw a _catchable_:
        // `TypeError: Load failed`
        console.log('Ignoring error:', err);
        return;
      }

      console.log('Unhandled error in test page:', err);
      console.log('  stack:', err.stack);
      console.log('  cause:', err.cause);
      process.exit(1);
    });

    ctx.on('console', message => {
      console.log(message.text());
    });

    const page = await ctx.newPage();
    await page.goto(testUrl);

    const userAgent = await page.evaluate('navigator.userAgent');
    console.log('Testing on:', userAgent);
  } catch (err) {
    console.log('Error starting tests:', err);
    process.exit(1);
  }
}

if (process.env.MANUAL_DEV_SERVER) {
  startTest();
} else {
  // dev-server.js rebuilds bundles when required
  const devserver = require('./dev-server.js');
  devserver.start(startTest);
}
