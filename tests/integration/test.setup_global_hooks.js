"use strict";

var currentListener = null;
var currentError = null;

beforeEach(function (done) {
  currentError = null;
  currentListener = function (error) {
    currentError = error;
  };
  testUtils.addUnhandledRejectionListener(currentListener);
  done();
});

afterEach(function (done) {
  testUtils.removeUnhandledRejectionListener(currentListener);
  done(currentError);
});