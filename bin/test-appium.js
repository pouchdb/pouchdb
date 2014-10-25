"use strict";

var wd = require("wd");
var chai = require("chai");
var chaiAsPromised = require("chai-as-promised");
var path = require('path');

chai.use(chaiAsPromised);
chai.should();
chaiAsPromised.transferPromiseness = wd.transferPromiseness;

var app = path.resolve("./tests/cordova/platforms/android/ant-build/" +
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

browser.init(desired)
  .setImplicitWaitTimeout(10000)
  .then(function () {
    browser = browser.sleep(10000);

    for (var i = 0; i < 60; i++) {
      browser = browser
        .elementByXPath('//android.widget.FrameLayout')
        .click()
        .sleep(10000);
    }

    return browser.elementById('android:id/message').text()
      .should.become('Tests passed!')
      .fin(function () {
        return browser.quit();
      });
  }).done();
