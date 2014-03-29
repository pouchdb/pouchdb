#!/usr/bin/env node
'use strict';

if (!process.env.DASHBOARD_HOST) {
  console.log('DASHBOARD_HOST is required');
  process.exit(0);
}

var spawn = require('child_process').spawn;
var fs = require('fs');
var request = require('request');

var DASHBOARD_HOST = process.env.DASHBOARD_HOST;

var env = process.env;
env.COVERAGE = 1;
env.stdio = 'inherit';

var sp = spawn('npm', ['test'], env);

sp.on('close', function (code) {
  console.log('child process exited with code ' + code);

  var coverage_file = fs.readFileSync('coverage/coverage.json', 'utf-8');
  var coverage_json = JSON.parse(coverage_file);
  coverage_json.date = Date.now();

  var options = {
    method: 'POST',
    uri: DASHBOARD_HOST + '/coverage_results',
    json: coverage_json
  };

  request(options, function (error, response, body) {
    if (!error) {
      return process.exit(0);
    } else {
      return process.exit(1);
    }
  });

});

