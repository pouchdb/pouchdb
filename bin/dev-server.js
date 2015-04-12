#!/usr/bin/env node

'use strict';

var fs = require('fs');
var Promise = require('bluebird');
var through = require('through2');
var _derequire = require('derequire');
var watchify = require('watchify');
var browserify = require('browserify');
var cors_proxy = require('corsproxy');
var http_proxy = require('pouchdb-http-proxy');
var http_server = require('http-server');
var mkdirp = require('mkdirp');

function derequire() {
  var out = new Buffer('');
  return through(function (data, _, next) {
    out = Buffer.concat([out, data]);
    next();
  }, function (next) {
    this.push(_derequire(out.toString()));
    next();
  });
}
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

var indexfile = "./lib/index.js";
var outfile = "./dist/pouchdb.js";
var perfRoot = './tests/performance/';
var performanceBundle = './tests/performance-bundle.js';

var w = watchify(browserify(indexfile, {
  standalone: "PouchDB",
  cache: {},
  packageCache: {},
  fullPaths: true,
  debug: true
})).on('update', bundle);
var b = watchify(browserify({
    entries: perfRoot,
    cache: {},
    packageCache: {},
    fullPaths: true,
    debug: true
  })).on('update', bundlePerfTests);

function bundle(callback) {
  mkdirp.sync('./dist');
  w.bundle().pipe(derequire()).pipe(fs.createWriteStream(outfile))
  .on('finish', function () {
    console.log('Updated: ', outfile);
    if (typeof callback === 'function') {
      callback();
    }
  });
}

function bundlePerfTests(callback) {
   
  b.bundle().pipe(fs.createWriteStream(performanceBundle))
  .on('finish', function () {
    console.log('Updated: ', performanceBundle);
    if (typeof callback === 'function') {
      callback();
    }
  });

}

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
