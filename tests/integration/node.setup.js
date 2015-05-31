"use strict";

// throw an error if any EventEmitter adds too many listeners
require('throw-max-listeners-error');

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
var chai = require('chai');
chai.use(require('chai-as-promised'));
global.should = chai.should();

