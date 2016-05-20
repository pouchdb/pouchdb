#!/usr/bin/env node

'use strict';

// Set the version of all modules, since they're versioned together.
// Usage: npm run set-version -- [version]
// e.g.   npm run set-version -- 1.2.3

var version = process.argv[process.argv.length - 1];
var fs = require('fs');
var path = require('path');

var packages = fs.readdirSync('packages');

var jsonFiles = packages.map(function (pkg) {
  return path.resolve(__dirname, '../packages', pkg, 'package.json');
}).concat([
  path.resolve(__dirname, '../packages/pouchdb/component.json'),
  path.resolve(__dirname, '../packages/pouchdb/bower.json')
]);

jsonFiles.forEach(function (jsonFile) {
  var json = JSON.parse(fs.readFileSync(jsonFile), 'utf-8');
  if (json.private) {
    return; // skip private packages, no need to update
  }
  json.version = version;
  // update version of all inner dependencies
  var depsList = [json.dependencies || {}, json.devDependencies || {}];
  depsList.forEach(function (deps) {
    Object.keys(deps).forEach(function (key) {
      if (packages.indexOf(key) !== -1) {
        deps[key] = version;
      }
    });
  });
  fs.writeFileSync(jsonFile, JSON.stringify(json, null, '  ') + '\n', 'utf-8');
});

var versionFile = path.resolve(__dirname,
  '../packages/pouchdb-core/src/version.js');
var versionFileContents = '// managed automatically by set-version.js\n' +
  'export default "' + version + '";\n';

fs.writeFileSync(versionFile, versionFileContents, 'utf-8');

var lernaFile = path.resolve(__dirname, '../lerna.json');
var lernaJson = JSON.parse(fs.readFileSync(lernaFile, 'utf-8'));
lernaJson.version = version;
fs.writeFileSync(lernaFile,
  JSON.stringify(lernaJson, null, '  ') + '\n', 'utf-8');

console.log('done');