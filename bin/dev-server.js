#!/usr/bin/env node

'use strict';

var cors_proxy = require("corsproxy");
var http_proxy = require("http-proxy");
var http_server = require("http-server");
var fs = require('fs');
var through = require('through');

fs.mkdir('dist', function(e) {
  if(e && e.code != 'EEXIST') {
    throw e;
  }
});

var watchify = require("watchify");
var w = watchify("./lib/index.js");
var dotfile = "./dist/.pouchdb-nightly.js";
var outfile = "./dist/pouchdb-nightly.js";

w.on('update', bundle);
bundle();

function bundle () {
  var wb = w.bundle();
  wb.on('error', function (err) {
    console.error(String(err));
  });
  wb.pipe(fs.createWriteStream(dotfile));
  wb.pipe(through(function write() {}, end));

  function end () {
    fs.rename(dotfile, outfile, function (err) {
      if(err) return console.error(err);
      console.log("Updated " + outfile);
    });
  }
}

var program = require('commander');

var COUCH_HOST = process.env.COUCH_HOST || 'http://127.0.0.1:5984';

var HTTP_PORT = 8000;
var CORS_PORT = 2020;

function startServers(couchHost) {
  http_server.createServer().listen(HTTP_PORT);
  cors_proxy.options = {target: couchHost || COUCH_HOST};
  http_proxy.createServer(cors_proxy).listen(CORS_PORT);
}


if (require.main === module) {
  startServers();
} else {
  module.exports.start = startServers;
}
