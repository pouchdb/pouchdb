'use strict';
require('daemon')();
var cors_proxy = require("corsproxy");
var http_proxy = require("http-proxy");
var http_server = require("http-server");

var couchHost = process.env.COUCH_HOST || 'http://127.0.0.1:5984';

var HTTP_PORT = 8000;
var CORS_PORT = 2020;

cors_proxy.options = {target: couchHost};

http_proxy.createServer(cors_proxy).listen(CORS_PORT);
