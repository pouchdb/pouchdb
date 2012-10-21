var http = require('http'),
    cors_headers = {
      'Access-Control-Allow-Origin'  : '*',
      'Access-Control-Allow-Methods' : 'POST, GET, PUT, DELETE, OPTIONS',
      'Access-Control-Max-Age'       : '86400', // 24 hours
      'Access-Control-Allow-Headers' : 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept, Authorization'
    },
    passed_domain = false;

// add passed extra headers
for (var i=2; i < process.argv.length; i++) {
  switch (true) {
    case /^\X-/.test(process.argv[i]):
      cors_headers['Access-Control-Allow-Headers'] += ', ' + process.argv[i];
      break;
    case /[\w.]+(:\d+)?/.test(process.argv[i]):
      passed_domain = process.argv[i];
      break;
    default:
      console.log('Dunno what to do with param: '+process.argv[i])
  }
};

http.createServer(function(request, response) {
  if (request.method == 'OPTIONS') {
    console.log('OPTIONS request: sending cors headers only.');
    response.writeHead(204, cors_headers);
    response.end();
    return;
  }

  request.headers['host']  = (passed_domain || request.headers['host'])
                              // remove port
                              .replace(/\:.*$/,'')
                              // proxy.example.com => example.com
                              .replace(/proxy\./,'');

  console.log(request.headers['host'], request.method, request.url);

  var proxy = http.createClient(5984, request.headers['host']);
  var proxy_request = proxy.request(request.method, request.url, request.headers);


  proxy_request.addListener('response', function (proxy_response) {
    proxy_response.addListener('data', function(chunk) {
      response.write(chunk, 'binary');
    });
    proxy_response.addListener('end', function() {
      response.end();
    });
    var headers = proxy_response.headers;
    for (name in cors_headers) {
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
}).listen(process.env.PORT || 2020);