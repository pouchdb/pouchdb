'use strict';

const ALL_SUITES = [
  'basics',
  'views',
  'find',
  'attachments',
];

var commonUtils = require('../common-utils');

function runTestSuites(PouchDB) {
  var adapters = commonUtils.adapters();

  var reporter = require('./perf.reporter');
  reporter.startAll();
  reporter.log('Testing PouchDB version ' + PouchDB.version +
    (adapters.length > 0 ? (', using adapter(s): ' + adapters.join(', ')) : '') +
    '\n\n');

  const suites = (commonUtils.params().suites && commonUtils.params().suites.split(',')) || ALL_SUITES;
  if (suites.some(s => !ALL_SUITES.includes(s))) {
    throw new Error(`Unrecongnised suite(s): '${suites}'`);
  }

  var theAdapterUsed;
  var count = 0;
  function checkDone(adapterUsed) {
    theAdapterUsed = theAdapterUsed || adapterUsed;
    if (++count === suites.length) {
      reporter.complete(theAdapterUsed);
    }
  }

  if (suites.includes('basics')) { require('./perf.basics')(PouchDB, checkDone); }
  if (suites.includes('views')) { require('./perf.views')(PouchDB, checkDone); }
  if (suites.includes('find')) { require('./perf.find')(PouchDB, checkDone); }
  if (suites.includes('attachments')) { require('./perf.attachments')(PouchDB, checkDone); }
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
