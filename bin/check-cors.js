#!/usr/bin/env node

var request = require('request').defaults({json: true});

var config = {
  'httpd/enable_cors': '"true"',
  'cors/origins': '"*"',
  'cors/credentials': '"true"',
  'cors/methods': '"GET, PUT, POST, HEAD, DELETE"',
  'cors/headers': '"accept, authorization, content-type, origin"'
};

var HOST = 'http://127.0.0.1:5984';
var count = 0;

function installCors() {

  if (count == Object.keys(config).length) {
    console.log('CORS setup complete');
    return;
  }

  var key = Object.keys(config)[count];

  var opts = {
    method: 'PUT',
    uri: HOST + '/_config/' + key,
    body: config[key]
  };

  request(opts, function(err, res) {
    if (err || res.statusCode !== 200) {
      console.error('Failed to setup CORS');
      return;
    }
    count++;
    installCors();
  });

}

request.get(HOST + '/_session', function(err, result) {

  if (result.body.userCtx.roles.indexOf('_admin') === -1) {
    console.log('You are not an admin');
    return process.exit(1);
  }

  request.get({
    uri: HOST + '/testdb',
    method: 'OPTIONS',
    headers: {
      'Origin': 'http://fakedomain.com:80',
      'Access-Control-Request-Method': 'PUT'
    }
  }, function(err, result) {
    var allowHeader = result.headers['access-control-allow-origin'] || false;
    if (!allowHeader || allowHeader.indexOf('*') === -1) {
      installCors();
      return;
    }
  });

});


