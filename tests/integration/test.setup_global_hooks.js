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
  if (currentError) {
    if (currentError instanceof PromiseRejectionEvent) {
      currentError = currentError.reason;
    }

    console.error(currentError);
  }
  done(currentError);
});
