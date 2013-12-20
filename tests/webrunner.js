"use strict";

// use query parameter testFiles if present,
// eg: test.html?testFiles=test.basics.js
var testFiles = window.location.search.match(/[?&]testFiles=([^&]+)/);
testFiles = testFiles && testFiles[1].split(',') || [];
var started = new Date();
if (!testFiles.length) {
  testFiles = [
    'test.setup.js',
    'test.basics.js', 'test.all_dbs.js', 'test.changes.js',
    'test.bulk_docs.js', 'test.all_docs.js', 'test.conflicts.js',
    'test.revs_diff.js',
    'test.replication.js', 'test.views.js', 'test.taskqueue.js',
    'test.design_docs.js', 'test.issue221.js', 'test.http.js',
    'test.compaction.js', 'test.get.js',
    'test.attachments.js', 'test.uuids.js', 'test.slash_id.js',
    'test.worker.js'
  ];
}

testFiles.unshift('test.utils.js');

// The tests use Pouch.extend and Pouch.ajax directly (for now)
var sourceFiles = [
  '../dist/pouchdb-nightly.js'
];

// Thanks to http://engineeredweb.com/blog/simple-async-javascript-loader/
function asyncLoadScript(url, callback) {

  // Create a new script and setup the basics.
  var script = document.createElement("script"),
  firstScript = document.getElementsByTagName('script')[0];

  script.async = true;
  script.src = url;

  // Handle the case where an optional callback was passed in.
  if ( "function" === typeof(callback) ) {
    script.onload = function() {
      callback();

      // Clear it out to avoid getting called more than once or any memory leaks.
      script.onload = script.onreadystatechange = undefined;
    };
    script.onreadystatechange = function() {
      if ( "loaded" === script.readyState || "complete" === script.readyState ) {
        script.onload();
      }
    };
  }

  // Attach the script tag to the page (before the first script) so the
  //magic can happen.
  firstScript.parentNode.insertBefore(script, firstScript);
}

function startQUnit() {
  QUnit.config.reorder = false;
}

function asyncParForEach(array, fn, callback) {
  if (array.length === 0) {
    callback(); // done immediately
    return;
  }
  var toLoad = array.shift();
  fn(toLoad, function() {
    asyncParForEach(array, fn, callback);
  });
}

QUnit.config.testTimeout = 60000;

QUnit.jUnitReport = function(report) {
  document.body.classList.add('testsComplete');
  report.started = started;
  report.completed = new Date();
  report.passed = (report.results.failed === 0);
  delete report.xml;
  window.testReport = report;
};

asyncParForEach(sourceFiles, asyncLoadScript, function() {
  asyncParForEach(testFiles, asyncLoadScript, function() {
    startQUnit();
  });
});
