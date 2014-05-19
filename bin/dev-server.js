#!/usr/bin/env node

'use strict';

var fs = require('fs');
var glob = require('glob');
var watchGlob = require('watch-glob');
var watchify = require('watchify');
var browserify = require('browserify');

var http_server = require('http-server');
var Promise = require('bluebird');
var request = Promise.promisify(require('request'));

var performanceBundle = './dist/performance-bundle.js';
var level_backend = process.env.LEVEL_BACKEND;
var indexfile, outfile;
var queryParams = {};

if (process.env.ES5_SHIM || process.env.ES5_SHIMS) {
  queryParams.es5shim = true;
}

var perfRoot;
if (process.env.LEVEL_BACKEND) {
  queryParams.sourceFile = "pouchdb-" + level_backend + ".js";
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

function startServers(couchHost) {

  couchHost = couchHost || COUCH_HOST;

  // enable CORS globally, because it's easier this way

  var corsValues = {
    '/_config/httpd/enable_cors': 'true',
    '/_config/cors/origins': '*',
    '/_config/cors/credentials': 'true',
    '/_config/cors/methods': 'GET, PUT, POST, HEAD, DELETE',
    '/_config/cors/headers': 'accept, authorization, content-type, origin'
  };

  Promise.all(Object.keys(corsValues).map(function (key) {
    var value = corsValues[key];
    return request({
      method: 'put',
      url: couchHost + key,
      body: JSON.stringify(value)
    });
  })).then(function () {
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
    http_server.createServer().listen(HTTP_PORT);
  }).catch(function (err) {
    if (err) {
      console.log(err);
      process.exit(1);
    }
  });
}


if (require.main === module) {
  startServers();
} else {
  module.exports.start = startServers;
}
