'use strict';

var commonUtils = {};

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

commonUtils.simulateNetworkLatencyInNode =
  function (remoteCouchUrl, addedLatencyInMs, remoteDBOpts, PouchDB) {
  var http = require('http'),
    httpProxy = require('http-proxy'),
    url = require('url'),
    parsedRemoteCouchUrl = url.parse(remoteCouchUrl),
    proxy = httpProxy.createProxyServer(),
    proxyServer = http.createServer(function (req, res) {
      setTimeout(function () {
        proxy.web(req, res, {
          target: "http://" + parsedRemoteCouchUrl.host
        });
      }, addedLatencyInMs);
    }).listen(3001);

  // When parsing a URL object url.format honors host before
  // hostname + port, so we have to set host.
  var serverProxyUrl = url.parse(remoteCouchUrl);
  serverProxyUrl.host = parsedRemoteCouchUrl.hostname + ":" +
                        3001;

  return { proxiedRemoteDb:
            new PouchDB(url.format(serverProxyUrl), remoteDBOpts),
           proxyServer: proxyServer };
};

commonUtils.simulateNetworkLatencyInBrowser =
  function (remoteCouchUrl, addedLatencyInMs, remoteDBOpts, PouchDB) {
  remoteDBOpts = remoteDBOpts || {};
  remoteDBOpts.ajax = remoteDBOpts.ajax || {};
  remoteDBOpts.ajax.xhr = function ()  {
    var xmlHttpRequest = new XMLHttpRequest();
    xmlHttpRequest._originalSend = xmlHttpRequest.send;
    xmlHttpRequest.send = function () {
      var sendArgsAsArray = Array.prototype.slice.call(arguments);
      var originalThis = this;
      setTimeout(function () {
        xmlHttpRequest
          ._originalSend
          .apply(originalThis, sendArgsAsArray);
      }, addedLatencyInMs);
    };
    return xmlHttpRequest;
  };
  return new PouchDB(remoteCouchUrl, remoteDBOpts);
};

commonUtils.isBrowser = function () {
  // I tried
  // http://timetler.com/2012/10/13/environment-detection-in-javascript/
  // but Browserify passed the test so instead I'm using
  return process.browser;
};

commonUtils.createDocId = function (i) {
  var intString = i.toString();
  while (intString.length < 10) {
    intString = '0' + intString;
  }
  return 'doc_' + intString;
};

module.exports = commonUtils;