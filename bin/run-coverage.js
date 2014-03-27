#!/usr/bin/env node
'use strict';

var spawn = require('child_process').spawn;
var fs = require('fs');
var request = require('request');

var DASH_HOST = process.env.DASH_HOST || 'localhost:5984/coverage_results';
var DASH_USER = process.env.DASH_USER || '';
var DASH_PASS = process.env.DASH_PASS || '';

//COVERAGE=1 npm test
var env = process.env;
env.COVERAGE = 1;
env.stdio = 'inherit';

var sp = spawn('npm', ['test'], env);
 
sp.on('close', function (code) {
  console.log('child process exited with code ' + code);

  var coverage_file = fs.readFileSync('coverage/coverage.json', 'utf-8');
  var coverage_json = JSON.parse(coverage_file);
  coverage_json['date'] = Date.now();

  if (DASH_HOST === "") {
    console.log("Empty DASH_HOST");
  } else if (DASH_PASS === "" || DASH_USER === "") {
    var options = {
      method: 'POST',
      uri: 'http://localhost:5984/coverage_results',
      json: coverage_json
    };

    request(options, function (error, response, body) {
      console.log(body);
    });
  }
  else {
    
  }
});

