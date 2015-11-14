'use strict';

var commonUtils = {};

// This is a duplicate of the function in integration/utils.js but the
// current test set up makes it really hard to share that function. Since
// we are apparently going to refactor the tests for now we'll just copy the
// function in two places.
commonUtils.params = function () {
  if (commonUtils.isNode()) {
    return process.env;
  }
  var paramStr = document.location.search.slice(1);
  return paramStr.split('&').reduce(function (acc, val) {
    if (!val) {
      return acc;
    }
    var tmp = val.split('=');
    acc[tmp[0]] = decodeURIComponent(tmp[1]) || true;
    return acc;
  }, {});
};

commonUtils.couchHost = function () {
  if (typeof window !== 'undefined' && window.cordova) {
    // magic route to localhost on android emulator
    return 'http://10.0.2.2:5984';
  }

  if (typeof window !== 'undefined' && window.COUCH_HOST) {
    return window.COUCH_HOST;
  }

  if (typeof process !== 'undefined' && process.env.COUCH_HOST) {
    return process.env.COUCH_HOST;
  }

  if ('couchHost' in commonUtils.params()) {
    return commonUtils.params().couchHost;
  }

  return 'http://localhost:5984';
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
