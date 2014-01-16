#!/usr/bin/env node

var path = require('path');
var spawn = require('child_process').spawn;

var wd = require('wd');
var devserver = require('./dev-server.js');

var SELENIUM_PATH = '../node_modules/.bin/start-selenium';
var testUrl = 'http://127.0.0.1:8000/tests/test.html';
var testTimeout = 2 * 60 * 1000;
var testSelector = 'body.testsComplete';

var currentTest = '';
var results = {};
var client = {};

var browsers = [
  'firefox'
  // Temporarily disable safari until it is fixed (#1068)
  // 'safari',
  //'chrome'
];

// Travis only has firefox
if (!process.env.TRAVIS) {
  browsers.push('chrome');
}
var numBrowsers = browsers.length;
var finishedBrowsers = 0;
function startServers(callback) {

  // Starts the file and CORS proxy
  devserver.start();

  // Start selenium
  var selenium = spawn(path.resolve(__dirname, SELENIUM_PATH));

  selenium.stdout.on('data', function(data) {
    if (/Started org.openqa.jetty.jetty/.test(data)) {
      callback();
    }
  });
}

function testsComplete() {
  var passed = Object.keys(results).length && Object.keys(results).every(function(x) {
    return !results[x].failed;
  });

  if (passed) {
    console.log('Woot, all '+Object.keys(results).length+' tests passed');
    process.exit(0);
  } else {
    console.error('we ran '+Object.keys(results).length+' tests and at least one failed');
    process.exit(1);
  }
}


function startTest() {
  if (numBrowsers === finishedBrowsers) {
    return testsComplete();
  }
  if(!browsers.length){
    return;
  }

  var currentTest = browsers.pop();
  console.log('[' + currentTest + '] starting');
  var client = wd.promiseChainRemote();
  client.init({
    browserName: currentTest
  }).get(testUrl).setAsyncScriptTimeout(testTimeout)
    .executeAsync('var cb = arguments[arguments.length - 1];console.log("injected");QUnit.done(function( report ) {cb(report)});')
    .then(function (result) {
      finishedBrowsers++;
      console.log(result);
      if(!result.failed){
        console.log('[' + currentTest + '] passed');
      }else{
        console.log('[' + currentTest + '] failed');
        client.quit();
        process.exit(2);
        return;
      }
      results[currentTest] = result;
    }).quit()
    .then(startTest,function(e){
      console.error(e);
      console.error('Doh, tests failed');
      client.quit();
      process.exit(3);
    });

}

startServers(function() {
  startTest();
});
