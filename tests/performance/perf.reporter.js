'use strict';
var isNode = process && !process.browser;
var UAParser = require('ua-parser-js');
var ua = !isNode && new UAParser(navigator.userAgent);
var marky = require('marky');
var median = require('median');

var results = {
  tests: {}
};

function emitMochaEvent(details) {
  // NodeJS perf testing just reports with console.log().
  if (typeof window !== 'undefined') {
    window.postMessage({ type: 'mocha', details });
  }
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
  emitMochaEvent({ name: 'suite', obj: { title: suiteName } });
};

exports.endSuite = function (suiteName) {
  emitMochaEvent({ name: 'suite end', obj: { title: suiteName } });
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
  emitMochaEvent({ name: 'pass', obj: { title: testCase.name } });
  emitMochaEvent({ name: 'benchmark:result', obj });
};

exports.startIteration = function (testCase) {
  marky.mark(testCase.name);
};

exports.endIteration = function (testCase) {
  var entry = marky.stop(testCase.name);
  results.tests[testCase.name].iterations.push(entry.duration);
};

exports.startAll = function () {
  emitMochaEvent({ name: 'start' });
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
  emitMochaEvent({ name: 'end', obj: results });
};

