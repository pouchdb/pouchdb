#!/usr/bin/env node

'use strict';

var fs = require('fs');
var glob = require('glob');
var watchGlob = require('watch-glob');
var watchify = require('watchify');
var browserify = require('browserify');

var cors_proxy = require('corsproxy');
var http_proxy = require('http-proxy');
var http_server = require('http-server');

var performanceBundle = './dist/performance-bundle.js';
var indexfile, outfile;
var query = "";

if (process.env.LEVEL_BACKEND) {
  indexfile = "./lib/index-levelalt.js";
  outfile = "./dist/pouchdb-" + process.env.LEVEL_BACKEND + ".js";
  query = "?sourceFile=pouchdb-" + process.env.LEVEL_BACKEND + ".js";
} else {
  indexfile = "./lib/index.js";
  outfile = "./dist/pouchdb-nightly.js";
}

function writeFile(file) {
  return function (err, data) {
    if (err) {
      console.log(err);
    } else {
      fs.writeFileSync(file, data);
      console.log('Updated: ', file);
    }
  };
}

function bundle() {
  w.bundle({standalone: "PouchDB"}, writeFile(outfile));
}
var w = watchify(indexfile).on('update', bundle);
bundle();

function bundlePerfTests() {
  glob('./tests/performance/*.js', function (err, files) {
    browserify(files).bundle({}, writeFile(performanceBundle));
  });
}

watchGlob('tests/performance/perf.*.js', bundlePerfTests);
bundlePerfTests();

var COUCH_HOST = process.env.COUCH_HOST || 'http://127.0.0.1:5984';

var HTTP_PORT = 8000;
var CORS_PORT = 2020;

function startServers(couchHost) {
  http_server.createServer().listen(HTTP_PORT);
  cors_proxy.options = {target: couchHost || COUCH_HOST};
  http_proxy.createServer(cors_proxy).listen(CORS_PORT);
  var testRoot = 'http://127.0.0.1:' + HTTP_PORT;
  console.log('Integration tests: ' + testRoot +
              '/tests/test.html' + query);
  console.log('Performance tests: ' + testRoot +
              '/tests/performance/test.html' + query);
}


if (require.main === module) {
  startServers();
} else {
  module.exports.start = startServers;
}
