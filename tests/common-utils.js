'use strict';

var commonUtils = {};

commonUtils.isBrowser = function () {
  return !commonUtils.isNode();
};

commonUtils.isNode = function () {
  return typeof process !== 'undefined' && !process.browser;
};

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

commonUtils.adapters = function () {
  var adapters = commonUtils.isNode() ? process.env.ADAPTERS : commonUtils.params().adapters;
  return adapters ? adapters.split(',') : [];
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
    // Remove trailing slash from url if the user defines one
    return commonUtils.params().couchHost.replace(/\/$/, '');
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

module.exports = commonUtils;
