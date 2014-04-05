'use strict';

global.results = {};

var pre = document && document.getElementById('output');

function log(msg) {
  if (pre) {
    pre.innerHTML = pre.innerHTML + msg;
  }
}

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

exports.complete = function () {
  global.results.completed = true;
  console.log(global.results);
  log('\nTests Complete!\n\n');
};

