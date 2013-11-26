#!/usr/bin/env node

var cors_proxy = require("corsproxy");
var http_proxy = require("http-proxy");
var http_server = require("http-server");

var program = require('commander');

program
  .option('-r, --remote [url]', 'Specify the remote couch host')
  .parse(process.argv);

var HTTP_PORT = 8000;
var CORS_PORT = 2020;

var couchHost = program.remote || 'http://127.0.0.1:5984';

http_server.createServer().listen(HTTP_PORT);
cors_proxy.options = {target: couchHost};

http_proxy.createServer(cors_proxy).listen(CORS_PORT);
