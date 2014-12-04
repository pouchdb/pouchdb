'use strict';

var commonUtils = {};

// This is a duplicate of the function in integration/utils.js but the
// current test set up makes it really hard to share that function. Since
// we are apparently going to refactor the tests for now we'll just copy the
// function in two places.
commonUtils.couchHost = function () {
  if (commonUtils.isNode()) {
    return process.env.COUCH_HOST || 'http://localhost:5984';
  } else if (window && window.COUCH_HOST) {
    return window.COUCH_HOST;
  } else if (window && window.cordova) {
      // magic route to localhost on android emulator
    return 'http://10.0.2.2:2020';
  }
  // In the browser we default to the CORS server, in future will change
  return 'http://localhost:2020';
};

commonUtils.safeRandomDBName = function () {
  return "test" + Math.random().toString().replace('.', '_');
};

commonUtils.createDocId = function (i) {
  var intString = i.toString();
  while (intString.length < 10) {
    intString = '0' + intString;
  }
  return 'doc_' + intString;
};

commonUtils.isNode = function () {
  // First part taken from
  // http://timetler.com/2012/10/13/environment-detection-in-javascript/
  // The !process.browser check is needed to see if we are in browserify
  // which actually will pass the first part.
  return typeof exports !== 'undefined' &&
          this.exports !== exports &&
          !process.browser;
};

module.exports = commonUtils;