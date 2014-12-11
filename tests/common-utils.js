'use strict';

var commonUtils = {};

// This is a duplicate of the function in integration/utils.js but the
// current test set up makes it really hard to share that function. Since
// we are apparently going to refactor the tests for now we'll just copy the
// function in two places.
commonUtils.couchHost = function () {
  if (typeof module !== 'undefined' && module.exports) {
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

module.exports = commonUtils;