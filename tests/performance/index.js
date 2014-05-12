
'use strict';

var opts = {};

function runTestSuites(PouchDB) {
  var reporter = require('./perf.reporter');
  reporter.log('Testing PouchDB version ' + PouchDB.version +
    (opts.adapter ? (', using adapter: ' + opts.adapter) : '') +
    '\n\n');

  require('./perf.basics')(PouchDB, opts);
  require('./perf.views')(PouchDB, opts);
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
    global.document.getElementsByTagName('body')[0].appendChild(script);

    var timeoutId = setInterval(function () {
      if (global.window.PouchDB) {
        clearInterval(timeoutId);
        runTestSuites(global.window.PouchDB);
      }
    }, 100);
    startNow = false;
  }
}
if (startNow) {
  var PouchDB = process.browser ? window.PouchDB : require('../..');
  runTestSuites(PouchDB);
}