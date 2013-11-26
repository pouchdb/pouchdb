#!/usr/bin/env node

// specify dependency
var testrunner = require("qunit");
var fs = require('fs');

var excludedTests = [
  // auth_replication and cors need admin access (#1030)
  'test.auth_replication.js',
  'test.cors.js',
  // Plugins currnetly arent tested (#1031)
  'test.gql.js',
  'test.spatial.js'
];

var testFiles = fs.readdirSync("./tests").filter(function(name){
  return (/^test\.([a-z0-9_])*\.js$/).test(name) &&
    (excludedTests.indexOf(name) === -1);
});

// If you want to test a single file, just do this for now, kinda ugly
// but will improve
//testFiles = ['test.basics.js'];

testrunner.setup({
  log: {
    summary: true
  }
});

testrunner.run({
  deps: [
    './src/deps/extend.js',
    './src/deps/blob.js',
    './src/deps/ajax.js',
    './src/pouch.js'
  ],
  code: "./src/adapters/pouch.leveldb.js",
  tests: testFiles.map(function(n) {
    return "./tests/" + n;
  })
}, function(err, result) {
  if (err) {
    console.error(err);
    process.exit(1);
    return;
  }
});
