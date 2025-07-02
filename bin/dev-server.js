#!/usr/bin/env node

'use strict';

var watch = require('glob-watcher');
var http_server = require('http-server');
const { debounce } = require('lodash');
var browserify = require('browserify');
var fs = require('fs');

var queryParams = {};

if (process.env.ADAPTERS) {
  queryParams.adapters = process.env.ADAPTERS;
}
if (process.env.VIEW_ADAPTERS) {
  queryParams.viewAdapters = process.env.VIEW_ADAPTERS;
}
if (process.env.AUTO_COMPACTION) {
  queryParams.autoCompaction = true;
}
if (process.env.POUCHDB_SRC) {
  queryParams.src = process.env.POUCHDB_SRC;
}
if (process.env.PLUGINS) {
  queryParams.plugins = process.env.PLUGINS;
}
if (process.env.COUCH_HOST) {
  queryParams.couchHost = process.env.COUCH_HOST;
}
if (process.env.ITERATIONS) {
  queryParams.iterations = process.env.ITERATIONS;
}
if (process.env.SRC_ROOT) {
  queryParams.srcRoot = process.env.SRC_ROOT;
}
if (process.env.USE_MINIFIED) {
  queryParams.useMinified = process.env.USE_MINIFIED;
}

var rebuildPromise = Promise.resolve();

function rebuildPouch() {
  const buildPouchDB = require('./build-pouchdb');
  rebuildPromise = rebuildPromise.then(buildPouchDB).then(function () {
    console.log('Rebuilt packages/node_modules/pouchdb');
  }).catch(console.error);
  return rebuildPromise;
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
  }).catch(console.error);
  return rebuildPromise;
}

function rebuildPerf() {
  rebuildPromise = rebuildPromise.then(function () {
    return browserifyPromise('tests/performance/index.js',
      'tests/performance-bundle.js');
  }).then(function () {
    console.log('Rebuilt tests/performance-bundle.js');
  }).catch(console.error);
  return rebuildPromise;
}

function watchAll() {
  watch(['packages/node_modules/*/src/**/*.js'],
    debounce(rebuildPouch, 700, {leading: true}));
  watch(['tests/integration/utils.js'],
    debounce(rebuildTestUtils, 700, {leading: true}));
  watch(['tests/performance/**/*.js'],
    debounce(rebuildPerf, 700, {leading: true}));
}

var HTTP_PORT = 8000;

var serversStarted;
var readyCallback;

function startServers(callback) {
  readyCallback = callback;
  http_server.createServer().listen(HTTP_PORT, function () {
    var testRoot = 'http://127.0.0.1:' + HTTP_PORT;
    const query = new URLSearchParams(queryParams);
    console.log(`Integration  tests: ${testRoot}/tests/integration/?${query}`);
    console.log(`Map/reduce   tests: ${testRoot}/tests/mapreduce/?${query}`);
    console.log(`pouchdb-find tests: ${testRoot}/tests/find/?${query}`);
    console.log(`Performance  tests: ${testRoot}/tests/performance/?${query}`);
    serversStarted = true;
    checkReady();
  });
}

function checkReady() {
  if (serversStarted && readyCallback) {
    readyCallback();
  }
}

if (require.main === module) {
  startServers();
  watchAll();
} else {
  module.exports.start = startServers;
}
