#!/usr/bin/env node

var Mocha = require("mocha");
require("qunit-mocha-ui");
var fs = require('fs');
var testsDir = process.env.TESTS_DIR || './tmp';
var path = require('path');
var exec = require('child_process').exec;
var mocha = new Mocha({ui:"qunit-mocha-ui", reporter:process.env.TRAVIS ? "spec" : "dot", timeout: 5 * 60 * 1000});
var excludedTests = [
  // auth_replication and cors need admin access (#1030)
  'test.auth_replication.js',
  'test.cors.js',
  //no workers in node
  'test.worker.js',
  // Plugins currnetly arent tested (#1031)
  'test.gql.js',
  'test.spatial.js'
];

var testFiles;

if (process.env.TEST_FILE) {
  testFiles = [process.env.TEST_FILE];
} else {
  testFiles = fs.readdirSync("./tests").filter(function(name){
    return (/^test\.([a-z0-9_])*\.js$/).test(name) &&
      (excludedTests.indexOf(name) === -1);
  });
}


function cleanup() {
  // Remove test databases and test allDbs database.
  exec('rm -r ' + testsDir);
}

exec('mkdir -p ' + testsDir, function () {
  process.env.TESTS_DIR = testsDir.slice(-1) === "/" ? testsDir : testsDir+"/";

  process.on('SIGINT', cleanup);
  process.on('exit', cleanup);

  ['./lib/deps/extend.js',
      './lib/deps/blob.js',
      './lib/deps/ajax.js',
      './tests/pouch.shim.js',
    './lib/adapters/leveldb.js'
    ].forEach(function(file){
      mocha.addFile(file);
    });
    testFiles.map(function(n) {
      mocha.addFile("./tests/" + n);
    });
  mocha.run(function(failed){
    process.exit(failed);
  });
});
