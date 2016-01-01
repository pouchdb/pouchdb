#!/usr/bin/env node

'use strict';

var Promise = require('lie');
var watch = require('node-watch');
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

var rebuildPromise = Promise.resolve();

function rebuild() {
  // only run one build at a time
  rebuildPromise = rebuildPromise.then(function () {
    return new Promise(function (resolve) {
      var child = spawn('npm', ['run', 'build']);
      child.stdout.on('data', function (buf) {
        console.log(String(buf).replace(/\s*$/, ''));
      });
      child.stderr.on('data', function (buf) {
        console.log(String(buf).replace(/\s*$/, ''));
      });
      child.on('close', resolve);
    });
  });
  return rebuildPromise;
}

watch('./src', rebuild);

var filesWritten = false;

Promise.resolve().then(function () {
  if (require.main !== module) {
    return; // don't bother rebuilding if we're in `npm run dev`
  }
  return rebuild();
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
