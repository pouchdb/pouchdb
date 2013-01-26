/*jshint node:true */

"use strict";

var url = require('url');
var http = require('http');
var crypto = require('crypto');

var couchUrl;
var corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Headers':
    'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept, Authorization, test-key'
};

// Tokens are only session valid for now
var activeTokens = {};
var DB_PREFIX = 'tok_';
var HASH_SEED = 'bananas';

var couchUser;
var couchPass;

function sendJSON(res, status, headers, json) {
  headers['Content-Type'] = 'application/json';
  for (var name in corsHeaders) {
    headers[name] = corsHeaders[name];
  }
  res.writeHead(200, headers);
  res.end(JSON.stringify(json) + '\n');
}

function handleRequest(request, response) {

  if (request.method === 'OPTIONS') {
    response.writeHead(200, corsHeaders);
    response.end();
    return;
  }

  if (request.method === 'POST' && request.url === '/_provision') {
    var seed = Date.now() + HASH_SEED;
    var token = crypto.createHash('md5').update(seed).digest("hex");
    activeTokens[token] = true;
    return sendJSON(response, 200, {}, {token: token});
  }

  if (request.url === '/' && request.method === 'GET') {
    return sendJSON(response, 200, {}, {'tokenserver': 'Welcome'});
  }

  var key = 'test-key' in request.headers ? request.headers['test-key'] : null;

  if (!key || !(key in activeTokens)) {
    response.writeHead(500, {});
    response.end('DENIED\n');
    return;
  }

  var path;
  if (request.url !== '/_uuids') {
    path = request.url;
  } else {
    path = request.url.replace(/^\//, '/' + DB_PREFIX + key + '_');
  }

  var options = {
    host: couchUrl.hostname,
    port: couchUrl.port,
    method: request.method,
    path: path,
    headers: request.headers
  };

  options.headers.host = couchUrl.host;
  options.headers.authorization = "Basic " +
    new Buffer(couchUser + ":" + couchPass).toString("base64");

  if (options.method !== 'PUT' && options.method !== 'POST'){
    options.headers['content-length'] = 0;
  }
  var proxy_request = http.request(options);

  proxy_request.addListener('response', function (proxy_response) {
    proxy_response.addListener('data', function(chunk) {
      response.write(chunk, 'binary');
    });
    proxy_response.addListener('end', function() {
      response.end();
    });    var headers = proxy_response.headers;
    for (var name in corsHeaders) {
      headers[name] = corsHeaders[name];
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

function readPostData(request, callback) {
  var data = '';
  request.on('data', function(chunk) { data += chunk; });
  request.on("end", function() {
    if (data !== '') {
      callback(null, JSON.parse(data));
    } else{
      callback(null, null);
    }
  });
}

function startServer(couch, cors) {
  couchUrl = couch;
  http.createServer(handleRequest).listen(cors.port);
}

if (require.main === module) {
  if (process.argv.length < 4) {
    console.log('$ node anonserver.js http://127.0.0.1:5984 2020 admin pass');
    return;
  }
  var couch = url.parse(process.argv[2]);
  var port = parseInt(process.argv[3], 10);
  couchUser = process.argv[4];
  couchPass = process.argv[5];
  startServer(couch, {port: port});
} else {
  exports.init = startServer;
}