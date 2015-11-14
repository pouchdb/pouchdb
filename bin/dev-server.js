#!/usr/bin/env node

'use strict';

var fs = require('fs');
var Promise = require('lie');
var watchify = require('watchify');
var watch = require('node-watch');
var browserify = require('browserify');
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
if (process.env.COUCH_HOST) {
  queryParams.couchHost = process.env.COUCH_HOST;
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
    var child = spawn('npm', ['run', 'build']);
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
  if (require.main === module) {
    return rebuild(resolve);
  }
  resolve(); // don't bother rebuilding if we're in `npm run dev`
}).then(function () {
  return new Promise(function (resolve) {
    rebuildPerfTests(resolve);
  });
}).then(function () {
  filesWritten = true;
  checkReady();
});

var HTTP_PORT = 8000;

// if SERVER=sync-gateway we also have 
// tests/misc/sync-gateway-config-server.js 
// listening on port 8001

var serversStarted;
var readyCallback;

function startServers(callback) {
  readyCallback = callback;
  http_server.createServer().listen(HTTP_PORT, function () {
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
                '/tests/performance/' + query);
    serversStarted = true;
    checkReady();
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
