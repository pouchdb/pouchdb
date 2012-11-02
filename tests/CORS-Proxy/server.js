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

function handleRequest(request, response) {

  if (request.method === 'OPTIONS') {
    //console.log('OPTIONS request: sending cors headers only.');
    response.writeHead(204, cors_headers);
    response.end();
    return;
  }

  request.headers.host  = request.headers.host.replace(/\:.*$/,'');

  //console.log(request.headers.host, request.method, request.url);

  var options = {
    host: request.headers.host,
    port: 5984,
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

function startServer(port) {
  http.createServer(handleRequest).listen(port);
}

if (require.main === module) {
  startServer(process.env.PORT || 2020);
} else {
  exports.init = startServer;
}
