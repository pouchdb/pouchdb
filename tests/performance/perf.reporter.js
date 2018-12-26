'use strict';
var isNode = process && !process.browser;
var UAParser = require('ua-parser-js');
var ua = !isNode && new UAParser(navigator.userAgent);
var marky = require('marky');
var median = require('median');

var results = {
  tests: {}
};

// Capture test events for selenium output
var testEventsBuffer = [];

global.testEvents = function () {
  var events = testEventsBuffer;
  testEventsBuffer = [];
  return events;
};

// fix for Firefox max timing entries capped to 150:
// https://bugzilla.mozilla.org/show_bug.cgi?id=1331135
/* global performance */
if (typeof performance !== 'undefined' && performance.setResourceTimingBufferSize) {
  performance.setResourceTimingBufferSize(100000);
}

var pre = !isNode && global.document.getElementById('output');

function log(msg) {
  if (pre) {
    pre.textContent += msg;
  } else {
    console.log(msg);
  }
}

exports.log = log;

exports.startSuite = function (suiteName) {
  log('Starting suite: ' + suiteName + '\n\n');
  testEventsBuffer.push({ name: 'suite', obj: { title: suiteName } });
};

exports.endSuite = function (suiteName) {
  testEventsBuffer.push({ name: 'suite end', obj: { title: suiteName } });
};

exports.start = function (testCase, iter) {
  var key = testCase.name;
  log('Starting test: ' + key + ' with ' + testCase.assertions +
    ' assertions and ' + iter + ' iterations... ');
  results.tests[key] = {
    iterations: []
  };
};

exports.end = function (testCase) {
  var key = testCase.name;
  var obj = results.tests[key];
  obj.median = median(obj.iterations);
  obj.numIterations = obj.iterations.length;
  delete obj.iterations; // keep it simple when reporting
  log('median: ' + obj.median + ' ms\n');
  testEventsBuffer.push({ name: 'pass', obj: { title: testCase.name } });
  testEventsBuffer.push({ name: 'benchmark:result', obj });
};

exports.startIteration = function (testCase) {
  marky.mark(testCase.name);
};

exports.endIteration = function (testCase) {
  var entry = marky.stop(testCase.name);
  results.tests[testCase.name].iterations.push(entry.duration);
};

exports.startAll = function () {
  testEventsBuffer.push({ name: 'start' });
};

exports.complete = function (adapter) {
  results.completed = true;
  if (isNode) {
    results.client = {
      node: process.version
    };
  } else {
    results.client = {
      browser: ua.getBrowser(),
      device: ua.getDevice(),
      engine: ua.getEngine(),
      cpu: ua.getCPU(),
      os : ua.getOS(),
      userAgent: navigator.userAgent
    };
  }
  results.adapter = adapter;
  console.log('=>', JSON.stringify(results, null, '  '), '<=');
  log('\nTests Complete!\n\n');
  testEventsBuffer.push({ name: 'end', obj: results });
};

