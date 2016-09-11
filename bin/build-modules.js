#!/usr/bin/env node

// Build all modules in the packages/ folder

var path = require('path');
var lie = require('lie');
if (typeof Promise === 'undefined') {
  global.Promise = lie; // required for denodeify in node 0.10
}
var Promise = lie;
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
  // `pouchdb-for-coverage` has to be built last because it depends on
  // `pouchdb`, which has a particular index.es.js file as its jsnext:main
  return Promise.all(packages.filter(function (pkg) {
    return pkg !== 'pouchdb-for-coverage';
  }).map(buildPackage)).then(function () {
    return buildPackage('pouchdb-for-coverage');
  });
}).catch(function (err) {
  console.error('build error');
  console.error(err.stack);
  process.exit(1);
});
