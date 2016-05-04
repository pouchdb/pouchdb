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

var buildModule = require('./build-module');
var buildPouchDB = require('./build-pouchdb');

readDir('./packages').then(function (packages) {
  return Promise.all(packages.map(function (pkg) {
    console.log('Building ' + pkg + '...');
    if (pkg === 'pouchdb') {
      return buildPouchDB();
    } else {
      return buildModule(path.resolve('./packages', pkg));
    }
  }));
}).catch(function (err) {
  console.error('build error');
  console.error(err.stack);
  process.exit(1);
});