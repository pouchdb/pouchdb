'use strict';
var isNode = process && !process.browser;
var UAParser = require('ua-parser-js');
var ua = !isNode && new UAParser(navigator.userAgent);
global.results = {};

var pre = !isNode && global.document.getElementById('output');

function log(msg) {
  if (pre) {
    pre.innerHTML = pre.innerHTML + msg;
  } else {
    console.log(msg);
  }
}

exports.log = log;

exports.startSuite = function (suiteName) {
  log('Starting suite: ' + suiteName + '\n\n');
};

exports.start = function (testCase) {
  var key = testCase.name;
  log('Starting test: ' + key + ' with ' + testCase.assertions +
    ' assertions and ' + testCase.iterations + ' iterations... ');
  global.results[key] = {
    start: Date.now()
  };
};

exports.end = function (testCase) {
  var key = testCase.name;
  var obj = global.results[key];
  obj.end = Date.now();
  obj.duration = obj.end - obj.start;
  log('done in ' + obj.duration + 'ms\n');
};

exports.complete = function (suiteName) {
  global.results.completed = true;
  if (isNode) {
    global.results.client = {node: process.version};
  } else {
    global.results.client = {
      browser: ua.getBrowser(),
      device: ua.getDevice(),
      engine: ua.getEngine(),
      cpu: ua.getCPU(),
      os : ua.getOS(),
      userAgent: navigator.userAgent
    };
  }
  console.log(global.results);
  log('\nTests Complete!\n\n');
};

