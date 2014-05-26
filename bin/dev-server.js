#!/usr/bin/env node

'use strict';

var fs = require('fs');
var glob = require('glob');
var Promise = require('bluebird');
var watchGlob = require('watch-glob');
var watchify = require('watchify');
var browserify = require('browserify');
var cors_proxy = require('corsproxy');
var http_proxy = require('http-proxy');
var http_server = require('http-server');
var request = require('request');

var queryParams = {};

if (process.env.ES5_SHIM || process.env.ES5_SHIMS) {
  queryParams.es5shim = true;
}
if (process.env.ADAPTERS) {
  queryParams.adapters = process.env.ADAPTERS;
}
if (process.env.CORS_PROXY) {
  queryParams.corsProxy = process.env.CORS_PROXY;
}

var indexfile = "./lib/index.js";
var outfile = "./dist/pouchdb-nightly.js";
var perfRoot = './tests/performance/*.js';
var performanceBundle = './dist/performance-bundle.js';

var w = watchify(indexfile).on('update', bundle);

function writeFile(file, callback) {
  return function (err, data) {
    if (err) {
      console.log(err);
    } else {
      fs.writeFileSync(file, data);
      console.log('Updated: ', file);
      if (callback) {
        callback();
      }
    }
  };
}

function bundle(callback) {
  w.bundle({standalone: "PouchDB"}, writeFile(outfile, callback));
}

function bundlePerfTests(callback) {
  glob(perfRoot, function (err, files) {
    var b = browserify(files);
    b.bundle({}, writeFile(performanceBundle, callback));
  });
}

watchGlob(perfRoot, bundlePerfTests);

var filesWritten = false;
Promise.all([
  new Promise(function (resolve) {
    bundle(resolve);
  }),
  new Promise(function (resolve) {
    bundlePerfTests(resolve);
  })
]).then(function () {
  filesWritten = true;
  checkReady();
});

var COUCH_HOST = process.env.COUCH_HOST || 'http://127.0.0.1:5984';

var HTTP_PORT = 8000;
var CORS_PORT = 2020;

var serversStarted;
var readyCallback;

function printServerInfo() {
  var testRoot = 'http://127.0.0.1:' + HTTP_PORT;
  var query = '';
  Object.keys(queryParams).forEach(function (key) {
    query += (query ? '&' : '?');
    query += key + '=' + encodeURIComponent(queryParams[key]);
  });
  console.log('Integration tests: ' + testRoot +
    '/tests/test.html' + query);
  console.log('Performance tests: ' + testRoot +
    '/tests/performance/test.html');
}

function setUpCors() {
  // enable CORS globally, because it's easier this way

  var corsValues = {
    '/_config/httpd/enable_cors': 'true',
    '/_config/cors/origins': '*',
    '/_config/cors/credentials': 'true',
    '/_config/cors/methods': 'PROPFIND, PROPPATCH, COPY, MOVE, DELETE, ' +
      'MKCOL, LOCK, UNLOCK, PUT, GETLIB, VERSION-CONTROL, CHECKIN, ' +
      'CHECKOUT, UNCHECKOUT, REPORT, UPDATE, CANCELUPLOAD, HEAD, ' +
      'OPTIONS, GET, POST',
    '/_config/cors/headers':
      'Cache-Control, Content-Type, Depth, Destination, ' +
        'If-Modified-Since, Overwrite, User-Agent, X-File-Name, ' +
        'X-File-Size, X-Requested-With, accept, accept-encoding, ' +
        'accept-language, authorization, content-type, origin, referer'
  };

  Promise.all(Object.keys(corsValues).map(function (key) {
      var value = corsValues[key];
      return request({
        method: 'put',
        url: COUCH_HOST + key,
        body: JSON.stringify(value)
      });
    })).then(function () {
      http_server.createServer().listen(HTTP_PORT, function () {
        serversStarted = true;
        printServerInfo();
        checkReady();
      });
    }).catch(function (err) {
      if (err) {
        console.log(err);
        process.exit(1);
      }
    });
}

function startCorsProxy() {
  console.log('Starting up CORS proxy at localhost:2020');
  http_server.createServer().listen(HTTP_PORT, function () {
    cors_proxy.options = {target: COUCH_HOST};
    http_proxy.createServer(cors_proxy).listen(CORS_PORT, function () {
      serversStarted = true;
      printServerInfo();
      checkReady();
    });
  });
}

function startServers(callback) {
  readyCallback = callback;
  if (process.env.CORS_PROXY === 'true') {
    startCorsProxy();
  } else {
    setUpCors();
  }
}

function checkReady() {
  if (filesWritten && serversStarted && readyCallback) {
    readyCallback();
  }
}


if (require.main === module) {
  startServers();
} else {
  module.exports.start = startServers;
}
