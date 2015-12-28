#!/usr/bin/env node

'use strict';

var fs = require('fs');
var Promise = require('lie');
var watchify = require('watchify');
var watch = require('node-watch');
var browserify = require('browserify');
var cors_proxy = require('corsproxy');
var http_proxy = require('pouchdb-http-proxy');
var http_server = require('http-server');
var spawn = require('child_process').spawn;

var queryParams = {};

if (process.env.ES5_SHIM || process.env.ES5_SHIMS) {
  queryParams.es5shim = true;
}
if (process.env.ADAPTERS) {
  queryParams.adapters = process.env.ADAPTERS;
}
if (process.env.AUTO_COMPACTION) {
  queryParams.autoCompaction = true;
}
if (process.env.POUCHDB_SRC) {
  queryParams.src = process.env.POUCHDB_SRC;
}

var perfRoot = './tests/performance/';
var performanceBundle = './tests/performance-bundle.js';

var b = watchify(browserify({
  entries: perfRoot,
  cache: {},
  packageCache: {},
  fullPaths: true,
  debug: true
})).on('update', rebuildPerfTests);

function rebuildPerfTests(callback) {
  b.bundle().pipe(fs.createWriteStream(performanceBundle))
    .on('finish', function () {
      console.log('Updated: ', performanceBundle);
      if (typeof callback === 'function') {
        callback();
      }
    });
}

var rebuildPromise = Promise.resolve();

function rebuild(callback) {
  // only run one build at a time
  rebuildPromise = rebuildPromise.then(function () {
    var child = spawn('npm', ['run', 'build-main-js']);
    child.stdout.on('data', function (buf) {
      console.log(String(buf).replace(/\s*$/, ''));
    });
    child.stderr.on('data', function (buf) {
      console.log(String(buf).replace(/\s*$/, ''));
    });
    child.on('close', function () {
      if (typeof callback === 'function') {
        callback();
      }
    });
  });
}

watch('./src', rebuild);

var filesWritten = false;

new Promise(function (resolve) {
  rebuild(resolve);
}).then(function () {
  return new Promise(function (resolve) {
    rebuildPerfTests(resolve);
  });
}).then(function () {
  filesWritten = true;
  checkReady();
});

var COUCH_HOST = process.env.COUCH_HOST || 'http://127.0.0.1:5984';

var HTTP_PORT = 8000;
var CORS_PORT = 2020;

// if SERVER=sync-gateway we also have 
// tests/misc/sync-gateway-config-server.js 
// listening on port 8001

var serversStarted;
var readyCallback;

function startServers(callback) {
  readyCallback = callback;
  http_server.createServer().listen(HTTP_PORT, function () {
    cors_proxy.options = {target: COUCH_HOST};
    http_proxy.createServer(cors_proxy).listen(CORS_PORT, function () {
      var testRoot = 'http://127.0.0.1:' + HTTP_PORT;
      var query = '';
      Object.keys(queryParams).forEach(function (key) {
        query += (query ? '&' : '?');
        query += key + '=' + encodeURIComponent(queryParams[key]);
      });
      console.log('Integration tests: ' + testRoot +
        '/tests/integration/' + query);
      console.log('Map/reduce  tests: ' + testRoot +
      '/tests/mapreduce' + query);
      console.log('Performance tests: ' + testRoot +
        '/tests/performance/');
      serversStarted = true;
      checkReady();
    });
  });
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
