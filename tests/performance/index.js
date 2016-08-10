
'use strict';

var opts = {};

var levelAdapter;
if (typeof process !== 'undefined' && process.env) {
  levelAdapter = process.env.LEVEL_ADAPTER;
  if (process.env.ADAPTER) {
    opts.adapter = process.env.ADAPTER;
  }
}

function runTestSuites(PouchDB) {
  var reporter = require('./perf.reporter');
  reporter.log('Testing PouchDB version ' + PouchDB.version +
    ((opts.adapter || levelAdapter) ?
      (', using adapter: ' + (opts.adapter || levelAdapter)) : '') +
    '\n\n');

  require('./perf.basics')(PouchDB, opts);
  require('./perf.views')(PouchDB, opts);
  require('./perf.attachments')(PouchDB, opts);
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
  var PouchDB = process.browser ? window.PouchDB :
    require('../../packages/node_modules/pouchdb');
  if (!process.browser) {
    // the two strings are to fool Browserify, because this test
    // fails in Node 0.11-0.12 due to sqlite3 being incompatible
    require('../../packages/node_modules/' + 'pouchdb/extras/websql');
  }
  runTestSuites(PouchDB);
}
