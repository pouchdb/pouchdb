/*jshint node:true */

"use strict";

var soda = require('soda');
var assert = require('assert');
var nano = require('nano');

var couch = nano('http://127.0.0.1:5984');
var couch_proxy = nano('http://127.0.0.1:2020');

var result_host = 'http://reupholster.iriscouch.com';

var url = 'http://127.0.0.1:8000/tests/test.html?test=release-min';

var browser = soda.createSauceClient({
  'url': 'http://saucelabs.com/',
  'username': 'pouchdb',
  'access-key': '97de9ee0-2712-49f0-9b17-4b9751d79073',
  'os': 'Windows 2003',
  'browser': 'googlechrome',
  'browser-version': '',
  'name': 'Pouch-Chrome/Win2003'
});

function replicate_test_results(sauce_details, couch, callback) {
  var db = couch.db.use('test_suite_db110');
  db.list({include_docs: true}, function(err, res){
    if (err) {
      return callback('could not find stored results');
    }
    if (!res || !res.rows || res.rows.length === 0 || !res.rows[0].doc) {
      return callback('No stored results');
    }
    var doc = res.rows[0].doc;
    doc.sauce = sauce_details;
    var failed = false;
    if (!doc.report || !doc.report.results || doc.report.results.failed > 0) {
      failed = true;
    }
    db.insert(doc, doc._id, function(err){
      if (err) {
        callback('could not store test results');
      }
      var results_url = result_host + '/pouch_tests';
      couch.db.replicate('test_suite_db110', results_url, function(err) {
        callback(err, doc);
      });
    });
  });
}

function setTestPassed(browser, pass, callback) {
  var result = 'sauce:job-info={"passed": ' + pass + ', "public" : true  }';
  browser.setContext(result, callback);
}

function closeTest(browser, callback) {
  browser.testComplete(callback);
}

process.on('uncaughtException', function(err) {
  console.log('Tests failed with an uncaught exception: ' + err);
  process.exit(1);
});

browser.on('command', function(cmd, args) {
  console.log(' \x1b[33m%s\x1b[0m: %s', cmd, args.join(', '));
});

if (process.argv[2]) {
  var git_hash = process.argv[2];
  url += '#' + git_hash;
}

console.log('Starting browser');
browser
  .chain
  .session()
  .open(url)
  .setTimeout(1000000)
  .waitForTextPresent('Tests completed in')
  .waitForTextPresent('Storing Results Complete.')
  .end(function(err) {
    this.queue = null;
    var sauce_details = {
      jobUrl: this.jobUrl,
      videoUrl: this.videoUrl,
      logUrl: this.logUrl
    };

    replicate_test_results(sauce_details, couch, function(err, doc) {
      var passed = true;
      if (err || doc.report.results.failed > 0) {
        passed = false;
      }
      console.log('Testing Passes: ' + passed);
      if (doc.report && doc.report.results) {
        console.log(doc.report.results.failed + ' failed');
        console.log(doc.report.results.passed + ' passed');
      }
      if (doc && doc._id) {
        var result_url = result_host + '/_utils/document.html?pouch_tests/' +
          doc._id;
        console.log('Test details can be found at :\t' + result_url);
      }
      console.log('Saucelabs run can be found at:\t' + sauce_details.jobUrl);
      setTestPassed(browser, passed, function(err) {
        closeTest(browser, function(err2) {
          if (!passed || err || err2) {
            return process.exit(1);
          }
        });
      });
    });
  });