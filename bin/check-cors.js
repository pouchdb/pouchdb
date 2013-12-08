#!/usr/bin/env node

var request = require('request').defaults({json: true});

request.get('http://127.0.0.1:5984/_session', function(err, result) {

  if (result.body.userCtx.roles.indexOf('_admin') === -1) {
    console.log('You are not an admin');
    return process.exit(1);
  }

});
