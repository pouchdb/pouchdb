#!/usr/bin/env node

// This module ensures you have a valid CouchDB instance to run tests against
// You are required to have administration rights to CouchDB, CORS will
// automatically be setup

// Dont run the tests against a CouchDB instance you are running in production.
var utils = require('../test/test_utils.js');
var request = require('request').defaults({json: true});

var config = {
  'httpd/enable_cors': '"true"',
  'cors/origins': '"*"',
  'cors/credentials': '"true"',
  'cors/methods': '"GET, PUT, POST, HEAD, DELETE"',
  'cors/headers': '"accept, authorization, content-type, origin"'
};

var count = 0;

function installCorsConfig() {

  if (count == Object.keys(config).length) {
    return;
  }

  var key = Object.keys(config)[count];
  var opts = {
    method: 'PUT',
    uri: utils.COUCH_HOST + '/_config/' + key,
    body: config[key]
  };

  request(opts, function(err, res) {
    if (err || res.statusCode !== 200) {
      console.error('Failed to setup CORS');
      return;
    }
    count++;
    installCorsConfig();
  });

}

request.get(utils.COUCH_HOST + '/_session', function(err, result) {

  if (err || result.body.userCtx.roles.indexOf('_admin') === -1) {
    console.error('Did not find a valid CouchDB instance with admin access');
    return process.exit(1);
  }

  installCorsConfig();
});


