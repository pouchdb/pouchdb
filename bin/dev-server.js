#!/usr/bin/env node

'use strict';

var cors_proxy = require("corsproxy");
var http_proxy = require("http-proxy");
var http_server = require("http-server");

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
