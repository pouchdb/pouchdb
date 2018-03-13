#!/usr/bin/env node

// Build all modules in the packages/ folder

var path = require('path');
var denodeify = require('denodeify');
var fs = require('fs');
var readDir = denodeify(fs.readdir);
var stat = denodeify(fs.stat);

var buildModule = require('./build-module');
var buildPouchDB = require('./build-pouchdb');

function buildPackage(pkg) {
  return stat(path.resolve('packages/node_modules', pkg)).then(function (stat) {
    if (!stat.isDirectory()) { // skip e.g. 'npm-debug.log'
      return;
    }
    console.log('Building ' + pkg + '...');
    if (pkg === 'pouchdb') {
      return buildPouchDB();
    } else {
      return buildModule(path.resolve('./packages/node_modules', pkg));
    }
  });
}

readDir('packages/node_modules').then(function (packages) {
  return Promise.all(packages.map(buildPackage)).catch(function (err) {
    console.error('build error');
    console.error(err.stack);
    process.exit(1);
  });
});
