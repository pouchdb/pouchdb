#!/usr/bin/env node

'use strict';

var Promise = require('lie');
var watch = require('watch-glob');
var http_server = require('http-server');
var debounce = require('lodash.debounce');
var buildPouchDB = require('./build-pouchdb');
var browserify = require('browserify');
var fs = require('fs');

var queryParams = {};

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

var rebuildPromise = Promise.resolve();

function rebuildPouch() {
  rebuildPromise = rebuildPromise.then(buildPouchDB).then(function () {
    console.log('Rebuilt packages/pouchdb');
  });
}

function browserifyPromise(src, dest) {
  return new Promise(function (resolve, reject) {
    browserify(src, {debug: true}).bundle().pipe(fs.createWriteStream(dest))
      .on('finish', resolve)
      .on('error', reject);
  });
}

function rebuildTestUtils() {
  rebuildPromise = rebuildPromise.then(function () {
    return browserifyPromise('tests/integration/utils.js',
      'tests/integration/utils-bundle.js');
  }).then(function () {
    console.log('Rebuilt tests/integration/utils-bundle.js');
  });
}

function rebuildPerf() {
  rebuildPromise = rebuildPromise.then(function () {
    return browserifyPromise('tests/performance/index.js',
      'tests/performance-bundle.js');
  }).then(function () {
    console.log('Rebuilt tests/performance-bundle.js');
  });
}

function watchAll() {
  watch(['packages/**/src/**/*.js'],
    debounce(rebuildPouch, 700, {leading: true}));
  watch(['tests/integration/utils.js'],
    debounce(rebuildTestUtils, 700, {leading: true}));
  watch(['tests/performance/**/*.js'],
    debounce(rebuildPerf, 700, {leading: true}));
}

var filesWritten = false;

Promise.resolve().then(function () {
  if (process.env.TRAVIS) {
    return; // don't bother rebuilding in Travis; we already built
  }
  return Promise.all([
    rebuildPouch(),
    rebuildTestUtils(),
    rebuildPerf()
  ]);
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
  watchAll();
} else {
  module.exports.start = startServers;
}
