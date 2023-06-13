#!/usr/bin/env node

// 'use strict'; is default when ESM

// Set the version of all modules, since they're versioned together.
// Usage: npm run set-version -- [version]
// e.g.   npm run set-version -- 1.2.3

var version = process.argv[process.argv.length - 1];
var fs = require('node:fs');
var path = require('node:path');

var packages = fs.readdirSync('packages/node_modules');

packages.map(function (pkg) {
  return path.resolve(__dirname, '../packages/node_modules', pkg, 'package.json');
}).concat([
  path.resolve(__dirname, '../package.json')
]).forEach(function (jsonFile) {
  var json = JSON.parse(fs.readFileSync(jsonFile), 'utf-8');
  json.version = version;
  fs.writeFileSync(jsonFile, JSON.stringify(json, null, '  ') + '\n', 'utf-8');
});

console.log('done');
