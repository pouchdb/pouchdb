
'use strict';

var opts = {};

if (typeof process !== 'undefined' && process.env) {
  if (process.env.ADAPTER) {
    opts.adapter = process.env.ADAPTER;
  }
}

function runTestSuites(PouchDB) {

  function runTestsNow() {
    var reporter = require('./perf.reporter');
    reporter.startAll();
    reporter.log('Testing PouchDB version ' + PouchDB.version +
      (opts.adapter ?
        (', using adapter: ' + opts.adapter) : '') +
      '\n\n');

    var theAdapterUsed;
    var count = 0;
    function checkDone(adapterUsed) {
      theAdapterUsed = theAdapterUsed || adapterUsed;
      if (++count === 4) { // number of perf.xxxx.js tests
        reporter.complete(theAdapterUsed);
      }
    }

    require('./perf.basics')(PouchDB, opts, checkDone);
    require('./perf.views')(PouchDB, opts, checkDone);
    require('./perf.find')(PouchDB, opts, checkDone);
    require('./perf.attachments')(PouchDB, opts, checkDone);
  }

  if (typeof process === 'undefined' || process.browser) {
    // rendering the initial view has its own costs
    // that interfere with measurements
    setTimeout(runTestsNow, 1000);
  } else {
    runTestsNow();
  }
}
var startNow = true;
if (global.window && global.window.location && global.window.location.search) {

  var fragment = global.window.location.search.replace(/^\??/, '').split('&');
  var params = {};
  fragment.forEach(function (param) {
    var keyValue = param.split('=');
    params[keyValue[0]] = decodeURIComponent(keyValue[1]);
  });

  if ('adapter' in params) {
    opts.adapter = params.adapter;
  }

  if ('src' in params) {

    var script = global.document.createElement('script');
    script.src = params.src;
    script.onreadystatechange = function () {
      if ("loaded" === script.readyState || "complete" === script.readyState) {
        runTestSuites(global.window.PouchDB);
      }
    };

    global.document.getElementsByTagName('body')[0].appendChild(script);
    startNow = false;
  }
}
if (startNow) {
  var PouchDB;
  if (process.browser) {
    PouchDB = window.PouchDB;
  } else {
    PouchDB = require('../../packages/node_modules/pouchdb');
    PouchDB.plugin(require('../../packages/node_modules/' +
      'pouchdb-find'));
  }
  if (!process.browser) {
    PouchDB.plugin(require('../../packages/node_modules/' +
      'pouchdb-adapter-memory'));
  }
  runTestSuites(PouchDB);
}
