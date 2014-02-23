"use strict";

var testsDir = process.env.TESTS_DIR || './tmp';
var exec = require('child_process').exec;
function cleanup() {
  // Remove test databases
  exec('rm -r ' + testsDir);
}
exec('mkdir -p ' + testsDir, function () {
  process.on('SIGINT', cleanup);
  process.on('exit', cleanup);
});
global.testUtils = require('./utils.js');
global.should = require('chai').should();
