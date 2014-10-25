"use strict";

var wd = require("wd");
var chai = require("chai");
var chaiAsPromised = require("chai-as-promised");
var path = require('path');

chai.use(chaiAsPromised);
chai.should();
chaiAsPromised.transferPromiseness = wd.transferPromiseness;

// BAIL=0 to disable bailing
var bail = process.env.BAIL !== '0';

var app = path.resolve(
  "./tests/integration/cordova/platforms/android/ant-build/" +
  "PouchDBTestRunner-debug-unaligned.apk");

var desired = {
  "appium-version": "1.0",
  platformName: "Android",
  deviceName: "foobar",
  app: app,
  "app-package": "com.pouchdb.tests",
  "app-activity": "PouchDBTestRunner"
};

var browser = wd.promiseChainRemote("0.0.0.0", 4723);

function testError(driver, e) {
  console.error(e);
  console.error('Doh, tests failed');
  driver.quit();
  process.exit(3);
}

function testDone(result) {
  process.exit(result.failed ? 1 : 0);
}

function testComplete(driver, result) {
  console.log(result);

  driver.quit().then(function () {
    testDone(result);
  });

}

var driver = browser.init(desired)
  .setImplicitWaitTimeout(30000);

driver
  .sleep(10000)
  .contexts()
  .then(function (ctxs) {
    console.log(ctxs);
    var newContext = ctxs.filter(function (ctx) {
      return /WEBVIEW.*pouchdb/.test(ctx);
    })[0];
    return driver.context(newContext);
  }).then(function () {
    var interval = setInterval(function () {
      /* jshint evil:true */
      driver.eval('window.results', function (err, results) {
        if (err) {
          clearInterval(interval);
          testError(driver, err);
        } else if (results.completed || (results.failures.length && bail)) {
          clearInterval(interval);
          testComplete(driver, results);
        } else {
          console.log('=> ', results);
        }
      });
    }, 10 * 1000);
  });