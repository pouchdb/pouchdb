#!/usr/bin/env node

'use strict';

// Set the version of all modules, since they're versioned together.
// Usage: npm run set-version -- [version]
// e.g.   npm run set-version -- 1.2.3

var version = process.argv[process.argv.length - 1];
var fs = require('fs');
var path = require('path');

var packages = fs.readdirSync('packages/node_modules');

var jsonFiles = packages.map(function (pkg) {
  return path.resolve(__dirname, '../packages/node_modules', pkg, 'package.json');
}).concat([
  path.resolve(__dirname, '../packages/node_modules/pouchdb/component.json'),
  path.resolve(__dirname, '../packages/node_modules/pouchdb/bower.json')
]);

jsonFiles.forEach(function (jsonFile) {
  var json = JSON.parse(fs.readFileSync(jsonFile), 'utf-8');
  json.version = version;
  // update version of all inner dependencies
  var depsList = [
    json.dependencies,
    json.devDependencies,
    json.peerDependencies
  ];
  depsList.forEach(function (deps) {
    if (!deps) {
      return;
    }
    Object.keys(deps).forEach(function (key) {
      if (packages.indexOf(key) !== -1) {
        deps[key] = version;
      }
    });
  });
  fs.writeFileSync(jsonFile, JSON.stringify(json, null, '  ') + '\n', 'utf-8');
});

var versionFile = path.resolve(__dirname,
  '../packages/node_modules/pouchdb-core/src/version.js');
var versionFileContents = '// managed automatically by set-version.js\n' +
  'export default "' + version + '";\n';

fs.writeFileSync(versionFile, versionFileContents, 'utf-8');

console.log('done');
