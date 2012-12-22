/*jshint node:true */

"use strict";

var http = require('http');
var cors_headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Headers':
    'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept, Authorization'
};

var couchUrl;

function handleRequest(request, response) {

  if (request.method === 'OPTIONS') {
    response.writeHead(200, cors_headers);
    response.end();
    return;
  }

  request.headers.host = couchUrl.host;

  var options = {
    host: couchUrl.hostname,
    port: couchUrl.port,
    method: request.method,
    path: request.url,
    headers: request.headers
  };

  var proxy_request = http.request(options);

  proxy_request.addListener('response', function (proxy_response) {
    proxy_response.addListener('data', function(chunk) {
      response.write(chunk, 'binary');
    });
    proxy_response.addListener('end', function() {
      response.end();
    });
    var headers = proxy_response.headers;
    for (var name in cors_headers) {
      headers[name] = cors_headers[name];
    }
    response.writeHead(proxy_response.statusCode, headers);
  });
  request.addListener('data', function(chunk) {
    proxy_request.write(chunk, 'binary');
  });
  request.addListener('end', function() {
    proxy_request.end();
  });
}

function startServer(couch, cors) {
  couchUrl = couch;
  http.createServer(handleRequest).listen(cors.port);
}

if (require.main === module) {
  startServer();
} else {
  exports.init = startServer;
}
