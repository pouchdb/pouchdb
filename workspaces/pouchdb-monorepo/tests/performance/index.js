'use strict';

var commonUtils = require('../common-utils');

function runTestSuites(PouchDB) {
  var adapters = commonUtils.adapters();

  var reporter = require('./perf.reporter');
  reporter.startAll();
  reporter.log('Testing PouchDB version ' + PouchDB.version +
    (adapters.length > 0 ? (', using adapter(s): ' + adapters.join(', ')) : '') +
    '\n\n');

  var theAdapterUsed;
  var count = 0;
  function checkDone(adapterUsed) {
    theAdapterUsed = theAdapterUsed || adapterUsed;
    if (++count === 4) { // number of perf.xxxx.js tests
      reporter.complete(theAdapterUsed);
    }
  }

  require('./perf.basics')(PouchDB, checkDone);
  require('./perf.views')(PouchDB, checkDone);
  require('./perf.find')(PouchDB, checkDone);
  require('./perf.attachments')(PouchDB, checkDone);
}

var PouchDB = commonUtils.loadPouchDB({ plugins: ['pouchdb-find'] });

if (commonUtils.isBrowser()) {
  PouchDB.then((PouchDB) => {
    // rendering the initial view has its own costs
    // that interfere with measurements
    setTimeout(() => runTestSuites(PouchDB), 1000);
  });
} else {
  runTestSuites(PouchDB);
}
