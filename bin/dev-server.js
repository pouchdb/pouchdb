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
var level_backend = process.env.LEVEL_BACKEND;
var indexfile, outfile;
var query = "";
var perfRoot;
if (process.env.LEVEL_BACKEND) {
  query = "?sourceFile=pouchdb-" + level_backend + ".js";
  indexfile = "./alt/index-alt.js";
  outfile = "./dist/pouchdb-" + level_backend + ".js";
  perfRoot = './alt/performance/*.js';
} else {
  indexfile = "./lib/index.js";
  outfile = "./dist/pouchdb-nightly.js";
  perfRoot = './tests/performance/*.js';
}

var w = watchify(indexfile).on('update', bundle);
bundle();

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
  if (level_backend) {
    w.require(level_backend, {expose: 'levelalt'});
    w.require('./alt/index-alt', {expose: './index'});
  }
  w.bundle({standalone: "PouchDB"}, writeFile(outfile));
}

function bundlePerfTests() {
  glob(perfRoot, function (err, files) {
    var b = browserify(files);
    if (level_backend) {
      b.require(level_backend, {expose: 'levelalt'});
      b.require('./alt/index-alt', {expose: './index'});
    }
    b.bundle({}, writeFile(performanceBundle));
  });
}

watchGlob(perfRoot, bundlePerfTests);
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
              '/tests/performance/test.html');
}


if (require.main === module) {
  startServers();
} else {
  module.exports.start = startServers;
}
