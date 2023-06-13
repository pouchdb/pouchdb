#!/usr/bin/env node

// Build all modules in the packages/ folder

var path = require('path');
var denodeify = require('denodeify');
var fs = require('fs');
var readDir = denodeify(fs.readdir);
var stat = denodeify(fs.stat);

var buildModule = require('./build-module');
var buildPouchDB = require('./build-pouchdb');

readDir('packages').then(function (packages) {
  return Promise.all(packages.map((pkg) => {
    return pkg !== 'server' && pkg.startsWith('pouchdb') && stat(path.resolve('packages/node_modules', pkg)).then(function (stat) {
      console.log('Building ' + pkg + '...');
      if (pkg === 'pouchdb') {
        return buildPouchDB();
      } else {
        return buildModule(path.resolve('./packages/node_modules', pkg));
      }
    });
  })).catch(function (err) {
    console.error('build error');
    console.error(err.stack);
    process.exit(1);
  });
});
