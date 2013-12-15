#!/usr/bin/env node

'use strict';

var cors_proxy = require("corsproxy");
var http_proxy = require("http-proxy");
var http_server = require("http-server");

var program = require('commander');

var COUCH_HOST = 'http://127.0.0.1:5984';
var HTTP_PORT = 8000;
var CORS_PORT = 2020;

function startServers(remote) {
  var couchHost = remote || COUCH_HOST;
  http_server.createServer().listen(HTTP_PORT);
  cors_proxy.options = {target: couchHost};
  http_proxy.createServer(cors_proxy).listen(CORS_PORT);
}


if (require.main === module) {
  program
    .option('-r, --remote [url]', 'Specify the remote couch host')
    .parse(process.argv);
  startServers(program.remote);
} else {
  module.exports.start = startServers;
}
