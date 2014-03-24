#!/usr/bin/env node
'use strict';

//var spawn = require('child_process').spawn;
var fs = require('fs');
var request = require('request');

var DASH_HOST = process.env.DASH_HOST || 'localhost:5984/coverage_results';
var DASH_USER = process.env.DASH_USER || '';
var DASH_PASS = process.env.DASH_PASS || '';

//COVERAGE=1 npm test; to implement using spawn

var coverage_json = fs.readFileSync('coverage/coverage.json', 'utf-8');

if (DASH_HOST === "") {
  console.log("Empty DASH_HOST");
} else if (DASH_PASS === "" || DASH_USER === "") {
  var options = {
    uri: 'http://localhost:5984/coverage_results',
    //host: 'localhost',
    //port: 5984,
    //path: "/coverage_results",
    headers: {"content-type": "application/json"},
    method: 'POST',
    json: true,
    data: JSON.parse(coverage_json)
  };

  /*var req = */
  request(options, function (error, response, body) {
    console.log(body);
  });
}
else {
  
}

